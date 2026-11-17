import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CursoresDePull,
  ExclusaoRemota,
  ISincronizacaoRemotaGateway,
  PacoteDeAlteracoes,
  TabelaSincronizada,
} from '@/domain/gateways/ISincronizacaoRemotaGateway';
import { ResultadoRemoto, remotoFalhou, remotoOk } from '@/domain/gateways/ResultadoRemoto';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { BUCKET_COMPROVANTES } from './clienteSupabase';
import { ErroSupabase, falhaDe, protegido } from './errosSupabase';
import {
  EmpresaRemota,
  EnderecoRemoto,
  LeituraRemota,
  NotificacaoRemota,
  PadraoRemoto,
  PerfilRemoto,
  empresaDeRemota,
  empresaParaRemota,
  enderecoDeRemoto,
  enderecoParaRemoto,
  leituraDeRemota,
  leituraParaRemota,
  notificacaoDeRemota,
  notificacaoParaRemota,
  padraoDeRemoto,
  padraoParaRemoto,
  usuarioDeRemoto,
  usuarioParaRemoto,
} from './mapeadoresRemotos';

/** Lê os bytes de um arquivo do aparelho. Injetado para o teste não tocar em disco. */
export type LeitorDeArquivo = (uri: string) => Promise<ArrayBuffer>;

/** Vida da URL assinada de um comprovante, em segundos. Curta de propósito. */
export const VIDA_DA_URL_ASSINADA = 60;

/** Linhas por requisição no pull. O PostgREST corta em 1000 por padrão. */
const TAMANHO_DA_PAGINA = 500;

interface FonteDoPull {
  chave: TabelaSincronizada;
  tabela: string;
  colunas: string;
  /** Coluna do carimbo do servidor, que serve de cursor. */
  carimbo: string;
}

/**
 * Ordem das chaves estrangeiras: quem é referenciado vem antes. O carimbo é
 * sempre do relógio do servidor (gatilho `carimbar_atualizacao`).
 */
const FONTES: FonteDoPull[] = [
  { chave: 'exclusoes', tabela: 'exclusoes', colunas: '*', carimbo: 'excluido_em' },
  { chave: 'empresas', tabela: 'empresas', colunas: '*', carimbo: 'atualizado_em' },
  { chave: 'enderecos', tabela: 'enderecos', colunas: '*', carimbo: 'atualizado_em' },
  { chave: 'padroes', tabela: 'padroes_cemig', colunas: '*', carimbo: 'atualizado_em' },
  {
    chave: 'usuarios',
    tabela: 'perfis',
    colunas: '*, usuario_enderecos(endereco_id)',
    carimbo: 'atualizado_em',
  },
  { chave: 'leituras', tabela: 'leituras', colunas: '*', carimbo: 'atualizado_em' },
  { chave: 'notificacoes', tabela: 'notificacoes', colunas: '*', carimbo: 'atualizado_em' },
];

const TABELA_DA_EXCLUSAO: Record<string, ExclusaoRemota['tabela']> = {
  enderecos: 'enderecos',
  padroes_cemig: 'padroes',
  perfis: 'usuarios',
};

type Linha = Record<string, unknown>;

/**
 * Push e pull contra o Supabase (Postgres por PostgREST + Storage).
 *
 * Este adaptador não decide quem pode o quê: ele pede, e o banco responde
 * conforme as políticas de RLS do usuário autenticado. É por isso que o pull
 * não filtra por empresa — o filtro que vale é o do servidor.
 */
export class SincronizacaoSupabase implements ISincronizacaoRemotaGateway {
  constructor(
    private readonly cliente: SupabaseClient,
    private readonly lerArquivo: LeitorDeArquivo,
  ) {}

  // ------------------------------------------------------------------- push

  enviarFoto(caminhoRemoto: string, uriLocal: string): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const bytes = await this.lerArquivo(uriLocal);

      const { error } = await this.cliente.storage
        .from(BUCKET_COMPROVANTES)
        .upload(caminhoRemoto, bytes, { contentType: 'image/jpeg', upsert: false });

      if (!error) return remotoOk();

      // O arquivo já está lá: é o reenvio depois de uma queda de rede entre a
      // foto e a linha. O caminho leva o id da leitura, então é a mesma foto.
      const erro = error as ErroSupabase;
      if (Number(erro.statusCode) === 409 || /already exists|duplicate/i.test(erro.message ?? '')) {
        return remotoOk();
      }

