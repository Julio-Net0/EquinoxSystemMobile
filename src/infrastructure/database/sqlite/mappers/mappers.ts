import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';
import { PerfilEnum, NivelAcesso, nivelDe, perfilDeNivel } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';

/** SQLite não tem booleano: 0/1. */
const paraBool = (valor: number): boolean => valor === 1;
const deBool = (valor: boolean): number => (valor ? 1 : 0);

const paraData = (iso: string | null): Date | null => (iso ? new Date(iso) : null);
const deData = (data: Date | null): string | null => data?.toISOString() ?? null;

const paraUUID = (valor: string | null): UUIDv4 | null => (valor ? new UUIDv4(valor) : null);

// ---------------------------------------------------------------- Empresa

export interface EmpresaRow {
  id: string;
  nome: string;
  cnpj: string;
  criado_em: string;
}

export const empresaDeRow = (row: EmpresaRow): Empresa =>
  new Empresa({
    id: new UUIDv4(row.id),
    nome: row.nome,
    cnpj: new CNPJ(row.cnpj),
    dataCriacao: new Date(row.criado_em),
  });

export const empresaParaRow = (empresa: Empresa): EmpresaRow => ({
  id: empresa.id.value,
  nome: empresa.nome,
  cnpj: empresa.cnpj.valorLimpo,
  criado_em: empresa.dataCriacao.toISOString(),
});

// --------------------------------------------------------------- Endereco

export interface EnderecoRow {
  id: string;
  empresa_id: string;
  apelido: string;
  uc: string;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  eh_usina: number;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
}

export const enderecoDeRow = (row: EnderecoRow): Endereco =>
  new Endereco({
    id: new UUIDv4(row.id),
    empresaId: new UUIDv4(row.empresa_id),
    apelido: row.apelido,
    uc: row.uc,
    rua: row.rua,
    numero: row.numero,
    bairro: row.bairro,
    cidade: row.cidade,
    ehUsina: paraBool(row.eh_usina),
    // Só vira geocerca quando as duas coordenadas existem.
    coordenadas:
      row.latitude !== null && row.longitude !== null
        ? new CoordenadasGPS(row.latitude, row.longitude)
        : null,
    criadoEm: new Date(row.criado_em),
  });

export const enderecoParaRow = (endereco: Endereco): EnderecoRow => ({
  id: endereco.id.value,
  empresa_id: endereco.empresaId.value,
  apelido: endereco.apelido,
  uc: endereco.uc,
  rua: endereco.rua,
  numero: endereco.numero,
  bairro: endereco.bairro,
  cidade: endereco.cidade,
  eh_usina: deBool(endereco.ehUsina),
  latitude: endereco.coordenadas?.latitude ?? null,
  longitude: endereco.coordenadas?.longitude ?? null,
  criado_em: endereco.criadoEm.toISOString(),
});

// ------------------------------------------------------------ PadraoCemig

export interface PadraoRow {
  id: string;
  endereco_id: string;
  numero: string;
  criado_em: string;
}

export const padraoDeRow = (row: PadraoRow): PadraoCemig =>
  new PadraoCemig({
    id: new UUIDv4(row.id),
    enderecoId: new UUIDv4(row.endereco_id),
    numero: row.numero,
    criadoEm: new Date(row.criado_em),
  });

export const padraoParaRow = (padrao: PadraoCemig): PadraoRow => ({
  id: padrao.id.value,
  endereco_id: padrao.enderecoId.value,
  numero: padrao.numero,
  criado_em: padrao.criadoEm.toISOString(),
});

// ---------------------------------------------------------------- Usuario

export interface UsuarioRow {
  id: string;
  empresa_id: string | null;
  nome: string;
  usuario: string;
  email: string;
  senha_hash: string;
  nivel_acesso: number;
  nivel_anterior: number | null;
  status: string;
  criado_em: string;
  autorizado_em: string | null;
  autorizado_por: string | null;
}

export const usuarioDeRow = (row: UsuarioRow, enderecosVinculados: UUIDv4[]): Usuario =>
  new Usuario({
    id: new UUIDv4(row.id),
    empresaId: paraUUID(row.empresa_id),
    nome: row.nome,
    usuario: row.usuario,
    email: row.email,
    senha: SenhaHash.deSerializado(row.senha_hash),
    perfil: perfilDeNivel(row.nivel_acesso as NivelAcesso),
    status: row.status as StatusUsuarioEnum,
    enderecosVinculados,
    perfilAnterior:
      row.nivel_anterior === null ? null : perfilDeNivel(row.nivel_anterior as NivelAcesso),
    criadoEm: new Date(row.criado_em),
    autorizadoEm: paraData(row.autorizado_em),
    autorizadoPorId: paraUUID(row.autorizado_por),
  });

