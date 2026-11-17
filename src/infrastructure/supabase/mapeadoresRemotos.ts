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
import { NivelAcesso, nivelDe, perfilDeNivel } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';

/**
 * Tradução entre as linhas do Postgres remoto e as entidades do domínio.
 *
 * É o par dos mapeadores do SQLite: mesmas entidades, outro banco. As
 * diferenças de tipo ficam aqui — booleano de verdade em vez de 0/1,
 * `timestamptz` em vez de texto ISO.
 */

const paraData = (iso: string | null | undefined): Date | null => (iso ? new Date(iso) : null);
const deData = (data: Date | null): string | null => data?.toISOString() ?? null;
const paraUUID = (valor: string | null | undefined): UUIDv4 | null =>
  valor ? new UUIDv4(valor) : null;

// ---------------------------------------------------------------- Empresa

export interface EmpresaRemota {
  id: string;
  nome: string;
  cnpj: string;
  criado_em: string;
  atualizado_em?: string;
}

export const empresaDeRemota = (row: EmpresaRemota): Empresa =>
  new Empresa({
    id: new UUIDv4(row.id),
    nome: row.nome,
    cnpj: new CNPJ(row.cnpj),
    dataCriacao: new Date(row.criado_em),
  });

export const empresaParaRemota = (empresa: Empresa): EmpresaRemota => ({
  id: empresa.id.value,
  nome: empresa.nome,
  cnpj: empresa.cnpj.valorLimpo,
  criado_em: empresa.dataCriacao.toISOString(),
});

// --------------------------------------------------------------- Endereco

export interface EnderecoRemoto {
  id: string;
  empresa_id: string;
  apelido: string;
  uc: string;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  eh_usina: boolean;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
  atualizado_em?: string;
}

export const enderecoDeRemoto = (row: EnderecoRemoto): Endereco =>
  new Endereco({
    id: new UUIDv4(row.id),
    empresaId: new UUIDv4(row.empresa_id),
    apelido: row.apelido,
    uc: row.uc,
    rua: row.rua,
    numero: row.numero,
    bairro: row.bairro,
    cidade: row.cidade,
    ehUsina: row.eh_usina,
    coordenadas:
      row.latitude !== null && row.longitude !== null
        ? new CoordenadasGPS(row.latitude, row.longitude)
        : null,
    criadoEm: new Date(row.criado_em),
  });

export const enderecoParaRemoto = (endereco: Endereco): EnderecoRemoto => ({
  id: endereco.id.value,
  empresa_id: endereco.empresaId.value,
  apelido: endereco.apelido,
  uc: endereco.uc,
  rua: endereco.rua,
  numero: endereco.numero,
  bairro: endereco.bairro,
  cidade: endereco.cidade,
  eh_usina: endereco.ehUsina,
  latitude: endereco.coordenadas?.latitude ?? null,
  longitude: endereco.coordenadas?.longitude ?? null,
  criado_em: endereco.criadoEm.toISOString(),
});

// ------------------------------------------------------------ PadraoCemig

export interface PadraoRemoto {
  id: string;
  endereco_id: string;
  numero: string;
  criado_em: string;
  atualizado_em?: string;
}

export const padraoDeRemoto = (row: PadraoRemoto): PadraoCemig =>
  new PadraoCemig({
    id: new UUIDv4(row.id),
    enderecoId: new UUIDv4(row.endereco_id),
    numero: row.numero,
    criadoEm: new Date(row.criado_em),
  });

export const padraoParaRemoto = (padrao: PadraoCemig): PadraoRemoto => ({
  id: padrao.id.value,
  endereco_id: padrao.enderecoId.value,
  numero: padrao.numero,
  criado_em: padrao.criadoEm.toISOString(),
});

// ----------------------------------------------------------------- Perfil

export interface PerfilRemoto {
  id: string;
  empresa_id: string | null;
  nome: string;
  usuario: string;
  email: string;
  nivel_acesso: number;
  nivel_anterior: number | null;
  status: string;
  criado_em: string;
  autorizado_em: string | null;
  autorizado_por: string | null;
  atualizado_em?: string;
  /** Vínculos embutidos na consulta: `usuario_enderecos(endereco_id)`. */
  usuario_enderecos?: { endereco_id: string }[] | null;
}

export const usuarioDeRemoto = (row: PerfilRemoto): Usuario =>
  new Usuario({
    id: new UUIDv4(row.id),
    empresaId: paraUUID(row.empresa_id),
    nome: row.nome,
    usuario: row.usuario,
    email: row.email,
    perfil: perfilDeNivel(row.nivel_acesso as NivelAcesso),
    status: row.status as StatusUsuarioEnum,
    enderecosVinculados: (row.usuario_enderecos ?? []).map((v) => new UUIDv4(v.endereco_id)),
    perfilAnterior:
      row.nivel_anterior === null ? null : perfilDeNivel(row.nivel_anterior as NivelAcesso),
    criadoEm: new Date(row.criado_em),
    autorizadoEm: paraData(row.autorizado_em),
    autorizadoPorId: paraUUID(row.autorizado_por),
  });