      return falhaDe(erro, Number(erro.statusCode) || undefined);
    });
  }

  enviarLeitura(
    leitura: Leitura,
    fotoPath: string,
  ): Promise<ResultadoRemoto<{ status: StatusLeituraEnum }>> {
    return protegido(async () => {
      const { data, error, status } = await this.cliente.rpc('sincronizar_leitura', {
        p: leituraParaRemota(leitura, fotoPath),
      });

      if (error) return falhaDe(error, status);

      const resposta = (data ?? {}) as { status?: string };
      return remotoOk({ status: (resposta.status as StatusLeituraEnum) ?? leitura.status });
    });
  }

  /**
   * Insere e, se o aviso já existe, atualiza só o que muda nele (lida e
   * resolução). Em dois passos, e não num upsert, porque o técnico pode
   * inserir aviso mas não pode ler nem alterar — e o upsert do Postgres exige
   * as três permissões de uma vez.
   */
  enviarNotificacao(notificacao: Notificacao): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const linha = notificacaoParaRemota(notificacao);
      const insercao = await this.cliente.from('notificacoes').insert(linha);

      if (!insercao.error) return remotoOk();
      if (insercao.error.code !== '23505') return falhaDe(insercao.error, insercao.status);

      const atualizacao = await this.cliente
        .from('notificacoes')
        .update({
          lida: linha.lida,
          resolucao: linha.resolucao,
          resolvida_em: linha.resolvida_em,
          resolvida_por: linha.resolvida_por,
        })
        .eq('id', linha.id);

      return atualizacao.error ? falhaDe(atualizacao.error, atualizacao.status) : remotoOk();
    });
  }

  marcarNotificacoesLidas(empresaId: UUIDv4 | null): Promise<ResultadoRemoto> {
    return protegido(async () => {
      let consulta = this.cliente.from('notificacoes').update({ lida: true }).eq('lida', false);
      // Sem empresa é o super admin: o RLS deixa passar todas.
      if (empresaId) consulta = consulta.eq('empresa_id', empresaId.value);

      const { error, status } = await consulta;
      return error ? falhaDe(error, status) : remotoOk();
    });
  }

  enviarEmpresa(empresa: Empresa): Promise<ResultadoRemoto> {
    return this.upsert('empresas', empresaParaRemota(empresa));
  }

  enviarEndereco(endereco: Endereco): Promise<ResultadoRemoto> {
    return this.upsert('enderecos', enderecoParaRemoto(endereco));
  }

  enviarPadrao(padrao: PadraoCemig): Promise<ResultadoRemoto> {
    return this.upsert('padroes_cemig', padraoParaRemoto(padrao));
  }

  excluirEndereco(id: UUIDv4): Promise<ResultadoRemoto> {
    return this.excluir('enderecos', id);
  }

  excluirPadrao(id: UUIDv4): Promise<ResultadoRemoto> {
    return this.excluir('padroes_cemig', id);
  }

  /** O perfil sai; a conta no serviço de autenticação fica, sem acesso a nada. */
  excluirUsuario(id: UUIDv4): Promise<ResultadoRemoto> {
    return this.excluir('perfis', id);
  }

  enviarUsuario(usuario: Usuario): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const { error, status } = await this.cliente.rpc('sincronizar_perfil', {
        p: usuarioParaRemoto(usuario),
      });
      return error ? falhaDe(error, status) : remotoOk();
    });
  }

  private upsert(tabela: string, linha: object): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const { error, status } = await this.cliente.from(tabela).upsert(linha, { onConflict: 'id' });
      return error ? falhaDe(error, status) : remotoOk();
    });
  }

  private excluir(tabela: string, id: UUIDv4): Promise<ResultadoRemoto> {
    return protegido(async () => {
      const { error, status } = await this.cliente.from(tabela).delete().eq('id', id.value);
      return error ? falhaDe(error, status) : remotoOk();
    });
  }

  // ------------------------------------------------------------------- pull

  baixarAlteracoes(cursores: CursoresDePull): Promise<ResultadoRemoto<PacoteDeAlteracoes>> {
    return protegido(async () => {
      const pacote: PacoteDeAlteracoes = {
        empresas: [],
        enderecos: [],
        padroes: [],
        usuarios: [],
        leituras: [],
        notificacoes: [],
        exclusoes: [],
        cursores: { ...cursores },
        ignorados: [],
      };

      for (const fonte of FONTES) {
        const baixado = await this.baixarTabela(fonte, cursores[fonte.chave]);
        if (!baixado.ok) return baixado;

        const linhas = baixado.valor;
        if (linhas.length > 0) {
          // O carimbo fica como o servidor mandou (com microssegundos): passar
          // por Date arredondaria para milissegundos e repetiria linhas.
          pacote.cursores[fonte.chave] = String(linhas[linhas.length - 1][fonte.carimbo]);
        }

        SincronizacaoSupabase.converter(fonte.chave, linhas, pacote);
      }

      return remotoOk(pacote);
    });
  }

  private async baixarTabela(
    fonte: FonteDoPull,
    cursor: string | undefined,
  ): Promise<ResultadoRemoto<Linha[]>> {
    const linhas: Linha[] = [];

    for (let inicio = 0; ; inicio += TAMANHO_DA_PAGINA) {
      let consulta = this.cliente.from(fonte.tabela).select(fonte.colunas);
      if (cursor) consulta = consulta.gt(fonte.carimbo, cursor);

      const { data, error, status } = await consulta
        .order(fonte.carimbo, { ascending: true })
        .range(inicio, inicio + TAMANHO_DA_PAGINA - 1);

      if (error) return falhaDe(error, status);

      const pagina = (data ?? []) as unknown as Linha[];
      linhas.push(...pagina);
      if (pagina.length < TAMANHO_DA_PAGINA) return remotoOk(linhas);
    }
  }

  /**
   * Uma linha que não vira entidade (dado inválido gravado direto no painel,
   * por exemplo) é anotada e pulada: ela não pode impedir o resto do pacote.
   */
  private static converter(
    chave: TabelaSincronizada,
    linhas: Linha[],
    pacote: PacoteDeAlteracoes,
  ): void {
    for (const linha of linhas) {
      try {
        switch (chave) {
          case 'empresas':
            pacote.empresas.push(empresaDeRemota(linha as unknown as EmpresaRemota));
            break;
          case 'enderecos':
            pacote.enderecos.push(enderecoDeRemoto(linha as unknown as EnderecoRemoto));
            break;
          case 'padroes':
            pacote.padroes.push(padraoDeRemoto(linha as unknown as PadraoRemoto));
            break;
          case 'usuarios':
            pacote.usuarios.push(usuarioDeRemoto(linha as unknown as PerfilRemoto));
            break;
          case 'leituras':
            pacote.leituras.push(leituraDeRemota(linha as unknown as LeituraRemota));
            break;
          case 'notificacoes':
            pacote.notificacoes.push(notificacaoDeRemota(linha as unknown as NotificacaoRemota));
            break;
          default: {
            const tabela = TABELA_DA_EXCLUSAO[String(linha.tabela)];
            if (tabela) {
              pacote.exclusoes.push({ tabela, registroId: new UUIDv4(String(linha.registro_id)) });
            }
          }
        }
      } catch (erro) {
        pacote.ignorados.push(`${chave} ${String(linha.id ?? '?')}: ${(erro as Error).message}`);
      }
    }
  }

  // ------------------------------------------------------------------ fotos

  /**
   * O bucket é privado: não existe URL pública de comprovante. O servidor só
   * assina o endereço para quem passa na política de leitura do Storage, e a
   * assinatura vale por `VIDA_DA_URL_ASSINADA` segundos.
   */
  urlAssinadaDaFoto(fotoPath: string): Promise<ResultadoRemoto<string>> {
    return protegido(async () => {
      const { data, error } = await this.cliente.storage
        .from(BUCKET_COMPROVANTES)
        .createSignedUrl(fotoPath, VIDA_DA_URL_ASSINADA);

      if (error || !data?.signedUrl) {
        if (!error) return remotoFalhou('rejeitado', 'Comprovante não encontrado');
        const erro = error as ErroSupabase;
        return falhaDe(erro, Number(erro.statusCode) || undefined);
      }

      return remotoOk(data.signedUrl);
    });
  }
}
