import { migrar } from '@/infrastructure/database/sqlite/migrar';
import { migracaoSchemaInicial } from '@/infrastructure/database/sqlite/migrations/001_schema_inicial';
import { migracaoSincronizacao } from '@/infrastructure/database/sqlite/migrations/003_sincronizacao';
import { EmpresaRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/EmpresaRepositorySQLite';
import { EnderecoRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/EnderecoRepositorySQLite';
import { PadraoRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/PadraoRepositorySQLite';
import { LeituraRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/LeituraRepositorySQLite';
import { UsuarioRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/UsuarioRepositorySQLite';
import { NotificacaoRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/NotificacaoRepositorySQLite';
import { ActionQueueRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/ActionQueueRepositorySQLite';
import { DiagnosticoLocalSQLite } from '@/infrastructure/database/sqlite/DiagnosticoLocalSQLite';
import { criarContainerSQLite } from '@/infrastructure/di/criarContainerSQLite';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Leitura } from '@/domain/entities/Leitura';
import { Usuario } from '@/domain/entities/Usuario';
import { Notificacao } from '@/domain/entities/Notificacao';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { relogioFixo } from '@/domain/services/Relogio';
import { abrirBancoDeTeste, BancoDeTeste } from '../../helpers/bancoDeTeste';

// O container de produção cria o cliente do Supabase. Aqui ele é trocado por
// um objeto inerte: nenhum teste fala com a nuvem, e o cliente de verdade
// ligaria um temporizador de renovação de token.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
  })),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));

const HOJE = new Date('2026-10-30T15:00:00.000Z');
const ONTEM = new Date('2026-10-29T15:00:00.000Z');

/** Identificadores legíveis e válidos como UUIDv4, para o teste ficar diffável. */
const id = (n: number) => new UUIDv4(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

const EMPRESA = id(1);
const ENDERECO = id(2);
const USINA = id(3);
const PADRAO = id(4);
const PADRAO_USINA = id(5);
const TECNICO = id(6);
const ADMIN = id(7);

const senha = () => new SenhaHash('fake-sha', 1000, 'f'.repeat(32), 'a'.repeat(64));

function empresa(sobrescrita: Partial<{ id: UUIDv4; nome: string; cnpj: string }> = {}) {
  return new Empresa({
    id: sobrescrita.id ?? EMPRESA,
    nome: sobrescrita.nome ?? 'Equinox Energia Solar',
    cnpj: new CNPJ(sobrescrita.cnpj ?? '11222333000181'),
    dataCriacao: ONTEM,
  });
}

function endereco(sobrescrita: Partial<ConstructorParameters<typeof Endereco>[0]> = {}) {
  return new Endereco({
    id: ENDERECO,
    empresaId: EMPRESA,
    apelido: 'Sede administrativa',
    uc: '3001234567',
    rua: 'Avenida Afonso Pena',
    numero: '1500',
    bairro: 'Centro',
    cidade: 'Belo Horizonte',
    coordenadas: new CoordenadasGPS(-19.9191, -43.9386, 10, HOJE),
    criadoEm: ONTEM,
    ...sobrescrita,
  });
}

function padrao(sobrescrita: Partial<ConstructorParameters<typeof PadraoCemig>[0]> = {}) {
  return new PadraoCemig({
    id: PADRAO,
    enderecoId: ENDERECO,
    numero: '778811',
    criadoEm: ONTEM,
    ...sobrescrita,
  });
}

function usuario(sobrescrita: Partial<ConstructorParameters<typeof Usuario>[0]> = {}) {
  return new Usuario({
    id: TECNICO,
    empresaId: EMPRESA,
    nome: 'João da Silva',
    usuario: 'tecnico',
    email: 'tecnico@equinox.dev',
    senha: senha(),
    perfil: PerfilEnum.TECNICO,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [ENDERECO],
    criadoEm: ONTEM,
    ...sobrescrita,
  });
}

function leitura(sobrescrita: Partial<ConstructorParameters<typeof Leitura>[0]> = {}) {
  return new Leitura({
    id: id(100),
    padraoId: PADRAO,
    usuarioId: TECNICO,
    valorConsumo: new ValorKwh(11_150),
    fotoLocalUri: 'file:///documents/leituras/l1.jpg',
    coordenadas: new CoordenadasGPS(-19.9191, -43.9386, 8, HOJE),
    medidoEm: HOJE,
    dataLocal: DataLocal.de(HOJE),
    ...sobrescrita,
  });
}

function notificacao(sobrescrita: Partial<ConstructorParameters<typeof Notificacao>[0]> = {}) {
  return new Notificacao({
    id: id(200),
    empresaId: EMPRESA,
    tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
    titulo: 'Leitura atrasada',
    mensagem: 'Leitura de 7 dias atrás aguardando decisão.',
    criadaEm: HOJE,
    ...sobrescrita,
  });
}

describe('repositórios SQLite (banco de verdade)', () => {
  let banco: BancoDeTeste;
  let empresas: EmpresaRepositorySQLite;
  let enderecos: EnderecoRepositorySQLite;
  let padroes: PadraoRepositorySQLite;
  let leituras: LeituraRepositorySQLite;
  let usuarios: UsuarioRepositorySQLite;
  let notificacoes: NotificacaoRepositorySQLite;
  let fila: ActionQueueRepositorySQLite;

  beforeEach(async () => {
    banco = abrirBancoDeTeste();
    // Só o schema, sem o seed: cada teste monta exatamente o que precisa.
    // Schema inicial + colunas de sincronização, sem o seed (versão 2): cada
    // teste monta o próprio cenário.
    await migrar(banco.db, [migracaoSchemaInicial, { ...migracaoSincronizacao, versao: 2 }]);

    empresas = new EmpresaRepositorySQLite(banco.db);
    enderecos = new EnderecoRepositorySQLite(banco.db);
    padroes = new PadraoRepositorySQLite(banco.db);
    leituras = new LeituraRepositorySQLite(banco.db);
    usuarios = new UsuarioRepositorySQLite(banco.db);
    notificacoes = new NotificacaoRepositorySQLite(banco.db);
    fila = new ActionQueueRepositorySQLite(banco.db);
  });

  afterEach(() => {
    banco.fechar();
  });

  /** Mínimo para uma leitura existir: empresa, endereço, padrão e usuário. */
  const montarCenario = async () => {
    await empresas.salvar(empresa());
    await enderecos.salvar(endereco());
    await padroes.salvar(padrao());
    await usuarios.salvar(usuario());
  };

  describe('empresas', () => {
    it('salva e lê de volta, preservando o CNPJ e a data', async () => {
      await empresas.salvar(empresa());

      const lida = await empresas.buscarPorId(EMPRESA);

      expect(lida?.nome).toBe('Equinox Energia Solar');
      expect(lida?.cnpj.valorLimpo).toBe('11222333000181');
      expect(lida?.dataCriacao.toISOString()).toBe(ONTEM.toISOString());
    });

    it('devolve null para id que não existe', async () => {
      expect(await empresas.buscarPorId(id(999))).toBeNull();
    });

    it('lista todas', async () => {
      await empresas.salvar(empresa());
      await empresas.salvar(empresa({ id: id(10), nome: 'Condomínio', cnpj: '99888777000100' }));

      expect((await empresas.listarTodas()).map((e) => e.nome).sort()).toEqual([
        'Condomínio', 'Equinox Energia Solar',
      ]);
    });

    it('recusa CNPJ repetido, porque o banco tem UNIQUE', async () => {
      await empresas.salvar(empresa());

      // Mesmo CNPJ, id diferente: o UPSERT por id não cobre este caso.
      await expect(empresas.salvar(empresa({ id: id(11), nome: 'Clone' }))).rejects.toThrow(
        /UNIQUE/i,
      );
    });
  });

  describe('endereços', () => {
    beforeEach(async () => {
      await empresas.salvar(empresa());
    });

    it('preserva as coordenadas e a flag de usina na volta', async () => {
      await enderecos.salvar(endereco({ id: USINA, apelido: 'Usina Pampulha', ehUsina: true }));

      const lido = await enderecos.buscarPorId(USINA);

      expect(lido?.ehUsina).toBe(true);
      expect(lido?.coordenadas?.latitude).toBeCloseTo(-19.9191);
      expect(lido?.coordenadas?.longitude).toBeCloseTo(-43.9386);
      // O cadastro guarda o ponto, não a precisão: precisão é da medição do
      // aparelho, e o schema de enderecos não tem a coluna de propósito.
      expect(lido?.coordenadas?.precisaoMetros).toBeNull();
    });

    it('aceita endereço sem coordenada, que é o que desliga a geocerca', async () => {
      await enderecos.salvar(endereco({ id: id(20), coordenadas: null }));

      const lido = await enderecos.buscarPorId(id(20));

      // Null de verdade, não zero: 0,0 é um ponto no Atlântico.
      expect(lido?.coordenadas).toBeNull();
    });

    it('lista por empresa e ignora a de outra empresa', async () => {
      await empresas.salvar(empresa({ id: id(12), nome: 'Outra', cnpj: '99888777000100' }));
      await enderecos.salvar(endereco());
      await enderecos.salvar(endereco({ id: id(21), empresaId: id(12), apelido: 'De outra' }));

      expect((await enderecos.listarPorEmpresa(EMPRESA)).map((e) => e.apelido)).toEqual([
        'Sede administrativa',
      ]);
    });

    it('lista só os endereços vinculados ao usuário', async () => {
      await enderecos.salvar(endereco());
      await enderecos.salvar(endereco({ id: id(22), apelido: 'Depósito Contagem' }));
      await usuarios.salvar(usuario({ enderecosVinculados: [id(22)] }));

      expect((await enderecos.listarPorUsuario(TECNICO)).map((e) => e.apelido)).toEqual([
        'Depósito Contagem',
      ]);
    });

    it('atualiza em vez de duplicar', async () => {
      await enderecos.salvar(endereco());

      const alterado = endereco({ apelido: 'Sede nova' });
      await enderecos.atualizar(alterado);

      expect(await enderecos.listarTodos()).toHaveLength(1);
      expect((await enderecos.buscarPorId(ENDERECO))?.apelido).toBe('Sede nova');
    });

    it('excluir leva os padrões junto', async () => {
      await enderecos.salvar(endereco());
      await padroes.salvar(padrao());

      await enderecos.excluir(ENDERECO);

      expect(await padroes.listarPorEndereco(ENDERECO)).toEqual([]);
    });
  });

  describe('padrões', () => {
    beforeEach(async () => {
      await empresas.salvar(empresa());
      await enderecos.salvar(endereco());
    });

    it('salva e lê', async () => {
      await padroes.salvar(padrao());
      expect((await padroes.buscarPorId(PADRAO))?.numero).toBe('778811');
    });

    it('recusa número repetido no mesmo endereço', async () => {
      await padroes.salvar(padrao());

      await expect(padroes.salvar(padrao({ id: id(30) }))).rejects.toThrow(/UNIQUE/i);
    });

    it('aceita o mesmo número em endereços diferentes', async () => {
      await enderecos.salvar(endereco({ id: id(23), apelido: 'Outro' }));
      await padroes.salvar(padrao());

      await expect(
        padroes.salvar(padrao({ id: id(31), enderecoId: id(23) })),
      ).resolves.toBeUndefined();
    });

    it('lista por vários endereços de uma vez', async () => {
      await enderecos.salvar(endereco({ id: id(24), apelido: 'Outro' }));
      await padroes.salvar(padrao());
      await padroes.salvar(padrao({ id: id(32), enderecoId: id(24), numero: '993344' }));

      const achados = await padroes.listarPorEnderecos([ENDERECO, id(24)]);

      expect(achados.map((p) => p.numero).sort()).toEqual(['778811', '993344']);
    });

    it('lista vazio sem endereço nenhum, sem montar SQL inválido', async () => {
      expect(await padroes.listarPorEnderecos([])).toEqual([]);
    });
  });

  describe('usuários', () => {
    beforeEach(async () => {
      await empresas.salvar(empresa());
      await enderecos.salvar(endereco());
    });

    it('não grava senha nem hash dela: a coluna legada fica vazia', async () => {
      // O usuário do cenário ainda é construído com `senha` (como a migração
      // 002 faz); o repositório a ignora.
      await usuarios.salvar(usuario());

      const [linha] = banco.consultar<{ senha_hash: string }>(
        'SELECT senha_hash FROM usuarios WHERE id = ?',
        TECNICO.value,
      );

      expect(linha.senha_hash).toBe('');
      expect(await usuarios.buscarPorId(TECNICO)).not.toBeNull();
    });

    it('persiste os endereços vinculados na tabela N:N', async () => {
      await enderecos.salvar(endereco({ id: id(25), apelido: 'Segundo' }));
      await usuarios.salvar(usuario({ enderecosVinculados: [ENDERECO, id(25)] }));

      const lido = await usuarios.buscarPorId(TECNICO);

      expect(lido?.enderecosVinculados.map((e) => e.value).sort()).toEqual(
        [ENDERECO.value, id(25).value].sort(),
      );
    });

    it('troca os vínculos em vez de acumular', async () => {
      await enderecos.salvar(endereco({ id: id(26), apelido: 'Segundo' }));
      await usuarios.salvar(usuario({ enderecosVinculados: [ENDERECO] }));

      await usuarios.atualizar(usuario({ enderecosVinculados: [id(26)] }));

      expect((await usuarios.buscarPorId(TECNICO))?.enderecosVinculados.map((e) => e.value))
        .toEqual([id(26).value]);
    });

    it('busca por login aceita usuário ou e-mail, sem diferenciar maiúsculas', async () => {
      await usuarios.salvar(usuario());

      expect((await usuarios.buscarPorLogin('TECNICO'))?.id.value).toBe(TECNICO.value);
      expect((await usuarios.buscarPorLogin('Tecnico@Equinox.dev'))?.id.value)
        .toBe(TECNICO.value);
      expect(await usuarios.buscarPorLogin('ninguem')).toBeNull();
    });

    it('recusa dois usuários com o mesmo login', async () => {
      await usuarios.salvar(usuario());

      await expect(
        usuarios.salvar(usuario({ id: id(40), email: 'outro@equinox.dev' })),
      ).rejects.toThrow(/UNIQUE/i);
    });

    it('lista os pendentes, que é a fila da tela de autorização', async () => {
      await usuarios.salvar(usuario());
      await usuarios.salvar(
        usuario({
          id: id(41), nome: 'Maria Souza', usuario: 'maria', email: 'maria@equinox.dev',
          status: StatusUsuarioEnum.PENDENTE, enderecosVinculados: [],
        }),
      );

      expect((await usuarios.listarPendentes()).map((u) => u.nome)).toEqual(['Maria Souza']);
    });

    it('filtra por perfil, status e termo de busca', async () => {
      await usuarios.salvar(usuario());
      await usuarios.salvar(
        usuario({
          id: id(42), nome: 'Carlos Administrador', usuario: 'admin',
          email: 'admin@equinox.dev', perfil: PerfilEnum.ADMIN, enderecosVinculados: [],
        }),
      );

      expect((await usuarios.listarComFiltros({ perfil: PerfilEnum.ADMIN })).map((u) => u.usuario))
        .toEqual(['admin']);
      expect(
        (await usuarios.listarComFiltros({ status: StatusUsuarioEnum.ATIVO })).length,
      ).toBe(2);
      expect((await usuarios.listarComFiltros({ termoBusca: 'carlos' })).map((u) => u.usuario))
        .toEqual(['admin']);
    });

    it('excluir leva os vínculos junto', async () => {
      await usuarios.salvar(usuario());

      await usuarios.excluir(TECNICO);

      expect(await usuarios.buscarPorId(TECNICO)).toBeNull();
      expect(
        banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM usuario_enderecos')[0].n,
      ).toBe(0);
    });
  });

  describe('leituras', () => {
    beforeEach(montarCenario);

    it('salva e reconstrói a leitura inteira, com foto e coordenadas', async () => {
      await leituras.salvar(leitura());

      const lida = await leituras.buscarPorId(id(100));

      expect(lida?.valorConsumo.valor).toBe(11_150);
      expect(lida?.fotoLocalUri).toBe('file:///documents/leituras/l1.jpg');
      expect(lida?.coordenadas?.precisaoMetros).toBe(8);
      expect(lida?.dataLocal.value).toBe(DataLocal.de(HOJE).value);
      expect(lida?.status).toBe(StatusLeituraEnum.REGISTRADA);
    });

    it('guarda a injeção só quando ela existe', async () => {
      await enderecos.salvar(endereco({ id: USINA, apelido: 'Usina', ehUsina: true }));
      await padroes.salvar(padrao({ id: PADRAO_USINA, enderecoId: USINA, numero: '993344' }));

      await leituras.salvar(leitura());
      await leituras.salvar(
        leitura({
          id: id(101), padraoId: PADRAO_USINA, valorInjecao: new ValorKwh(4_200),
        }),
      );

      expect((await leituras.buscarPorId(id(100)))?.valorInjecao).toBeNull();
      expect((await leituras.buscarPorId(id(101)))?.valorInjecao?.valor).toBe(4_200);
    });

    it('aceita leitura sem GPS, que é válida em casa de medidor sem sinal', async () => {
      await leituras.salvar(leitura({ coordenadas: null }));

      const lida = await leituras.buscarPorId(id(100));

      expect(lida?.coordenadas).toBeNull();
      expect(lida?.temLocalizacao()).toBe(false);
    });

    it('acha a vigente do dia e ignora a de outro dia', async () => {
      await leituras.salvar(leitura({ medidoEm: ONTEM, dataLocal: DataLocal.de(ONTEM) }));
      await leituras.salvar(leitura({ id: id(101) }));

      const vigente = await leituras.buscarVigenteDoDia(PADRAO, DataLocal.de(HOJE));

      expect(vigente?.id.value).toBe(id(101).value);
    });

    it('substitui numa transação: a antiga sai do índice e a nova entra', async () => {
      const antiga = leitura();
      await leituras.salvar(antiga);

      const nova = leitura({ id: id(101), valorConsumo: new ValorKwh(11_600) });
      antiga.substituirPor(nova, HOJE);
      await leituras.salvarSubstituindo(nova, antiga);

      // O índice parcial só tolera isto se o UPDATE e o INSERT forem atômicos.
      expect((await leituras.buscarPorId(id(100)))?.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
      expect((await leituras.buscarVigenteDoDia(PADRAO, DataLocal.de(HOJE)))?.id.value)
        .toBe(id(101).value);
      expect(await leituras.listarDoPadrao(PADRAO)).toHaveLength(2);
    });

    it('não deixa o banco pela metade quando a substituição falha', async () => {
      await leituras.salvar(leitura());

      const nova = leitura({ id: id(101), padraoId: id(998) });
      const vigente = (await leituras.buscarPorId(id(100))) as Leitura;

      // Padrão inexistente: o INSERT viola a chave estrangeira.
      await expect(leituras.salvarSubstituindo(nova, vigente)).rejects.toThrow();

      // O UPDATE da antiga tem de voltar atrás, senão o dia fica sem vigente.
      expect((await leituras.buscarPorId(id(100)))?.status).toBe(StatusLeituraEnum.REGISTRADA);
    });

    it('lista as do padrão só com as vigentes quando pedido', async () => {
      const antiga = leitura();
      await leituras.salvar(antiga);
      const nova = leitura({ id: id(101) });
      antiga.substituirPor(nova, HOJE);
      await leituras.salvarSubstituindo(nova, antiga);

      expect(await leituras.listarVigentesDoPadrao(PADRAO)).toHaveLength(1);
      expect(await leituras.listarDoPadrao(PADRAO)).toHaveLength(2);
    });

    it('lista por usuário respeitando o limite', async () => {
      await leituras.salvar(leitura({ medidoEm: ONTEM, dataLocal: DataLocal.de(ONTEM) }));
      await leituras.salvar(leitura({ id: id(101) }));

      expect(await leituras.listarPorUsuario(TECNICO)).toHaveLength(2);
      expect(await leituras.listarPorUsuario(TECNICO, 1)).toHaveLength(1);
    });

    it('acha as registradas antes de um dia, que é a fila do atraso', async () => {
      await leituras.salvar(leitura({ medidoEm: ONTEM, dataLocal: DataLocal.de(ONTEM) }));
      await leituras.salvar(leitura({ id: id(101) }));

      const atrasadas = await leituras.listarRegistradasAntesDe(DataLocal.de(HOJE));

      expect(atrasadas.map((l) => l.dataLocal.value)).toEqual([DataLocal.de(ONTEM).value]);
    });

    it('expurga as já decididas e devolve o que apagou, para a foto sair junto', async () => {
      const decidida = leitura({ medidoEm: ONTEM, dataLocal: DataLocal.de(ONTEM) });
      decidida.aprovar(ADMIN, ONTEM);
      // Só sai do aparelho o que já está na nuvem.
      decidida.marcarSincronizada('empresa/endereco/l1.jpg');
      await usuarios.salvar(
        usuario({ id: ADMIN, usuario: 'admin', email: 'admin@equinox.dev', enderecosVinculados: [] }),
      );
      await leituras.atualizar(decidida);
      await leituras.salvar(decidida);
      await leituras.salvar(leitura({ id: id(101) }));

      const apagadas = await leituras.excluirDecididasAntesDe(DataLocal.de(HOJE));

      // A uri volta porque quem apaga o arquivo é a camada de aplicação.
      expect(apagadas.map((l) => l.fotoLocalUri)).toEqual([
        'file:///documents/leituras/l1.jpg',
      ]);
      expect(await leituras.listarDoPadrao(PADRAO)).toHaveLength(1);
    });

    it('não expurga a decidida que ainda não subiu para a nuvem', async () => {
      const decidida = leitura({ medidoEm: ONTEM, dataLocal: DataLocal.de(ONTEM) });
      decidida.aprovar(ADMIN, ONTEM);
      await usuarios.salvar(
        usuario({ id: ADMIN, usuario: 'admin', email: 'admin@equinox.dev', enderecosVinculados: [] }),
      );
      await leituras.salvar(decidida);

      expect(await leituras.excluirDecididasAntesDe(DataLocal.de(HOJE))).toEqual([]);
      expect(await leituras.buscarPorId(decidida.id)).not.toBeNull();
    });

    it('toda leitura nasce pendente de envio e sem foto remota', async () => {
      await leituras.salvar(leitura());

      const [linha] = banco.consultar<{ sync_status: string; foto_remota_path: string | null }>(
        'SELECT sync_status, foto_remota_path FROM leituras',
      );
      expect(linha).toEqual({ sync_status: 'pendente', foto_remota_path: null });
    });

    it('guarda e devolve o estado de sincronização e o caminho remoto da foto', async () => {
      const enviada = leitura();
      await leituras.salvar(enviada);

      enviada.marcarSincronizada('empresa/endereco/l1.jpg');
      await leituras.atualizar(enviada);

      const lida = await leituras.buscarPorId(enviada.id);
      expect(lida?.estaSincronizada()).toBe(true);
      expect(lida?.fotoRemotaPath).toBe('empresa/endereco/l1.jpg');
    });

    describe('aplicarRemota (pull)', () => {
      const remota = (sobrescrita: Parameters<typeof leitura>[0] = {}) => {
        const l = leitura({ fotoLocalUri: '', fotoRemotaPath: 'empresa/endereco/r.jpg', ...sobrescrita });
        l.marcarSincronizada('empresa/endereco/r.jpg');
        return l;
      };

      it('insere a leitura que só existia na nuvem', async () => {
        await leituras.aplicarRemota(remota({ id: id(150) }));

        const lida = await leituras.buscarPorId(id(150));
        expect(lida?.temFotoNoAparelho()).toBe(false);
        expect(lida?.fotoRemotaPath).toBe('empresa/endereco/r.jpg');
        expect(lida?.estaSincronizada()).toBe(true);
      });

      it('atualiza a que já existe e preserva a foto que está no aparelho', async () => {
        await leituras.salvar(leitura());
        const aprovada = remota();
        aprovada.aprovar(TECNICO, HOJE);

        await leituras.aplicarRemota(aprovada);

        const lida = await leituras.buscarPorId(aprovada.id);
        expect(lida?.status).toBe(StatusLeituraEnum.APROVADA);
        expect(lida?.fotoLocalUri).toBe('file:///documents/leituras/l1.jpg');
        expect(lida?.fotoRemotaPath).toBe('empresa/endereco/r.jpg');
      });

      it('quando a nuvem diz que outra leitura ocupa a vaga do dia, a local cede', async () => {
        await leituras.salvar(leitura());

        await leituras.aplicarRemota(remota({ id: id(151) }));

        const local = await leituras.buscarPorId(id(100));
        expect(local?.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
        expect(local?.substituidaPorId?.equals(id(151))).toBe(true);
        expect((await leituras.buscarVigenteDoDia(PADRAO, DataLocal.de(HOJE)))?.id.value).toBe(
          id(151).value,
        );
      });

      it('aplicar duas vezes dá no mesmo', async () => {
        await leituras.aplicarRemota(remota({ id: id(150) }));
        await leituras.aplicarRemota(remota({ id: id(150) }));

        expect(await leituras.listarDoPadrao(PADRAO)).toHaveLength(1);
      });
    });
  });

  describe('notificações', () => {
    beforeEach(montarCenario);

    it('salva e lê, preservando requerAcao e o vínculo com a leitura', async () => {
      await leituras.salvar(leitura());
      await notificacoes.salvar(notificacao({ requerAcao: true, leituraId: id(100) }));

      const lida = await notificacoes.buscarPorId(id(200));

      expect(lida?.requerAcao).toBe(true);
      expect(lida?.aguardandoDecisao).toBe(true);
      expect(lida?.leituraId?.value).toBe(id(100).value);
    });

    it('salva várias de uma vez', async () => {
      await notificacoes.salvarVarias([
        notificacao(),
        notificacao({ id: id(201), titulo: 'Leitura fora do local' }),
      ]);

      expect(await notificacoes.contarNaoLidas(EMPRESA)).toBe(2);
    });

    it('pagina por offset e limite', async () => {
      await notificacoes.salvarVarias([
        notificacao({ id: id(201), criadaEm: new Date('2026-10-28T10:00:00.000Z') }),
        notificacao({ id: id(202), criadaEm: new Date('2026-10-29T10:00:00.000Z') }),
        notificacao({ id: id(203), criadaEm: new Date('2026-10-30T10:00:00.000Z') }),
      ]);

      const pagina = await notificacoes.listar({ empresaId: EMPRESA, offset: 1, limite: 2 });

      // Mais recente primeiro: a página 2 começa na do dia 29.
      expect(pagina.map((n) => n.id.value)).toEqual([id(202).value, id(201).value]);
    });

    it('o escopo nulo do super admin vê as de todas as empresas', async () => {
      await empresas.salvar(empresa({ id: id(13), nome: 'Outra', cnpj: '99888777000100' }));
      await notificacoes.salvar(notificacao());
      await notificacoes.salvar(notificacao({ id: id(204), empresaId: id(13) }));

      expect(await notificacoes.contarNaoLidas(null)).toBe(2);
      expect(await notificacoes.contarNaoLidas(EMPRESA)).toBe(1);
    });

    it('marcar todas lidas zera o contador', async () => {
      await notificacoes.salvarVarias([notificacao(), notificacao({ id: id(205) })]);

      await notificacoes.marcarTodasLidas(EMPRESA);

      expect(await notificacoes.contarNaoLidas(EMPRESA)).toBe(0);
    });

    it('resolver grava quem decidiu e quando', async () => {
      await usuarios.salvar(
        usuario({ id: ADMIN, usuario: 'admin', email: 'admin@equinox.dev', enderecosVinculados: [] }),
      );
      await leituras.salvar(leitura());
      const n = notificacao({ requerAcao: true, leituraId: id(100) });
      await notificacoes.salvar(n);

      n.resolver(ResolucaoEnum.APROVADA, ADMIN, HOJE);
      await notificacoes.atualizar(n);

      const lida = await notificacoes.buscarPorId(id(200));
      expect(lida?.aguardandoDecisao).toBe(false);
      expect(lida?.resolvidaPorId?.value).toBe(ADMIN.value);
      expect(lida?.resolvidaEm?.toISOString()).toBe(HOJE.toISOString());
    });

    it('acha as notificações de uma leitura e some junto com ela', async () => {
      await leituras.salvar(leitura());
      await notificacoes.salvar(notificacao({ leituraId: id(100) }));

      expect(await notificacoes.buscarPorLeitura(id(100))).toHaveLength(1);

      banco.consultar("DELETE FROM leituras WHERE id = ?", id(100).value);

      expect(await notificacoes.buscarPorLeitura(id(100))).toHaveLength(0);
    });

    it('exclui uma', async () => {
      await notificacoes.salvar(notificacao());

      await notificacoes.excluir(id(200));

      expect(await notificacoes.buscarPorId(id(200))).toBeNull();
    });
  });

  describe('fila de envio', () => {
    const item = (n: number, quando = HOJE) =>
      new ActionQueueItem({
        id: id(n),
        tipoOperacao: 'UPSERT_LEITURA',
        payloadJSON: JSON.stringify({ id: id(100).value }),
        timestamp: quando,
      });

    it('enfileira, conta, registra a recusa com o motivo e remove', async () => {
      await fila.enfileirar(item(300));
      expect(await fila.contar()).toBe(1);

      await fila.registrarFalha(id(300), 'A nuvem recusou');
      const [lido] = await fila.obterPendentes();
      expect(lido.tentativas).toBe(1);
      expect(lido.ultimoErro).toBe('A nuvem recusou');
      expect(lido.registroId?.equals(id(100))).toBe(true);

      await fila.remover(id(300));
      expect(await fila.obterPendentes()).toEqual([]);
      expect(await fila.contar()).toBe(0);
    });

    it('devolve em ordem de criação, e a de inserção desempata', async () => {
      await fila.enfileirar(item(302, HOJE));
      await fila.enfileirar(item(301, ONTEM));
      await fila.enfileirar(item(303, HOJE));

      const ordem = (await fila.obterPendentes()).map((i) => i.id.value);
      expect(ordem).toEqual([id(301).value, id(302).value, id(303).value]);
    });

    it('reativa só os itens isolados', async () => {
      await fila.enfileirar(item(300));
      await fila.enfileirar(item(301));
      for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
        await fila.registrarFalha(id(300), 'recusa');
      }
      await fila.registrarFalha(id(301), 'uma só');

      await fila.reativarIsolados();

      const [isolado, outro] = await fila.obterPendentes();
      expect(isolado.tentativas).toBe(0);
      expect(isolado.ultimoErro).toBeNull();
      expect(outro.tentativas).toBe(1);
    });
  });

  describe('diagnóstico local', () => {
    it('conta o que está gravado e informa a versão do schema', async () => {
      await montarCenario();
      await leituras.salvar(leitura());
      await notificacoes.salvar(notificacao());

      const estado = await new DiagnosticoLocalSQLite(banco.db, 'equinox.db').coletar();

      expect(estado).toEqual({
        nomeDoArquivo: 'equinox.db',
        versaoDoSchema: 2,
        contagens: {
          empresas: 1, enderecos: 1, padroes: 1, usuarios: 1,
          vinculos: 1, leituras: 1, notificacoes: 1,
        },
      });
    });
  });

  describe('container de produção', () => {
    it('monta tudo sobre o banco aberto, sem nenhuma tela instanciar nada', async () => {
      await montarCenario();

      const container = criarContainerSQLite(banco.db, relogioFixo(HOJE), 'equinox.db', {
        url: 'https://projeto-de-teste.supabase.co',
        chaveAnonima: 'chave-anonima-de-teste',
      });

      // Prova que a fiação está certa de ponta a ponta: um caso de uso montado
      // pelo container lê o que o repositório gravou no SQLite.
      const catalogo = await container.casos.consultarCatalogo.executar({
        usuarioId: TECNICO.value,
      });

      expect(catalogo.enderecos.map((e) => e.apelido)).toEqual(['Sede administrativa']);
      expect(container.gateways.diagnostico).toBeInstanceOf(DiagnosticoLocalSQLite);
      expect(container.cameraGatewayExpo).toBe(container.gateways.camera);
    });
  });
});