/** Argumento da função `sincronizar_perfil`: o perfil e os vínculos, juntos. */
export const usuarioParaRemoto = (usuario: Usuario): Record<string, unknown> => ({
  id: usuario.id.value,
  nome: usuario.nome,
  usuario: usuario.usuario,
  nivel_acesso: nivelDe(usuario.perfil),
  nivel_anterior: usuario.perfilAnterior ? nivelDe(usuario.perfilAnterior) : null,
  status: usuario.status,
  autorizado_em: deData(usuario.autorizadoEm),
  autorizado_por: usuario.autorizadoPorId?.value ?? null,
  enderecos: usuario.enderecosVinculados.map((e) => e.value),
});

// ---------------------------------------------------------------- Leitura

export interface LeituraRemota {
  id: string;
  padrao_id: string;
  usuario_id: string;
  valor_consumo: number;
  valor_injecao: number | null;
  foto_path: string;
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
  atualizado_em?: string;
}

/**
 * Leitura como chega da nuvem: sem foto no aparelho (`fotoLocalUri` vazio) e
 * já sincronizada. Se o aparelho tiver a foto, quem a preserva é o
 * repositório, ao aplicar.
 */
export const leituraDeRemota = (row: LeituraRemota): Leitura =>
  new Leitura({
    id: new UUIDv4(row.id),
    padraoId: new UUIDv4(row.padrao_id),
    usuarioId: new UUIDv4(row.usuario_id),
    valorConsumo: new ValorKwh(row.valor_consumo),
    valorInjecao: row.valor_injecao === null ? null : new ValorKwh(row.valor_injecao),
    fotoLocalUri: '',
    fotoRemotaPath: row.foto_path,
    coordenadas:
      row.latitude !== null && row.longitude !== null
        ? new CoordenadasGPS(row.latitude, row.longitude, row.precisao_metros)
        : null,
    medidoEm: new Date(row.medido_em),
    dataLocal: DataLocal.parse(row.data_local),
    status: row.status as StatusLeituraEnum,
    estadoSync: EstadoSyncEnum.SINCRONIZADA,
    substituidaEm: paraData(row.substituida_em),
    substituidaPorId: paraUUID(row.substituida_por_id),
    decididaEm: paraData(row.decidida_em),
    decididaPorId: paraUUID(row.decidida_por_id),
  });

/** Argumento da função `sincronizar_leitura`. */
export const leituraParaRemota = (leitura: Leitura, fotoPath: string): LeituraRemota => ({
  id: leitura.id.value,
  padrao_id: leitura.padraoId.value,
  usuario_id: leitura.usuarioId.value,
  valor_consumo: leitura.valorConsumo.valor,
  valor_injecao: leitura.valorInjecao?.valor ?? null,
  foto_path: fotoPath,
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

export interface NotificacaoRemota {
  id: string;
  empresa_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  requer_acao: boolean;
  leitura_id: string | null;
  criada_em: string;
  lida: boolean;
  resolucao: string | null;
  resolvida_em: string | null;
  resolvida_por: string | null;
  atualizado_em?: string;
}

export const notificacaoDeRemota = (row: NotificacaoRemota): Notificacao =>
  new Notificacao({
    id: new UUIDv4(row.id),
    empresaId: paraUUID(row.empresa_id),
    tipo: row.tipo as TipoNotificacaoEnum,
    titulo: row.titulo,
    mensagem: row.mensagem,
    criadaEm: new Date(row.criada_em),
    requerAcao: row.requer_acao,
    leituraId: paraUUID(row.leitura_id),
    lida: row.lida,
    resolucao: (row.resolucao as ResolucaoEnum) ?? null,
    resolvidaEm: paraData(row.resolvida_em),
    resolvidaPorId: paraUUID(row.resolvida_por),
  });

export const notificacaoParaRemota = (notificacao: Notificacao): NotificacaoRemota => ({
  id: notificacao.id.value,
  empresa_id: notificacao.empresaId?.value ?? null,
  tipo: notificacao.tipo,
  titulo: notificacao.titulo,
  mensagem: notificacao.mensagem,
  requer_acao: notificacao.requerAcao,
  leitura_id: notificacao.leituraId?.value ?? null,
  criada_em: notificacao.criadaEm.toISOString(),
  lida: notificacao.lida,
  resolucao: notificacao.resolucao,
  resolvida_em: deData(notificacao.resolvidaEm),
  resolvida_por: notificacao.resolvidaPorId?.value ?? null,
});
