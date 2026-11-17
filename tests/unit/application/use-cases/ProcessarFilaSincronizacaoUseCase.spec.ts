import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { Notificacao } from '@/domain/entities/Notificacao';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import {
  AGORA,
  IDS,
  aparelhoLogado,
  comFotoNoAparelho,
  novaLeitura,
  novoEndereco,
  novoPadrao,
  uuid,
} from '../../../helpers/cenarioSync';

const CAMINHO = `${IDS.empresa.value}/${IDS.endereco.value}/${uuid(100).value}.jpg`;

/** Aparelho com uma leitura registrada offline: gravada e enfileirada. */
async function comLeituraNaFila() {
  const c = await aparelhoLogado();
  const leitura = novaLeitura();
  comFotoNoAparelho(c, leitura);
  await c.repos.leitura.salvar(leitura);
  return { c, leitura, remoto: c.fakes.sincronizacaoRemota };
}

describe('ProcessarFilaSincronizacaoUseCase', () => {
  describe('leitura', () => {
    it('sobe a foto ANTES da linha da leitura', async () => {
      const { c, remoto } = await comLeituraNaFila();

      await c.casos.processarFila.executar();

      expect(remoto.chamadas).toEqual([
        `enviarFoto:${CAMINHO}`,
        `enviarLeitura:${uuid(100).value}`,
      ]);
    });

    it('o caminho da foto começa pela empresa e pelo endereço', async () => {
      const { c, remoto } = await comLeituraNaFila();

      await c.casos.processarFila.executar();

      expect(Array.from(remoto.fotos.keys())).toEqual([CAMINHO]);
      expect(remoto.leituras.get(uuid(100).value)?.fotoPath).toBe(CAMINHO);
    });

    it('depois de enviada, a leitura fica sincronizada e o item sai da fila', async () => {
      const { c } = await comLeituraNaFila();

      const saida = await c.casos.processarFila.executar();

      expect(saida).toEqual({
        enviados: 1, recusados: 0, isolados: 0, restantes: 0, deOutrosUsuarios: 0,
      });
      const salva = await c.fakes.leitura.buscarPorId(uuid(100));
      expect(salva?.estadoSync).toBe(EstadoSyncEnum.SINCRONIZADA);
      expect(salva?.fotoRemotaPath).toBe(CAMINHO);
    });

    it('confirmar o envio não gera outro envio', async () => {
      const { c } = await comLeituraNaFila();

      await c.casos.processarFila.executar();

      // A marcação de "sincronizada" é gravada pelo repositório cru.
      expect(await c.fakes.actionQueue.contar()).toBe(0);
    });

    it('se a rede cai depois da foto, sobra a foto e NÃO a leitura', async () => {
      const { c, remoto } = await comLeituraNaFila();
      // A foto passa; a linha da leitura não chega.
      const original = remoto.enviarLeitura.bind(remoto);
      remoto.enviarLeitura = async (leitura, fotoPath) => {
        remoto.falha = { motivo: 'rede', mensagem: 'caiu' };
        return original(leitura, fotoPath);
      };

      const saida = await c.casos.processarFila.executar();

      expect(remoto.fotos.has(CAMINHO)).toBe(true);
      expect(remoto.leituras.size).toBe(0);
      expect(saida.interrompidoPor).toBe('rede');
      expect(saida.restantes).toBe(1);
      expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(
        EstadoSyncEnum.PENDENTE,
      );
    });

    it('repetir depois da queda conclui sem duplicar', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.falha = { motivo: 'rede', mensagem: 'caiu' };
      await c.casos.processarFila.executar();

      remoto.falha = null;
      const saida = await c.casos.processarFila.executar();

      expect(saida.enviados).toBe(1);
      expect(remoto.leituras.size).toBe(1);
      expect(remoto.fotos.size).toBe(1);
    });

    it('não reenvia a foto de uma leitura que já tem caminho remoto', async () => {
      const { c, leitura, remoto } = await comLeituraNaFila();
      await c.casos.processarFila.executar();
      remoto.chamadas = [];

      // Decisão do administrador: a leitura muda e volta para a fila.
      leitura.aprovar(IDS.admin, AGORA);
      await c.repos.leitura.atualizar(leitura);
      await c.casos.processarFila.executar();

      expect(remoto.chamadas).toEqual([`enviarLeitura:${uuid(100).value}`]);
      expect(remoto.leituras.get(uuid(100).value)?.leitura.status).toBe(StatusLeituraEnum.APROVADA);
    });

    it('envia o estado atual da leitura, não o de quando foi enfileirada', async () => {
      const { c, leitura, remoto } = await comLeituraNaFila();
      leitura.descartar(IDS.admin, AGORA);
      await c.fakes.leitura.atualizar(leitura);

      await c.casos.processarFila.executar();

      expect(remoto.leituras.get(uuid(100).value)?.leitura.status).toBe(
        StatusLeituraEnum.DESCARTADA,
      );
    });

    it('sem a foto no aparelho a leitura não sobe, e a mensagem diz por quê', async () => {
      const c = await aparelhoLogado();
      await c.repos.leitura.salvar(novaLeitura());

      const saida = await c.casos.processarFila.executar();

      expect(saida.recusados).toBe(1);
      const [item] = await c.fakes.actionQueue.obterPendentes();
      expect(item.ultimoErro).toContain('foto do medidor não foi encontrada');
      expect(c.fakes.sincronizacaoRemota.leituras.size).toBe(0);
    });

    it('foto ausente é recusa definitiva: isola na primeira vez, sem esperar 5 rodadas', async () => {
      const c = await aparelhoLogado();
      await c.repos.leitura.salvar(novaLeitura());

      const saida = await c.casos.processarFila.executar();

      expect(saida.isolados).toBe(1);
      const [item] = await c.fakes.actionQueue.obterPendentes();
      expect(item.estaIsolado()).toBe(true);
      expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.FALHOU);
    });

    it('padrão que não existe mais no aparelho também é definitivo', async () => {
      const c = await aparelhoLogado();
      const leitura = novaLeitura({ padraoId: uuid(777) });
      comFotoNoAparelho(c, leitura);
      await c.fakes.leitura.salvar(leitura);
      await c.fakes.actionQueue.enfileirar(ActionQueueItem.para('UPSERT_LEITURA', leitura.id, AGORA));

      await c.casos.processarFila.executar();

      expect((await c.fakes.actionQueue.obterPendentes())[0].estaIsolado()).toBe(true);
    });

    it('item de leitura que não existe mais sai da fila sem enviar nada', async () => {
      const c = await aparelhoLogado();
      await c.fakes.actionQueue.enfileirar(ActionQueueItem.para('UPSERT_LEITURA', uuid(555), AGORA));

      const saida = await c.casos.processarFila.executar();

      expect(saida).toEqual({
        enviados: 1, recusados: 0, isolados: 0, restantes: 0, deOutrosUsuarios: 0,
      });
      expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
    });
  });

  describe('dono de cada item (ADR 10.19)', () => {
    const OUTRO = uuid(42).value;

    it('o item nasce com o dono da sessão em que a escrita foi feita', async () => {
      const { c } = await comLeituraNaFila();

      const [item] = await c.fakes.actionQueue.obterPendentes();

      expect(item.donoId?.value).toBe(IDS.tecnico.value);
    });

    it('com outra pessoa logada, o item fica esperando o dono, sem gastar tentativa', async () => {
      const { c, remoto } = await comLeituraNaFila();

      const saida = await c.casos.processarFila.executar({ usuarioId: OUTRO });

      expect(saida).toMatchObject({ enviados: 0, recusados: 0, restantes: 0, deOutrosUsuarios: 1 });
      expect(remoto.chamadas).toEqual([]);
      expect((await c.fakes.actionQueue.obterPendentes())[0].tentativas).toBe(0);
    });

    it('quando o dono entra, o item sobe', async () => {
      const { c, remoto } = await comLeituraNaFila();

      const saida = await c.casos.processarFila.executar({ usuarioId: IDS.tecnico.value });

      expect(saida.enviados).toBe(1);
      expect(remoto.leituras.size).toBe(1);
    });

    it('item sem dono (anterior à migração 005) sobe com qualquer sessão', async () => {
      const c = await aparelhoLogado();
      await c.fakes.actionQueue.enfileirar(
        ActionQueueItem.para('MARCAR_NOTIFICACOES_LIDAS', IDS.empresa, AGORA),
      );

      const saida = await c.casos.processarFila.executar({ usuarioId: OUTRO });

      expect(saida.enviados).toBe(1);
    });
  });

  describe('ordem e substituição', () => {
    it('processa em ordem de criação', async () => {
      const c = await aparelhoLogado();
      await c.repos.endereco.salvar(novoEndereco(IDS.outroEndereco));
      await c.repos.padrao.salvar(novoPadrao(uuid(21), IDS.outroEndereco));

      await c.casos.processarFila.executar();

      expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([
        `enviarEndereco:${IDS.outroEndereco.value}`,
        `enviarPadrao:${uuid(21).value}`,
      ]);
    });

    it('na substituição, a antiga sobe primeiro (já substituída) e libera a vaga', async () => {
      const c = await aparelhoLogado();
      const antiga = novaLeitura();
      comFotoNoAparelho(c, antiga);
      await c.repos.leitura.salvar(antiga);
      await c.casos.processarFila.executar();
      c.fakes.sincronizacaoRemota.chamadas = [];

      const nova = novaLeitura({
        id: uuid(101),
        fotoLocalUri: 'file:///documents/leituras/101.jpg',
        medidoEm: new Date(AGORA.getTime() + 60_000),
      });
      comFotoNoAparelho(c, nova);
      antiga.substituirPor(nova, AGORA);
      await c.repos.leitura.salvarSubstituindo(nova, antiga);

      await c.casos.processarFila.executar();

      const envios = c.fakes.sincronizacaoRemota.chamadas.filter((x) => x.startsWith('enviarLeitura'));
      expect(envios).toEqual([
        `enviarLeitura:${uuid(100).value}`,
        `enviarLeitura:${uuid(101).value}`,
      ]);
      expect(c.fakes.sincronizacaoRemota.leituras.get(uuid(100).value)?.leitura.status).toBe(
        StatusLeituraEnum.SUBSTITUIDA,
      );
    });
  });

  describe('falhas', () => {
    it('sem rede a rodada para e nada conta como tentativa', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.falha = { motivo: 'rede', mensagem: 'sem sinal' };

      const saida = await c.casos.processarFila.executar();

      expect(saida).toEqual({
        enviados: 0,
        recusados: 0,
        isolados: 0,
        restantes: 1,
        deOutrosUsuarios: 0,
        interrompidoPor: 'rede',
      });
      expect((await c.fakes.actionQueue.obterPendentes())[0].tentativas).toBe(0);
    });

    it('sessão expirada também interrompe sem gastar tentativa', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.falha = { motivo: 'nao_autenticado', mensagem: 'jwt expired' };

      const saida = await c.casos.processarFila.executar();

      expect(saida.interrompidoPor).toBe('nao_autenticado');
      expect((await c.fakes.actionQueue.obterPendentes())[0].tentativas).toBe(0);
    });

    it('a recusa do servidor conta tentativa e guarda o motivo', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.recusar.set('enviarLeitura', 'Você não está vinculado ao endereço deste padrão');

      const saida = await c.casos.processarFila.executar();

      expect(saida.recusados).toBe(1);
      const [item] = await c.fakes.actionQueue.obterPendentes();
      expect(item.tentativas).toBe(1);
      expect(item.ultimoErro).toBe('Você não está vinculado ao endereço deste padrão');
    });

    it('um item recusado não trava os que vêm depois', async () => {
      const { c, remoto } = await comLeituraNaFila();
      await c.repos.endereco.salvar(novoEndereco(IDS.outroEndereco));
      remoto.recusar.set('enviarLeitura', 'recusada');

      const saida = await c.casos.processarFila.executar();

      expect(saida.recusados).toBe(1);
      expect(saida.enviados).toBe(1);
      expect(remoto.enderecos.has(IDS.outroEndereco.value)).toBe(true);
    });

    it('ao estourar o limite o item é isolado e a leitura aparece como não enviada', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.recusar.set('enviarLeitura', 'recusada');

      let saida = await c.casos.processarFila.executar();
      for (let i = 1; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
        saida = await c.casos.processarFila.executar();
      }

      expect(saida.isolados).toBe(1);
      expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.FALHOU);
      expect(await c.fakes.actionQueue.contar()).toBe(1);
    });

    it('item isolado é pulado: não vai mais para a nuvem sozinho', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.recusar.set('enviarLeitura', 'recusada');
      for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
        await c.casos.processarFila.executar();
      }
      remoto.chamadas = [];

      const saida = await c.casos.processarFila.executar();

      expect(remoto.chamadas).toEqual([]);
      expect(saida).toEqual({
        enviados: 0, recusados: 0, isolados: 1, restantes: 1, deOutrosUsuarios: 0,
      });
    });

    it('erro inesperado ao montar o envio vira recusa, não exceção', async () => {
      const { c, remoto } = await comLeituraNaFila();
      remoto.enviarLeitura = async () => {
        throw new Error('estouro inesperado');
      };

      const saida = await c.casos.processarFila.executar();

      expect(saida.recusados).toBe(1);
      expect((await c.fakes.actionQueue.obterPendentes())[0].ultimoErro).toBe('estouro inesperado');
    });
  });

  describe('demais operações', () => {
    it('envia notificação, usuário e empresa pelo estado atual', async () => {
      const c = await aparelhoLogado();
      const aviso = new Notificacao({
        id: uuid(200), empresaId: IDS.empresa, tipo: TipoNotificacaoEnum.LEITURA_SEM_GPS,
        titulo: 'Sem GPS', mensagem: 'Leitura sem GPS', criadaEm: AGORA,
      });
      await c.repos.notificacao.salvar(aviso);
      const tecnico = await c.fakes.usuario.buscarPorId(IDS.tecnico);
      await c.repos.usuario.atualizar(tecnico!);
      const empresa = await c.fakes.empresa.buscarPorId(IDS.empresa);
      await c.repos.empresa.salvar(empresa!);

      const saida = await c.casos.processarFila.executar();

      const remoto = c.fakes.sincronizacaoRemota;
      expect(saida.enviados).toBe(3);
      expect(remoto.notificacoes.has(uuid(200).value)).toBe(true);
      expect(remoto.usuarios.has(IDS.tecnico.value)).toBe(true);
      expect(remoto.empresas.has(IDS.empresa.value)).toBe(true);
    });

    it('envia as exclusões e a marcação de notificações lidas', async () => {
      const c = await aparelhoLogado();
      await c.repos.padrao.excluir(IDS.padrao);
      await c.repos.endereco.excluir(IDS.endereco);
      await c.repos.usuario.excluir(IDS.tecnico);
      await c.repos.notificacao.marcarTodasLidas(IDS.empresa);

      await c.casos.processarFila.executar();

      const remoto = c.fakes.sincronizacaoRemota;
      expect(remoto.excluidos).toEqual([
        IDS.padrao.value, IDS.endereco.value, IDS.tecnico.value,
      ]);
      expect(remoto.marcacoesDeLidas).toEqual([IDS.empresa.value]);
    });
  });
});
