import { Notificacao } from '@/domain/entities/Notificacao';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ContainerFake } from '@/infrastructure/di/criarContainerFake';
import {
  AGORA,
  IDS,
  aparelhoLogado,
  novaLeitura,
  novoEndereco,
  novoPadrao,
  uuid,
} from '../../../helpers/cenarioSync';

const FOTO_TEMP = 'file:///cache/medidor.jpg';

async function tiposNaFila(c: ContainerFake): Promise<string[]> {
  return (await c.fakes.actionQueue.obterPendentes()).map((i) => i.tipoOperacao);
}

function registrar(c: ContainerFake, valorConsumo = 11_300, medidoEm = AGORA) {
  return c.casos.registrarLeitura.executar({
    padraoId: IDS.padrao.value,
    usuarioId: IDS.tecnico.value,
    valorConsumo,
    fotoTemporariaUri: FOTO_TEMP,
    coordenadas: { latitude: -19.9191, longitude: -43.9386 },
    medidoEm,
  });
}

/**
 * Os casos de uso de negócio não sabem da fila: recebem repositórios que
 * salvam e enfileiram na mesma transação. Estes testes passam pelo container,
 * que é onde essa ligação é feita.
 */
describe('fila de envio a partir dos casos de uso', () => {
  describe('registrar leitura (offline)', () => {
    it('grava localmente e enfileira o envio', async () => {
      const c = await aparelhoLogado();
      c.fakes.conectividade.definirOnline(false);

      const saida = await registrar(c);

      expect(saida.sucesso).toBe(true);
      const [item] = await c.fakes.actionQueue.obterPendentes();
      expect(item.tipoOperacao).toBe('UPSERT_LEITURA');
      expect(item.registroId?.value).toBe(saida.leituraId);
      // Nada foi para a nuvem: o registro não depende de rede.
      expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
    });

    it('a leitura nasce pendente de envio', async () => {
      const c = await aparelhoLogado();

      const saida = await registrar(c);

      const salva = Array.from(c.fakes.leitura.items.values())[0];
      expect(salva.id.value).toBe(saida.leituraId);
      expect(salva.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
      expect(salva.fotoRemotaPath).toBeNull();
    });

    it('os avisos gerados pela leitura entram na fila depois dela', async () => {
      const c = await aparelhoLogado();

      // Sem GPS: gera LEITURA_SEM_GPS para o administrador.
      await c.casos.registrarLeitura.executar({
        padraoId: IDS.padrao.value,
        usuarioId: IDS.tecnico.value,
        valorConsumo: 11_300,
        fotoTemporariaUri: FOTO_TEMP,
        coordenadas: null,
      });

      expect(await tiposNaFila(c)).toEqual(['UPSERT_LEITURA', 'UPSERT_NOTIFICACAO']);
    });

    it('é atômico: se enfileirar falha, a leitura não fica gravada', async () => {
      const c = await aparelhoLogado();
      c.fakes.actionQueue.falharAoEnfileirar = new Error('fila indisponível');

      await expect(registrar(c)).rejects.toThrow('fila indisponível');

      expect(c.fakes.leitura.items.size).toBe(0);
      expect(await c.fakes.actionQueue.contar()).toBe(0);
    });

    it('a segunda leitura do dia enfileira a antiga (substituída) e depois a nova', async () => {
      const c = await aparelhoLogado();
      const primeira = await registrar(c, 11_300);
      const segunda = await registrar(c, 11_350, new Date(AGORA.getTime() + 60_000));

      const leituras = (await c.fakes.actionQueue.obterPendentes())
        .filter((i) => i.tipoOperacao === 'UPSERT_LEITURA')
        .map((i) => i.registroId?.value);

      expect(leituras).toEqual([primeira.leituraId, primeira.leituraId, segunda.leituraId]);
      expect(segunda.substituiuLeituraId).toBe(primeira.leituraId);
    });
  });

  it('a decisão do administrador reenfileira a leitura e o aviso', async () => {
    const c = await aparelhoLogado();
    const leitura = novaLeitura({ estadoSync: EstadoSyncEnum.SINCRONIZADA, fotoRemotaPath: 'a/b/c.jpg' });
    await c.fakes.leitura.salvar(leitura);

    leitura.aprovar(IDS.admin, AGORA);
    await c.repos.leitura.atualizar(leitura);

    expect(await tiposNaFila(c)).toEqual(['UPSERT_LEITURA']);
    // Voltou a ter alteração local que a nuvem não conhece.
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
  });

  it('estrutura: criar, editar e excluir endereço e padrão enfileiram', async () => {
    const c = await aparelhoLogado();

    await c.repos.endereco.salvar(novoEndereco(IDS.outroEndereco));
    await c.repos.endereco.atualizar(novoEndereco(IDS.outroEndereco));
    await c.repos.padrao.salvar(novoPadrao(uuid(21), IDS.outroEndereco));
    await c.repos.padrao.atualizar(novoPadrao(uuid(21), IDS.outroEndereco));
    await c.repos.padrao.excluir(uuid(21));
    await c.repos.endereco.excluir(IDS.outroEndereco);

    expect(await tiposNaFila(c)).toEqual([
      'UPSERT_ENDERECO', 'UPSERT_ENDERECO', 'UPSERT_PADRAO', 'UPSERT_PADRAO',
      'EXCLUIR_PADRAO', 'EXCLUIR_ENDERECO',
    ]);
  });

  it('usuários e notificações também enfileiram', async () => {
    const c = await aparelhoLogado();
    const tecnico = (await c.fakes.usuario.buscarPorId(IDS.tecnico))!;
    const aviso = new Notificacao({
      id: uuid(200), empresaId: IDS.empresa, tipo: TipoNotificacaoEnum.LEITURA_SEM_GPS,
      titulo: 'Sem GPS', mensagem: 'Leitura sem GPS', criadaEm: AGORA,
    });

    await c.repos.usuario.salvar(tecnico);
    await c.repos.usuario.atualizar(tecnico);
    await c.repos.notificacao.salvar(aviso);
    await c.repos.notificacao.atualizar(aviso);
    await c.repos.notificacao.marcarTodasLidas(IDS.empresa);
    await c.repos.usuario.excluir(IDS.tecnico);

    expect(await tiposNaFila(c)).toEqual([
      'UPSERT_USUARIO', 'UPSERT_USUARIO', 'UPSERT_NOTIFICACAO', 'UPSERT_NOTIFICACAO',
      'MARCAR_NOTIFICACOES_LIDAS', 'EXCLUIR_USUARIO',
    ]);
  });

  it('consultas passam direto, sem tocar na fila', async () => {
    const c = await aparelhoLogado();

    await c.repos.endereco.listarPorEmpresa(IDS.empresa);
    await c.repos.padrao.listarPorEndereco(IDS.endereco);
    await c.repos.leitura.listarDoPadrao(IDS.padrao);
    await c.casos.consultarCatalogo.executar({ usuarioId: IDS.tecnico.value });

    expect(await c.fakes.actionQueue.contar()).toBe(0);
  });

  it('o expurgo local não enfileira nada', async () => {
    const c = await aparelhoLogado();
    const antiga = novaLeitura({
      medidoEm: new Date(Date.UTC(2026, 0, 5, 15)),
      estadoSync: EstadoSyncEnum.SINCRONIZADA,
      fotoRemotaPath: 'a/b/c.jpg',
    });
    antiga.aprovar(IDS.admin, AGORA);
    await c.fakes.leitura.salvar(antiga);

    const saida = await c.casos.purgar.executar();

    expect(saida.removidas).toBe(1);
    expect(await c.fakes.actionQueue.contar()).toBe(0);
  });
});
