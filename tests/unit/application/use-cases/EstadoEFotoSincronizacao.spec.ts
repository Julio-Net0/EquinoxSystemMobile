import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import {
  CHAVE_ULTIMA_SYNC,
  CHAVE_ULTIMO_ERRO,
} from '@/domain/repositories/ISyncMetaRepository';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import {
  AGORA,
  aparelhoLogado,
  comFotoNoAparelho,
  novaLeitura,
  uuid,
} from '../../../helpers/cenarioSync';

describe('ConsultarEstadoSincronizacaoUseCase', () => {
  it('aparelho em dia: nada pendente', async () => {
    const c = await aparelhoLogado();

    expect(await c.casos.estadoSincronizacao.executar()).toEqual({
      pendentes: 0, isolados: 0, ultimaSincronizacaoEm: null, ultimoErro: null, itens: [],
    });
  });

  it('conta o que está na fila e descreve cada item em português', async () => {
    const c = await aparelhoLogado();
    await c.repos.leitura.salvar(novaLeitura());
    await c.fakes.syncMeta.definir(CHAVE_ULTIMA_SYNC, AGORA.toISOString());
    await c.fakes.syncMeta.definir(CHAVE_ULTIMO_ERRO, 'Sem conexão');

    const estado = await c.casos.estadoSincronizacao.executar();

    expect(estado.pendentes).toBe(1);
    expect(estado.isolados).toBe(0);
    expect(estado.ultimaSincronizacaoEm).toBe(AGORA.toISOString());
    expect(estado.ultimoErro).toBe('Sem conexão');
    expect(estado.itens[0]).toMatchObject({
      tipo: 'UPSERT_LEITURA', descricao: 'Leitura', tentativas: 0, isolado: false, ultimoErro: null,
    });
  });

  it('separa os itens isolados, com o motivo da recusa', async () => {
    const c = await aparelhoLogado();
    await c.repos.leitura.salvar(novaLeitura());
    const [item] = await c.fakes.actionQueue.obterPendentes();
    for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
      await c.fakes.actionQueue.registrarFalha(item.id, 'A nuvem recusou');
    }

    const estado = await c.casos.estadoSincronizacao.executar();

    expect(estado.isolados).toBe(1);
    expect(estado.itens[0]).toMatchObject({ isolado: true, ultimoErro: 'A nuvem recusou' });
  });

  it('tentar de novo devolve os isolados à fila e a leitura volta a pendente', async () => {
    const c = await aparelhoLogado();
    const leitura = novaLeitura();
    comFotoNoAparelho(c, leitura);
    await c.repos.leitura.salvar(leitura);
    c.fakes.sincronizacaoRemota.recusar.set('enviarLeitura', 'recusada');
    for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
      await c.casos.processarFila.executar();
    }
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.FALHOU);

    await c.casos.estadoSincronizacao.tentarDeNovo();

    expect((await c.casos.estadoSincronizacao.executar()).isolados).toBe(0);
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.PENDENTE);

    // E agora, com o servidor aceitando, ela sobe.
    c.fakes.sincronizacaoRemota.recusar.clear();
    expect((await c.casos.processarFila.executar()).enviados).toBe(1);
  });

  it('tentar de novo não mexe em quem não está isolado', async () => {
    const c = await aparelhoLogado();
    await c.repos.leitura.salvar(novaLeitura());
    const [item] = await c.fakes.actionQueue.obterPendentes();
    await c.fakes.actionQueue.registrarFalha(item.id, 'uma recusa');

    await c.casos.estadoSincronizacao.tentarDeNovo();

    expect((await c.fakes.actionQueue.obterPendentes())[0].tentativas).toBe(1);
  });
});

