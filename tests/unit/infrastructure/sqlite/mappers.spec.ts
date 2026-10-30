import {
  empresaDeRow, empresaParaRow,
  enderecoDeRow, enderecoParaRow,
  padraoDeRow, padraoParaRow,
  usuarioDeRow, usuarioParaRow,
  leituraDeRow, leituraParaRow,
  notificacaoDeRow, notificacaoParaRow,
} from '@/infrastructure/database/sqlite/mappers/mappers';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura, LeituraProps } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';

const MEDIDO_EM = new Date(Date.UTC(2026, 2, 9, 15));
const senha = () => new SenhaHash('sha256-iter', 10_000, 'a'.repeat(32), 'b'.repeat(64));

describe('mappers SQLite', () => {
  describe('Empresa', () => {
    it('faz a ida e volta sem perda', () => {
      const original = new Empresa({
        id: UUIDv4.gerar(), nome: 'Equinox Energia Solar',
        cnpj: new CNPJ('19.131.243/0001-97'), dataCriacao: MEDIDO_EM,
      });

      const volta = empresaDeRow(empresaParaRow(original));

      expect(volta.id.equals(original.id)).toBe(true);
      expect(volta.nome).toBe(original.nome);
      expect(volta.cnpj.equals(original.cnpj)).toBe(true);
    });

    it('guarda o CNPJ só com dígitos', () => {
      const empresa = new Empresa({
        id: UUIDv4.gerar(), nome: 'X', cnpj: new CNPJ('19.131.243/0001-97'),
      });
      expect(empresaParaRow(empresa).cnpj).toBe('19131243000197');
    });
  });

  describe('Endereco', () => {
    const completo = () =>
      new Endereco({
        id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(),
        apelido: 'Sede', uc: '3001234567',
        rua: 'Avenida Afonso Pena', numero: '1500', bairro: 'Centro', cidade: 'Belo Horizonte',
        ehUsina: true, coordenadas: new CoordenadasGPS(-19.9191, -43.9386),
        criadoEm: MEDIDO_EM,
      });

    it('faz a ida e volta sem perda', () => {
      const original = completo();
      const volta = enderecoDeRow(enderecoParaRow(original));

      expect(volta.apelido).toBe(original.apelido);
      expect(volta.uc).toBe(original.uc);
      expect(volta.ehUsina).toBe(true);
      expect(volta.logradouro()).toBe(original.logradouro());
      expect(volta.coordenadas?.equals(original.coordenadas!)).toBe(true);
    });

    it('converte eh_usina para 0 e 1, porque SQLite não tem booleano', () => {
      expect(enderecoParaRow(completo()).eh_usina).toBe(1);
      const comum = new Endereco({
        id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(), apelido: 'X', uc: '1',
      });
      expect(enderecoParaRow(comum).eh_usina).toBe(0);
    });

    it('endereço sem coordenada volta sem geocerca', () => {
      const semGeocerca = new Endereco({
        id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(), apelido: 'X', uc: '1',
      });
      const row = enderecoParaRow(semGeocerca);
      expect(row.latitude).toBeNull();
      expect(enderecoDeRow(row).temGeocerca()).toBe(false);
    });

    it('latitude sozinha não forma geocerca', () => {
      const row = { ...enderecoParaRow(completo()), longitude: null };
      expect(enderecoDeRow(row).temGeocerca()).toBe(false);
    });

    it('os campos opcionais vazios voltam como nulo', () => {
      const parcial = new Endereco({
        id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(), apelido: 'X', uc: '1', cidade: 'Contagem',
      });
      const volta = enderecoDeRow(enderecoParaRow(parcial));
      expect(volta.rua).toBeNull();
      expect(volta.cidade).toBe('Contagem');
    });
  });

  it('PadraoCemig faz a ida e volta sem perda', () => {
    const original = new PadraoCemig({
      id: UUIDv4.gerar(), enderecoId: UUIDv4.gerar(), numero: '778811', criadoEm: MEDIDO_EM,
    });
    const volta = padraoDeRow(padraoParaRow(original));

    expect(volta.numero).toBe('778811');
    expect(volta.enderecoId.equals(original.enderecoId)).toBe(true);
  });

  describe('Usuario', () => {
    const base = (perfil: PerfilEnum, empresaId: UUIDv4 | null) =>
      new Usuario({
        id: UUIDv4.gerar(), empresaId, nome: 'João da Silva', usuario: 'joao',
        email: 'joao@equinox.dev', senha: senha(), perfil,
        status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
        criadoEm: MEDIDO_EM,
      });

    it('faz a ida e volta sem perda', () => {
      const original = base(PerfilEnum.TECNICO, UUIDv4.gerar());
      const vinculos = original.enderecosVinculados;

      const volta = usuarioDeRow(usuarioParaRow(original), vinculos);

      expect(volta.nome).toBe(original.nome);
      expect(volta.usuario).toBe(original.usuario);
      expect(volta.email).toBe(original.email);
      expect(volta.perfil).toBe(PerfilEnum.TECNICO);
      expect(volta.senha.equals(original.senha)).toBe(true);
      expect(volta.enderecosVinculados).toHaveLength(1);
    });

    it.each([
      [PerfilEnum.TECNICO, 1],
      [PerfilEnum.ADMIN, 2],
      [PerfilEnum.SUPER_ADMIN, 3],
    ])('%s é gravado como nível %i', (perfil, nivel) => {
      const empresaId = perfil === PerfilEnum.SUPER_ADMIN ? null : UUIDv4.gerar();
      expect(usuarioParaRow(base(perfil, empresaId)).nivel_acesso).toBe(nivel);
    });

    it('o super admin é gravado sem empresa', () => {
      expect(usuarioParaRow(base(PerfilEnum.SUPER_ADMIN, null)).empresa_id).toBeNull();
    });

    it('a senha vai serializada numa coluna e não contém texto limpo', () => {
      const row = usuarioParaRow(base(PerfilEnum.TECNICO, UUIDv4.gerar()));
      expect(row.senha_hash).toBe(senha().serializar());
      expect(row.senha_hash.split('$')).toHaveLength(4);
    });

    it('preserva o perfil anterior de quem foi recusado', () => {
      const usuario = base(PerfilEnum.ADMIN, UUIDv4.gerar());
      usuario.recusar();

      const volta = usuarioDeRow(usuarioParaRow(usuario), []);

      expect(volta.status).toBe(StatusUsuarioEnum.RECUSADO);
      expect(volta.perfilAnterior).toBe(PerfilEnum.ADMIN);
    });
  });

  describe('Leitura', () => {
    const base = (sobrescrita: Partial<LeituraProps> = {}) =>
      new Leitura({
        id: UUIDv4.gerar(), padraoId: UUIDv4.gerar(), usuarioId: UUIDv4.gerar(),
        valorConsumo: new ValorKwh(12_345),
        fotoLocalUri: 'file:///documents/leituras/foto.jpg',
        medidoEm: MEDIDO_EM, dataLocal: DataLocal.de(MEDIDO_EM),
        ...sobrescrita,
      });

    it('faz a ida e volta sem perda', () => {
      const original = base({
        valorInjecao: new ValorKwh(8_421),
        coordenadas: new CoordenadasGPS(-19.9191, -43.9386, 8),
      });

      const volta = leituraDeRow(leituraParaRow(original));

      expect(volta.valorConsumo.valor).toBe(12_345);
      expect(volta.valorInjecao?.valor).toBe(8_421);
      expect(volta.fotoLocalUri).toBe(original.fotoLocalUri);
      expect(volta.dataLocal.value).toBe(original.dataLocal.value);
      expect(volta.medidoEm.getTime()).toBe(MEDIDO_EM.getTime());
      expect(volta.coordenadas?.precisaoMetros).toBe(8);
    });

    it('leitura sem injeção volta com injeção nula', () => {
      const volta = leituraDeRow(leituraParaRow(base()));
      expect(volta.valorInjecao).toBeNull();
      expect(volta.ehDeUsina()).toBe(false);
    });

    it('leitura sem GPS volta sem coordenadas', () => {
      const row = leituraParaRow(base());
      expect(row.latitude).toBeNull();
      expect(leituraDeRow(row).temLocalizacao()).toBe(false);
    });

    it('preserva os rastros da substituição', () => {
      const antiga = base();
      const nova = base();
      const quando = new Date(Date.UTC(2026, 2, 9, 18));
      antiga.substituirPor(nova, quando);

      const volta = leituraDeRow(leituraParaRow(antiga));

      expect(volta.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
      expect(volta.estaVigente()).toBe(false);
      expect(volta.substituidaPorId?.equals(nova.id)).toBe(true);
      expect(volta.substituidaEm?.getTime()).toBe(quando.getTime());
    });

    it('preserva os rastros da decisão do administrador', () => {
      const leitura = base();
      const adminId = UUIDv4.gerar();
      const quando = new Date(Date.UTC(2026, 2, 10, 12));
      leitura.aprovar(adminId, quando);

      const volta = leituraDeRow(leituraParaRow(leitura));

      expect(volta.status).toBe(StatusLeituraEnum.APROVADA);
      expect(volta.decididaPorId?.equals(adminId)).toBe(true);
      expect(volta.decididaEm?.getTime()).toBe(quando.getTime());
    });

    it('uma leitura já decidida não aceita ser decidida de novo depois de voltar do banco', () => {
      const leitura = base();
      leitura.aprovar(UUIDv4.gerar(), MEDIDO_EM);

      const volta = leituraDeRow(leituraParaRow(leitura));

      expect(() => volta.descartar(UUIDv4.gerar(), MEDIDO_EM)).toThrow(
        'Esta leitura já foi decidida',
      );
    });
  });

  describe('Notificacao', () => {
    const informativa = () =>
      new Notificacao({
        id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(),
        tipo: TipoNotificacaoEnum.LEITURA_SEM_GPS,
        titulo: 'Leitura sem GPS', mensagem: 'A foto segue como comprovante.',
        criadaEm: MEDIDO_EM,
      });

    it('faz a ida e volta sem perda', () => {
      const original = informativa();
      const volta = notificacaoDeRow(notificacaoParaRow(original));

      expect(volta.titulo).toBe(original.titulo);
      expect(volta.mensagem).toBe(original.mensagem);
      expect(volta.tipo).toBe(TipoNotificacaoEnum.LEITURA_SEM_GPS);
      expect(volta.lida).toBe(false);
      expect(volta.requerAcao).toBe(false);
    });

    it('preserva a resolução e quem resolveu', () => {
      const comAcao = new Notificacao({
        ...{
          id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(),
          tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
          titulo: 'Atrasada', mensagem: 'Confirme ou descarte.', criadaEm: MEDIDO_EM,
        },
        requerAcao: true,
        leituraId: UUIDv4.gerar(),
      });
      const adminId = UUIDv4.gerar();
      comAcao.resolver(ResolucaoEnum.APROVADA, adminId, MEDIDO_EM);

      const volta = notificacaoDeRow(notificacaoParaRow(comAcao));

      expect(volta.resolucao).toBe(ResolucaoEnum.APROVADA);
      expect(volta.resolvidaPorId?.equals(adminId)).toBe(true);
      expect(volta.aguardandoDecisao).toBe(false);
      expect(volta.lida).toBe(true);
    });

    it('notificação global volta sem empresa', () => {
      const global = new Notificacao({
        id: UUIDv4.gerar(), empresaId: null,
        tipo: TipoNotificacaoEnum.CADASTRO_PENDENTE,
        titulo: 'Novo cadastro', mensagem: 'Há cadastro aguardando.', criadaEm: MEDIDO_EM,
      });
      expect(notificacaoDeRow(notificacaoParaRow(global)).empresaId).toBeNull();
    });
  });
});
