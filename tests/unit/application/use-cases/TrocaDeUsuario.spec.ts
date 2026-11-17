import {
  CHAVE_CURSORES,
  CHAVE_USUARIO_DO_CURSOR,
} from '@/domain/repositories/ISyncMetaRepository';
import {
  IDS,
  SENHA,
  aparelhoLogado,
  comFotoNoAparelho,
  novaLeitura,
  novoUsuario,
  uuid,
} from '../../../helpers/cenarioSync';

/**
 * Troca de usuário no mesmo aparelho (ADR 10.19): quem entra não deve herdar,
 * no banco local, os dados que a pessoa anterior baixou.
 */
async function aparelhoDoTecnico() {
  const c = await aparelhoLogado();
  // O técnico já sincronizou: há uma leitura dele, com foto, já na nuvem.
  const leitura = novaLeitura();
  comFotoNoAparelho(c, leitura);
  leitura.marcarSincronizada('empresa/endereco/100.jpg');
  await c.fakes.leitura.salvar(leitura);
  await c.fakes.syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, IDS.tecnico.value);
  await c.fakes.syncMeta.definir(CHAVE_CURSORES, '{"leituras":"x"}');

  const maria = novoUsuario({
    id: uuid(42), nome: 'Maria', usuario: 'maria', email: 'maria@equinox.dev',
  });
  c.fakes.autenticacaoRemota.registrarConta(maria, SENHA);
  return { c, leitura };
}

describe('troca de usuário no aparelho', () => {
  it('outra pessoa entra com rede e fila vazia: os dados locais e as fotos saem', async () => {
    const { c, leitura } = await aparelhoDoTecnico();

    const saida = await c.casos.autenticar.executar({ login: 'maria@equinox.dev', senha: SENHA });

    expect(saida.sucesso).toBe(true);
    expect(c.fakes.leitura.items.size).toBe(0);
    expect(c.fakes.endereco.items.size).toBe(0);
    expect(c.fakes.empresa.items.size).toBe(0);
    expect(c.fakes.arquivoFoto.salvos.has(leitura.fotoLocalUri)).toBe(false);
    // O próximo pull recomeça do zero, no escopo de quem entrou.
    expect(await c.fakes.syncMeta.obter(CHAVE_CURSORES)).toBeNull();
    expect(await c.fakes.syncMeta.obter(CHAVE_USUARIO_DO_CURSOR)).toBe(uuid(42).value);
  });

  it('com itens ainda na fila, nada é apagado: eles esperam o dono', async () => {
    const { c } = await aparelhoDoTecnico();
    const pendente = novaLeitura({ id: uuid(101), medidoEm: new Date(Date.UTC(2026, 2, 9, 15)) });
    comFotoNoAparelho(c, pendente);
    await c.repos.leitura.salvar(pendente);

    await c.casos.autenticar.executar({ login: 'maria@equinox.dev', senha: SENHA });

    expect(c.fakes.leitura.items.size).toBe(2);
    expect(await c.fakes.actionQueue.contar()).toBe(1);
  });

  it('o mesmo usuário entrando de novo não perde nada', async () => {
    const { c } = await aparelhoDoTecnico();

    await c.casos.autenticar.executar({ login: 'tecnico@equinox.dev', senha: SENHA });

    expect(c.fakes.leitura.items.size).toBe(1);
    expect(await c.fakes.syncMeta.obter(CHAVE_CURSORES)).toBe('{"leituras":"x"}');
  });

  it('sem rede, não apaga: não daria para baixar de novo', async () => {
    const { c } = await aparelhoDoTecnico();
    // O técnico já entrou com senha aqui, então pode entrar offline depois.
    await c.casos.autenticar.executar({ login: 'tecnico@equinox.dev', senha: SENHA });
    // A Maria entra com rede (limpa) e baixa os dados dela.
    await c.casos.autenticar.executar({ login: 'maria@equinox.dev', senha: SENHA });
    await c.fakes.leitura.salvar(novaLeitura({ id: uuid(102) }));
    c.fakes.autenticacaoRemota.online = false;

    const saida = await c.casos.autenticar.executar({ login: 'tecnico@equinox.dev', senha: SENHA });

    expect(saida.offline).toBe(true);
    expect(c.fakes.leitura.items.size).toBe(1);
  });

  it('primeiro login do aparelho também limpa: o seed local é de todas as empresas', async () => {
    const { c } = await aparelhoDoTecnico();
    await c.fakes.syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, null);

    await c.casos.autenticar.executar({ login: 'maria@equinox.dev', senha: SENHA });

    expect(c.fakes.empresa.items.size).toBe(0);
  });
});
