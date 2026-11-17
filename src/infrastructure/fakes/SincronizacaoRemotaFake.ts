import {
  CursoresDePull,
  ISincronizacaoRemotaGateway,
  PacoteDeAlteracoes,
} from '@/domain/gateways/ISincronizacaoRemotaGateway';
import {
  MotivoFalhaRemota,
  ResultadoRemoto,
  remotoFalhou,
  remotoOk,
} from '@/domain/gateways/ResultadoRemoto';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

export function pacoteVazio(cursores: CursoresDePull = {}): PacoteDeAlteracoes {
  return {
    empresas: [],
    enderecos: [],
    padroes: [],
    usuarios: [],
    leituras: [],
    notificacoes: [],
    exclusoes: [],
    cursores,
    ignorados: [],
  };
}

/**
 * Nuvem de mentira, em memória.
 *
 * Registra o que recebeu, na ordem (`chamadas`), para o teste conferir que a
 * foto subiu antes da leitura. `falha` faz toda chamada falhar com o motivo
 * dado; `recusar` faz só uma operação específica ser rejeitada.
 */
export class SincronizacaoRemotaFake implements ISincronizacaoRemotaGateway {
  public chamadas: string[] = [];
  public fotos = new Map<string, string>();
  public leituras = new Map<string, { leitura: Leitura; fotoPath: string }>();
  public notificacoes = new Map<string, Notificacao>();
  public empresas = new Map<string, Empresa>();
  public enderecos = new Map<string, Endereco>();
  public padroes = new Map<string, PadraoCemig>();
  public usuarios = new Map<string, Usuario>();
  public excluidos: string[] = [];
  public marcacoesDeLidas: (string | null)[] = [];

  /** Todas as chamadas falham com este motivo (ex.: 'rede'). */
  public falha: { motivo: MotivoFalhaRemota; mensagem: string } | null = null;
  /** Operações recusadas pelo servidor: nome da operação -> mensagem. */
  public recusar = new Map<string, string>();
  /** Status que o servidor devolve para a leitura, simulando conflito de vaga. */
  public statusDevolvido: StatusLeituraEnum | null = null;

  /** Pacotes que `baixarAlteracoes` devolve, em sequência. Vazio depois disso. */
  public pacotes: PacoteDeAlteracoes[] = [];
  public cursoresRecebidos: CursoresDePull[] = [];

  private registrar<T = void>(operacao: string, valor?: T): ResultadoRemoto<T> | null {
    this.chamadas.push(operacao);
    if (this.falha) return remotoFalhou<T>(this.falha.motivo, this.falha.mensagem);

    const nome = operacao.split(':')[0];
    const recusa = this.recusar.get(nome);
    if (recusa) return remotoFalhou<T>('rejeitado', recusa);

    void valor;
    return null;
  }

  async enviarFoto(caminhoRemoto: string, uriLocal: string): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarFoto:${caminhoRemoto}`);
    if (barrado) return barrado;
    this.fotos.set(caminhoRemoto, uriLocal);
    return remotoOk();
  }

  async enviarLeitura(
    leitura: Leitura,
    fotoPath: string,
  ): Promise<ResultadoRemoto<{ status: StatusLeituraEnum }>> {
    const barrado = this.registrar<{ status: StatusLeituraEnum }>(
      `enviarLeitura:${leitura.id.value}`,
    );
    if (barrado) return barrado;
    this.leituras.set(leitura.id.value, { leitura, fotoPath });
    return remotoOk({ status: this.statusDevolvido ?? leitura.status });
  }

  async enviarNotificacao(notificacao: Notificacao): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarNotificacao:${notificacao.id.value}`);
    if (barrado) return barrado;
    this.notificacoes.set(notificacao.id.value, notificacao);
    return remotoOk();
  }

  async marcarNotificacoesLidas(empresaId: UUIDv4 | null): Promise<ResultadoRemoto> {
    const barrado = this.registrar('marcarNotificacoesLidas');
    if (barrado) return barrado;
    this.marcacoesDeLidas.push(empresaId?.value ?? null);
    return remotoOk();
  }

  async enviarEmpresa(empresa: Empresa): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarEmpresa:${empresa.id.value}`);
    if (barrado) return barrado;
    this.empresas.set(empresa.id.value, empresa);
    return remotoOk();
  }

  async enviarEndereco(endereco: Endereco): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarEndereco:${endereco.id.value}`);
    if (barrado) return barrado;
    this.enderecos.set(endereco.id.value, endereco);
    return remotoOk();
  }

  async excluirEndereco(id: UUIDv4): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`excluirEndereco:${id.value}`);
    if (barrado) return barrado;
    this.excluidos.push(id.value);
    return remotoOk();
  }

  async enviarPadrao(padrao: PadraoCemig): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarPadrao:${padrao.id.value}`);
    if (barrado) return barrado;
    this.padroes.set(padrao.id.value, padrao);
    return remotoOk();
  }

  async excluirPadrao(id: UUIDv4): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`excluirPadrao:${id.value}`);
    if (barrado) return barrado;
    this.excluidos.push(id.value);
    return remotoOk();
  }

  async enviarUsuario(usuario: Usuario): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`enviarUsuario:${usuario.id.value}`);
    if (barrado) return barrado;
    this.usuarios.set(usuario.id.value, usuario);
    return remotoOk();
  }

  async excluirUsuario(id: UUIDv4): Promise<ResultadoRemoto> {
    const barrado = this.registrar(`excluirUsuario:${id.value}`);
    if (barrado) return barrado;
    this.excluidos.push(id.value);
    return remotoOk();
  }

  async baixarAlteracoes(cursores: CursoresDePull): Promise<ResultadoRemoto<PacoteDeAlteracoes>> {
    const barrado = this.registrar<PacoteDeAlteracoes>('baixarAlteracoes');
    if (barrado) return barrado;
    this.cursoresRecebidos.push({ ...cursores });
    return remotoOk(this.pacotes.shift() ?? pacoteVazio(cursores));
  }

  async urlAssinadaDaFoto(fotoPath: string): Promise<ResultadoRemoto<string>> {
    const barrado = this.registrar<string>(`urlAssinadaDaFoto:${fotoPath}`);
    if (barrado) return barrado;
    return remotoOk(`https://nuvem.teste/assinada/${fotoPath}?token=curto`);
  }
}