describe('ObterFotoDaLeituraUseCase', () => {
  it('prefere a foto do aparelho: funciona sem rede', async () => {
    const c = await aparelhoLogado();
    const leitura = novaLeitura();
    comFotoNoAparelho(c, leitura);
    await c.fakes.leitura.salvar(leitura);
    c.fakes.sincronizacaoRemota.falha = { motivo: 'rede', mensagem: 'sem sinal' };

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida).toEqual({ uri: 'file:///documents/leituras/100.jpg', origem: 'aparelho' });
    expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
  });

  it('leitura de outro aparelho: pede uma URL assinada de vida curta', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(
      novaLeitura({ fotoLocalUri: '', fotoRemotaPath: 'empresa/endereco/100.jpg' }),
    );

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida.origem).toBe('nuvem');
    expect(saida.uri).toContain('/assinada/empresa/endereco/100.jpg');
  });

  it('arquivo local apagado pelo sistema: cai para a nuvem', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(novaLeitura({ fotoRemotaPath: 'empresa/endereco/100.jpg' }));

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida.origem).toBe('nuvem');
  });

  it('foto só na nuvem e aparelho sem rede: avisa em vez de falhar', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(
      novaLeitura({ fotoLocalUri: '', fotoRemotaPath: 'empresa/endereco/100.jpg' }),
    );
    c.fakes.sincronizacaoRemota.falha = { motivo: 'rede', mensagem: 'sem sinal' };

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida).toEqual({
      uri: null, origem: null, aviso: 'A foto está na nuvem. Conecte-se para vê-la',
    });
  });

  it('a nuvem recusa (sem permissão): não mostra a foto', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(
      novaLeitura({ fotoLocalUri: '', fotoRemotaPath: 'empresa/endereco/100.jpg' }),
    );
    c.fakes.sincronizacaoRemota.recusar.set('urlAssinadaDaFoto', 'negado');

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida.uri).toBeNull();
    expect(saida.aviso).toBe('Não foi possível abrir a foto na nuvem');
  });

  it('sem arquivo e sem caminho remoto: diz que a foto não está no aparelho', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(novaLeitura());

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida.aviso).toBe('A foto desta leitura não está neste aparelho');
  });

  it('falha ao consultar o disco (web) é tratada como foto ausente', async () => {
    const c = await aparelhoLogado();
    await c.fakes.leitura.salvar(novaLeitura({ fotoRemotaPath: 'empresa/endereco/100.jpg' }));
    c.fakes.arquivoFoto.existe = async () => {
      throw new Error('API indisponível');
    };

    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(100).value });

    expect(saida.origem).toBe('nuvem');
  });

  it('leitura inexistente', async () => {
    const c = await aparelhoLogado();
    const saida = await c.casos.fotoDaLeitura.executar({ leituraId: uuid(999).value });
    expect(saida.aviso).toBe('Leitura não encontrada');
  });
});

describe('EncerrarSessaoUseCase', () => {
  it('apaga a sessão local e encerra a da nuvem', async () => {
    const c = await aparelhoLogado();

    const saida = await c.casos.encerrarSessao.executar();

    expect(saida).toEqual({ pendentes: 0 });
    expect(await c.fakes.sessao.obterSessao()).toBeNull();
    expect(c.fakes.autenticacaoRemota.sessaoAtual).toBeNull();
  });

  it('não apaga o que está na fila, e informa quanto ficou', async () => {
    const c = await aparelhoLogado();
    await c.repos.leitura.salvar(novaLeitura());

    expect(await c.casos.encerrarSessao.pendentes()).toBe(1);
    const saida = await c.casos.encerrarSessao.executar();

    expect(saida.pendentes).toBe(1);
    expect(await c.fakes.actionQueue.contar()).toBe(1);
    expect(await c.fakes.leitura.buscarPorId(uuid(100))).not.toBeNull();
  });

  it('depois de sair, entrar de novo exige rede', async () => {
    const c = await aparelhoLogado();
    await c.casos.encerrarSessao.executar();
    c.fakes.autenticacaoRemota.online = false;

    const saida = await c.casos.autenticar.executar({
      login: 'tecnico@equinox.dev', senha: 'Equinox@2026',
    });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toContain('precisa de internet');
  });
});