export const usuarioParaRow = (usuario: Usuario): UsuarioRow => ({
  id: usuario.id.value,
  empresa_id: usuario.empresaId?.value ?? null,
  nome: usuario.nome,
  usuario: usuario.usuario,
  email: usuario.email,
  senha_hash: usuario.senha.serializar(),
  nivel_acesso: nivelDe(usuario.perfil),
  nivel_anterior: usuario.perfilAnterior ? nivelDe(usuario.perfilAnterior) : null,
  status: usuario.status,
  criado_em: usuario.criadoEm.toISOString(),
  autorizado_em: deData(usuario.autorizadoEm),
  autorizado_por: usuario.autorizadoPorId?.value ?? null,
});

// ---------------------------------------------------------------- Leitura

export interface LeituraRow {
  id: string;
  padrao_id: string;
  usuario_id: string;
  valor_consumo: number;
  valor_injecao: number | null;
  foto_local_uri: string;
  latitude: number | null;
  longitude: number | null;
  precisao_metros: number | null;
  medido_em: string;
  data_local: string;
  status: string;
  substituida_em: string | null;
  substituida_por_id: string | null;
  decidida_em: string | null;
  decidida_por_id: string | null;
}

/**
 * Reconstrói a leitura e reaplica as transições de estado, porque `status`,
 * `substituida*` e `decidida*` são privados na entidade — é o que garante que
 * um registro vindo do banco respeite as mesmas regras de transição.
 */
export const leituraDeRow = (row: LeituraRow): Leitura => {
  const leitura = new Leitura({
    id: new UUIDv4(row.id),
    padraoId: new UUIDv4(row.padrao_id),
    usuarioId: new UUIDv4(row.usuario_id),
    valorConsumo: new ValorKwh(row.valor_consumo),
    valorInjecao: row.valor_injecao === null ? null : new ValorKwh(row.valor_injecao),
    fotoLocalUri: row.foto_local_uri,
    coordenadas:
      row.latitude !== null && row.longitude !== null
        ? new CoordenadasGPS(row.latitude, row.longitude, row.precisao_metros)
        : null,
    medidoEm: new Date(row.medido_em),
    dataLocal: DataLocal.parse(row.data_local),
    status: row.status as StatusLeituraEnum,
  });

  return leitura;
};

export const leituraParaRow = (leitura: Leitura): LeituraRow => ({
  id: leitura.id.value,
  padrao_id: leitura.padraoId.value,
  usuario_id: leitura.usuarioId.value,
  valor_consumo: leitura.valorConsumo.valor,
  valor_injecao: leitura.valorInjecao?.valor ?? null,
  foto_local_uri: leitura.fotoLocalUri,
  latitude: leitura.coordenadas?.latitude ?? null,
  longitude: leitura.coordenadas?.longitude ?? null,
  precisao_metros: leitura.coordenadas?.precisaoMetros ?? null,
  medido_em: leitura.medidoEm.toISOString(),
  data_local: leitura.dataLocal.value,
  status: leitura.status,
  substituida_em: deData(leitura.substituidaEm),
  substituida_por_id: leitura.substituidaPorId?.value ?? null,
  decidida_em: deData(leitura.decididaEm),
  decidida_por_id: leitura.decididaPorId?.value ?? null,
});

// ------------------------------------------------------------ Notificacao

export interface NotificacaoRow {
  id: string;
  empresa_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  requer_acao: number;
  leitura_id: string | null;
  criada_em: string;
  lida: number;
  resolucao: string | null;
  resolvida_em: string | null;
  resolvida_por: string | null;
}

export const notificacaoDeRow = (row: NotificacaoRow): Notificacao =>
  new Notificacao({
    id: new UUIDv4(row.id),
    empresaId: paraUUID(row.empresa_id),
    tipo: row.tipo as TipoNotificacaoEnum,
    titulo: row.titulo,
    mensagem: row.mensagem,
    criadaEm: new Date(row.criada_em),
    requerAcao: paraBool(row.requer_acao),
    leituraId: paraUUID(row.leitura_id),
    lida: paraBool(row.lida),
    resolucao: (row.resolucao as ResolucaoEnum) ?? null,
    resolvidaEm: paraData(row.resolvida_em),
    resolvidaPorId: paraUUID(row.resolvida_por),
  });

export const notificacaoParaRow = (notificacao: Notificacao): NotificacaoRow => ({
  id: notificacao.id.value,
  empresa_id: notificacao.empresaId?.value ?? null,
  tipo: notificacao.tipo,
  titulo: notificacao.titulo,
  mensagem: notificacao.mensagem,
  requer_acao: deBool(notificacao.requerAcao),
  leitura_id: notificacao.leituraId?.value ?? null,
  criada_em: notificacao.criadaEm.toISOString(),
  lida: deBool(notificacao.lida),
  resolucao: notificacao.resolucao,
  resolvida_em: deData(notificacao.resolvidaEm),
  resolvida_por: notificacao.resolvidaPorId?.value ?? null,
});

export { PerfilEnum };
