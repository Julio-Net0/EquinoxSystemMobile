import { CHAVE_CURSORES } from '@/domain/repositories/ISyncMetaRepository';
import { Notificacao } from '@/domain/entities/Notificacao';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { pacoteVazio } from '@/infrastructure/fakes/SincronizacaoRemotaFake';
import { criarContainerFake } from '@/infrastructure/di/criarContainerFake';
import {
  AGORA,
  IDS,
  aparelhoLogado,
  novaEmpresa,
  novaLeitura,
  novoEndereco,
  novoPadrao,
  novoUsuario,
  uuid,
} from '../../../helpers/cenarioSync';

const EU = { usuarioId: IDS.tecnico.value };

/** Leitura como chega da nuvem: sem foto no aparelho e com caminho remoto. */
const remota = (sobrescrita: Parameters<typeof novaLeitura>[0] = {}) =>
  novaLeitura({
    fotoLocalUri: '',
    fotoRemotaPath: 'empresa/endereco/foto.jpg',
    estadoSync: EstadoSyncEnum.SINCRONIZADA,
    ...sobrescrita,
  });

describe('BaixarAlteracoesUseCase', () => {
  it('primeiro pull num aparelho vazio traz tudo, na ordem das dependências', async () => {
    const c = criarContainerFake();
    c.fakes.sincronizacaoRemota.pacotes.push({
      ...pacoteVazio({ leituras: '2026-03-10T15:00:00.123456+00:00' }),
      empresas: [novaEmpresa()],
      enderecos: [novoEndereco()],
      padroes: [novoPadrao()],
      usuarios: [novoUsuario()],
      leituras: [remota()],
    });

    const saida = await c.casos.baixarAlteracoes.executar(EU);

    expect(saida).toEqual({ sucesso: true, recebidos: 5, ignorados: [] });
    expect(await c.fakes.empresa.buscarPorId(IDS.empresa)).not.toBeNull();
    expect(await c.fakes.padrao.buscarPorId(IDS.padrao)).not.toBeNull();
    expect((await c.fakes.usuario.buscarPorId(IDS.tecnico))?.enderecosVinculados).toHaveLength(1);
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estaSincronizada()).toBe(true);
  });

  it('o que vem da nuvem não volta para a fila de envio', async () => {
    const c = await aparelhoLogado();
    c.fakes.sincronizacaoRemota.pacotes.push({ ...pacoteVazio(), leituras: [remota()] });

    await c.casos.baixarAlteracoes.executar(EU);

    expect(await c.fakes.actionQueue.contar()).toBe(0);
  });

  describe('cursores (pull incremental)', () => {
    it('envia os cursores guardados e guarda os novos como vieram do servidor', async () => {
      const c = await aparelhoLogado();
      await c.fakes.syncMeta.definir(CHAVE_CURSORES, '{"leituras":"2026-03-09T00:00:00+00:00"}');
      c.fakes.sincronizacaoRemota.pacotes.push(
        pacoteVazio({ leituras: '2026-03-10T15:00:00.123456+00:00' }),
      );

      await c.casos.baixarAlteracoes.executar(EU);

      expect(c.fakes.sincronizacaoRemota.cursoresRecebidos).toEqual([
        { leituras: '2026-03-09T00:00:00+00:00' },
      ]);
      expect(JSON.parse((await c.fakes.syncMeta.obter(CHAVE_CURSORES))!)).toEqual({
        leituras: '2026-03-10T15:00:00.123456+00:00',
      });
    });

    it('sem cursor guardado pede tudo', async () => {
      const c = await aparelhoLogado();
      await c.casos.baixarAlteracoes.executar(EU);
      expect(c.fakes.sincronizacaoRemota.cursoresRecebidos).toEqual([{}]);
    });

    it('cursor ilegível equivale a nunca ter sincronizado', async () => {
      const c = await aparelhoLogado();
      await c.fakes.syncMeta.definir(CHAVE_CURSORES, 'isto não é json');

      await c.casos.baixarAlteracoes.executar(EU);

      expect(c.fakes.sincronizacaoRemota.cursoresRecebidos).toEqual([{}]);
    });

    it('se aplicar o pacote falha, o cursor não avança', async () => {
      const c = await aparelhoLogado();
      await c.fakes.syncMeta.definir(CHAVE_CURSORES, '{"leituras":"antigo"}');
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio({ leituras: 'novo' }),
        empresas: [novaEmpresa(IDS.outraEmpresa, '11222333000181')],
      });
      c.fakes.empresa.salvar = async () => {
        throw new Error('disco cheio');
      };

      await expect(c.casos.baixarAlteracoes.executar(EU)).rejects.toThrow('disco cheio');

      expect(await c.fakes.syncMeta.obter(CHAVE_CURSORES)).toBe('{"leituras":"antigo"}');
    });
  });

  it('sem rede não mexe em nada e devolve o motivo', async () => {
    const c = await aparelhoLogado();
    c.fakes.sincronizacaoRemota.falha = { motivo: 'rede', mensagem: 'sem sinal' };

    const saida = await c.casos.baixarAlteracoes.executar(EU);

    expect(saida).toEqual({
      sucesso: false, recebidos: 0, ignorados: [], motivo: 'rede', erro: 'sem sinal',
    });
    expect(await c.fakes.syncMeta.obter(CHAVE_CURSORES)).toBeNull();
  });

  describe('leituras', () => {
    it('a remota sobrescreve a local já sincronizada (última escrita vence)', async () => {
      const c = await aparelhoLogado();
      await c.fakes.leitura.salvar(
        novaLeitura({ estadoSync: EstadoSyncEnum.SINCRONIZADA, fotoRemotaPath: 'a/b/c.jpg' }),
      );
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ id: IDS.admin, usuario: 'admin', email: 'admin@equinox.dev', perfil: PerfilEnum.ADMIN })],
        leituras: [
          remota({ status: StatusLeituraEnum.APROVADA, decididaEm: AGORA, decididaPorId: IDS.admin }),
        ],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      const local = await c.fakes.leitura.buscarPorId(uuid(100));
      expect(local?.status).toBe(StatusLeituraEnum.APROVADA);
      expect(local?.decididaPorId?.equals(IDS.admin)).toBe(true);
      // A foto que já estava no aparelho continua lá.
      expect(local?.fotoLocalUri).toBe('file:///documents/leituras/100.jpg');
    });

    it('não sobrescreve a leitura que tem alteração local ainda não enviada', async () => {
      const c = await aparelhoLogado();
      const local = novaLeitura();
      local.descartar(IDS.tecnico, AGORA);
      await c.fakes.leitura.salvar(local);
      c.fakes.sincronizacaoRemota.pacotes.push({ ...pacoteVazio(), leituras: [remota()] });

      await c.casos.baixarAlteracoes.executar(EU);

      expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.status).toBe(
        StatusLeituraEnum.DESCARTADA,
      );
    });

    it('a vigente remota tira da vaga a leitura local do mesmo dia', async () => {
      const c = await aparelhoLogado();
      await c.fakes.leitura.salvar(
        novaLeitura({ estadoSync: EstadoSyncEnum.SINCRONIZADA, fotoRemotaPath: 'a/b/c.jpg' }),
      );
      const dePacote = remota({ id: uuid(101), medidoEm: new Date(AGORA.getTime() + 60_000) });
      c.fakes.sincronizacaoRemota.pacotes.push({ ...pacoteVazio(), leituras: [dePacote] });

      await c.casos.baixarAlteracoes.executar(EU);

      expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.status).toBe(
        StatusLeituraEnum.SUBSTITUIDA,
      );
      expect((await c.fakes.leitura.buscarPorId(uuid(101)))?.estaVigente()).toBe(true);
    });

    it('quem decidiu fora do alcance deste usuário fica em branco no aparelho', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        leituras: [
          remota({ status: StatusLeituraEnum.APROVADA, decididaEm: AGORA, decididaPorId: uuid(777) }),
        ],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      const local = await c.fakes.leitura.buscarPorId(uuid(100));
      expect(local?.status).toBe(StatusLeituraEnum.APROVADA);
      expect(local?.decididaPorId).toBeNull();
    });

    it('ignora, com aviso, a leitura cujo padrão ou autor não está no aparelho', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        leituras: [remota({ id: uuid(101), padraoId: uuid(999) }), remota({ id: uuid(102), usuarioId: uuid(998) })],
      });

      const saida = await c.casos.baixarAlteracoes.executar(EU);

      expect(saida.ignorados).toHaveLength(2);
      expect(saida.ignorados[0]).toContain('padrão');
      expect(saida.ignorados[1]).toContain('autor');
      expect(c.fakes.leitura.items.size).toBe(0);
    });
  });

  describe('usuários', () => {
    it('resolve quem autorizou quando ele vem depois no mesmo pacote', async () => {
      const c = await aparelhoLogado();
      const admin = novoUsuario({
        id: IDS.admin, usuario: 'admin', email: 'admin@equinox.dev', perfil: PerfilEnum.ADMIN,
      });
      const novo = novoUsuario({
        id: uuid(32), usuario: 'novo', email: 'novo@equinox.dev', autorizadoPorId: IDS.admin,
      });
      c.fakes.sincronizacaoRemota.pacotes.push({ ...pacoteVazio(), usuarios: [novo, admin] });

      await c.casos.baixarAlteracoes.executar(EU);

      expect((await c.fakes.usuario.buscarPorId(uuid(32)))?.autorizadoPorId?.equals(IDS.admin)).toBe(
        true,
      );
    });

    it('deixa em branco quem autorizou quando ele não está ao alcance', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ id: uuid(32), usuario: 'novo', email: 'novo@equinox.dev', autorizadoPorId: uuid(777) })],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      expect((await c.fakes.usuario.buscarPorId(uuid(32)))?.autorizadoPorId).toBeNull();
    });

    it('descarta vínculo com endereço que não está no aparelho', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ id: uuid(32), usuario: 'novo', email: 'novo@equinox.dev', enderecosVinculados: [IDS.endereco, uuid(999)] })],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      const vinculos = (await c.fakes.usuario.buscarPorId(uuid(32)))?.enderecosVinculados ?? [];
      expect(vinculos.map((v) => v.value)).toEqual([IDS.endereco.value]);
    });

    it('pula o usuário de uma empresa que não está no aparelho', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ id: uuid(32), usuario: 'fora', email: 'fora@equinox.dev', empresaId: IDS.outraEmpresa, enderecosVinculados: [] })],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      expect(await c.fakes.usuario.buscarPorId(uuid(32))).toBeNull();
    });
  });

  describe('mudança de escopo', () => {
    it('ganhou um vínculo novo: zera os cursores e baixa tudo de novo na mesma rodada', async () => {
      const c = await aparelhoLogado();
      await c.fakes.syncMeta.definir(CHAVE_CURSORES, '{"enderecos":"antigo"}');
      const remoto = c.fakes.sincronizacaoRemota;
      // 1ª resposta: só o meu perfil mudou (novo vínculo). O endereço novo é
      // antigo no servidor, então o incremental não o traz.
      remoto.pacotes.push({
        ...pacoteVazio({ enderecos: 'antigo', usuarios: 'c1' }),
        enderecos: [novoEndereco(IDS.outroEndereco)],
        usuarios: [novoUsuario({ enderecosVinculados: [IDS.endereco, IDS.outroEndereco] })],
      });
      remoto.pacotes.push({ ...pacoteVazio({ enderecos: 'c2' }), padroes: [novoPadrao(uuid(21), IDS.outroEndereco)] });

      await c.casos.baixarAlteracoes.executar(EU);

      expect(remoto.cursoresRecebidos).toEqual([{ enderecos: 'antigo' }, {}]);
      expect(await c.fakes.padrao.buscarPorId(uuid(21))).not.toBeNull();
      expect(JSON.parse((await c.fakes.syncMeta.obter(CHAVE_CURSORES))!)).toEqual({ enderecos: 'c2' });
    });

    it('perfil que só mudou de nome não refaz o pull', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio({ usuarios: 'c1' }),
        usuarios: [novoUsuario({ nome: 'João S.' })],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      expect(c.fakes.sincronizacaoRemota.cursoresRecebidos).toHaveLength(1);
    });
  });

  describe('exclusões e avisos', () => {
    it('aplica as lápides: apaga do aparelho o que foi apagado na nuvem', async () => {
      const c = await aparelhoLogado();
      await c.fakes.usuario.salvar(novoUsuario({ id: uuid(32), usuario: 'x', email: 'x@equinox.dev' }));
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        exclusoes: [
          { tabela: 'padroes', registroId: IDS.padrao },
          { tabela: 'enderecos', registroId: IDS.endereco },
          { tabela: 'usuarios', registroId: uuid(32) },
        ],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      expect(await c.fakes.padrao.buscarPorId(IDS.padrao)).toBeNull();
      expect(await c.fakes.endereco.buscarPorId(IDS.endereco)).toBeNull();
      expect(await c.fakes.usuario.buscarPorId(uuid(32))).toBeNull();
    });

    it('ignora o padrão de um endereço que não está no aparelho', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(), padroes: [novoPadrao(uuid(21), uuid(999))],
      });

      const saida = await c.casos.baixarAlteracoes.executar(EU);

      expect(saida.ignorados).toEqual(['Padrão 778811: o endereço dele não está neste aparelho']);
    });

    it('traz as notificações geradas em outros aparelhos', async () => {
      const c = await aparelhoLogado();
      const aviso = (id: number, leituraId = uuid(100)) =>
        new Notificacao({
          id: uuid(id), empresaId: IDS.empresa, tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
          titulo: 'Leitura atrasada', mensagem: 'Confirme ou descarte', criadaEm: AGORA,
          requerAcao: true, leituraId, resolvidaPorId: null,
        });
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        leituras: [remota()],
        // A segunda aponta para uma leitura que não está no aparelho.
        notificacoes: [aviso(200), aviso(201, uuid(999))],
      });

      await c.casos.baixarAlteracoes.executar(EU);

      expect(await c.fakes.notificacao.buscarPorId(uuid(200))).not.toBeNull();
      expect(await c.fakes.notificacao.buscarPorId(uuid(201))).toBeNull();
    });

    it('repassa as linhas que o adaptador não conseguiu interpretar', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(), ignorados: ['empresas 1: CNPJ inválido'],
      });

      const saida = await c.casos.baixarAlteracoes.executar(EU);

      expect(saida.ignorados).toEqual(['empresas 1: CNPJ inválido']);
    });
  });
});
