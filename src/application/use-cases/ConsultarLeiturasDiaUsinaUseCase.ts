import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { ReferenciaLeituraService } from '@/domain/services/ReferenciaLeituraService';
import { AvisoValorMenorService } from '@/domain/services/AvisoValorMenorService';

export interface UsinaItemDTO {
  id: string;
  apelido: string;
  uc: string;
  empresaId: string;
  empresaNome?: string;
  logradouro: string;
  temGeocerca: boolean;
  totalMedidores: number;
}

export interface LeituraDetalheDTO {
  id: string;
  valorConsumo: number;
  valorInjecao: number | null;
  medidoEm: string; // ISO
  horaFormatada: string; // "HH:mm"
  status: StatusLeituraEnum;
  autorNome: string;
  fotoLocalUri: string;
  temLocalizacao: boolean;
  substituidaEm?: string | null;
  substituidaPorId?: string | null;
}

export interface MedidorDiaDTO {
  padraoId: string;
  numero: string;
  teveLeitura: boolean;
  leituraVigente: LeituraDetalheDTO | null;
  substituicoes: LeituraDetalheDTO[];
  temSubstituicao: boolean;
  alertaForaPadrao: string | null;
  referenciaHistorico: {
    valorConsumo: number;
    valorInjecao: number | null;
    dataLocal: string;
  } | null;
}

export interface ResumoLeiturasDiaDTO {
  totalMedidores: number;
  medidoresComLeitura: number;
  medidoresSemLeitura: number;
  totalSubstituicoes: number;
  totalAlertas: number;
}

export interface ConsultarLeiturasDiaUsinaInput {
  atorId: string;
  usinaId?: string;
  dataLocal?: string; // YYYY-MM-DD
}

export interface ConsultarLeiturasDiaUsinaOutput {
  sucesso: boolean;
  erro?: string;
  usinas: UsinaItemDTO[];
  usinaSelecionada: UsinaItemDTO | null;
  dataLocal: string; // YYYY-MM-DD
  dataLocalFormatada: string; // DD/MM/AAAA
  diasComLeitura: string[]; // Lista de YYYY-MM-DD com leituras registradas
  resumo: ResumoLeiturasDiaDTO;
  medidores: MedidorDiaDTO[];
}

function formatarHora(data: Date): string {
  // Horário local no fuso de Brasília (UTC-3)
  const deslocamentoMs = -3 * 3600 * 1000;
  const brt = new Date(data.getTime() + deslocamentoMs);
  const hh = String(brt.getUTCHours()).padStart(2, '0');
  const mm = String(brt.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Consulta de monitoramento diário de usina para Administradores e SuperAdmins.
 *
 * Permite visualizar quais medidores da usina foram lidos no dia selecionado,
 * inspecionar eventuais substituições com histórico e alertar sobre medições
 * que apresentaram valores inferiores ao histórico conhecido.
 */
export class ConsultarLeiturasDiaUsinaUseCase {
  constructor(
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly padraoRepo: IPadraoRepository,
    private readonly leituraRepo: ILeituraRepository,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly empresaRepo: IEmpresaRepository,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(
    entrada: ConsultarLeiturasDiaUsinaInput,
  ): Promise<ConsultarLeiturasDiaUsinaOutput> {
    const atorId = new UUIDv4(entrada.atorId);
    const ator = await this.usuarioRepo.buscarPorId(atorId);

    if (!ator) {
      return this.falha('Sessão inválida');
    }

    if (ator.perfil === PerfilEnum.TECNICO) {
      return this.falha('Seu perfil não permite acessar o monitoramento de usinas');
    }

    const todosEnderecos = await this.enderecoRepo.listarTodos();
    const usinasDisponiveis = todosEnderecos.filter((e) => {
      if (!e.ehUsina) return false;
      if (ator.ehGlobal()) return true;
      return ator.empresaId ? e.empresaId.equals(ator.empresaId) : false;
    });

    const todasEmpresas = await this.empresaRepo.listarTodas();
    const mapaEmpresas = new Map(todasEmpresas.map((emp) => [emp.id.value, emp.nome]));

    const usinasDTO: UsinaItemDTO[] = [];
    for (const u of usinasDisponiveis) {
      const padroes = await this.padraoRepo.listarPorEndereco(u.id);
      usinasDTO.push({
        id: u.id.value,
        apelido: u.apelido,
        uc: u.uc,
        empresaId: u.empresaId.value,
        empresaNome: mapaEmpresas.get(u.empresaId.value) ?? 'Empresa',
        logradouro: u.logradouro(),
        temGeocerca: u.temGeocerca(),
        totalMedidores: padroes.length,
      });
    }

    const agora = this.relogio.agora();
    const dataLocalAlvo = entrada.dataLocal
      ? DataLocal.parse(entrada.dataLocal)
      : DataLocal.de(agora);

    if (usinasDTO.length === 0) {
      return {
        sucesso: true,
        usinas: [],
        usinaSelecionada: null,
        dataLocal: dataLocalAlvo.value,
        dataLocalFormatada: dataLocalAlvo.paraBr(),
        diasComLeitura: [],
        resumo: {
          totalMedidores: 0,
          medidoresComLeitura: 0,
          medidoresSemLeitura: 0,
          totalSubstituicoes: 0,
          totalAlertas: 0,
        },
        medidores: [],
      };
    }

    let usinaAlvoDTO: UsinaItemDTO | null = null;
    if (entrada.usinaId) {
      usinaAlvoDTO = usinasDTO.find((u) => u.id === entrada.usinaId) ?? null;
      if (!usinaAlvoDTO) {
        return this.falha('Usina não encontrada ou fora do seu escopo');
      }
    } else {
      usinaAlvoDTO = usinasDTO[0];
    }

    const padroes = await this.padraoRepo.listarPorEndereco(new UUIDv4(usinaAlvoDTO.id));
    const diasComLeituraSet = new Set<string>();

    // Cache de nomes de usuários para evitar múltiplas queries repetidas
    const cacheUsuarios = new Map<string, string>();
    const buscarNomeUsuario = async (userId: UUIDv4): Promise<string> => {
      const cached = cacheUsuarios.get(userId.value);
      if (cached) return cached;
      const user = await this.usuarioRepo.buscarPorId(userId);
      const nome = user?.nome ?? 'Técnico';
      cacheUsuarios.set(userId.value, nome);
      return nome;
    };

    const medidoresDTO: MedidorDiaDTO[] = [];

    for (const padrao of padroes) {
      const todasLeituras = await this.leituraRepo.listarDoPadrao(padrao.id);
      for (const l of todasLeituras) {
        diasComLeituraSet.add(l.dataLocal.value);
      }

      const vigentesHistoricas = todasLeituras.filter((l) => l.estaVigente());
      const referencia = ReferenciaLeituraService.selecionar(dataLocalAlvo, vigentesHistoricas);

      const leiturasDoDia = todasLeituras.filter((l) => l.dataLocal.equals(dataLocalAlvo));
      const vigenteDoDia = leiturasDoDia.find((l) => l.estaVigente()) ?? null;
      const substituidasDoDia = leiturasDoDia.filter(
        (l) => l.status === StatusLeituraEnum.SUBSTITUIDA,
      );

      let leituraVigenteDTO: LeituraDetalheDTO | null = null;
      let alertaForaPadrao: string | null = null;

      if (vigenteDoDia) {
        const autorNome = await buscarNomeUsuario(vigenteDoDia.usuarioId);
        leituraVigenteDTO = {
          id: vigenteDoDia.id.value,
          valorConsumo: vigenteDoDia.valorConsumo.valor,
          valorInjecao: vigenteDoDia.valorInjecao?.valor ?? null,
          medidoEm: vigenteDoDia.medidoEm.toISOString(),
          horaFormatada: formatarHora(vigenteDoDia.medidoEm),
          status: vigenteDoDia.status,
          autorNome,
          fotoLocalUri: vigenteDoDia.fotoLocalUri,
          temLocalizacao: vigenteDoDia.temLocalizacao(),
          substituidaEm: vigenteDoDia.substituidaEm?.toISOString() ?? null,
          substituidaPorId: vigenteDoDia.substituidaPorId?.value ?? null,
        };

        alertaForaPadrao = AvisoValorMenorService.mensagem(
          vigenteDoDia.valorConsumo.valor,
          vigenteDoDia.valorInjecao?.valor ?? null,
          referencia,
        );
      }

      const substituicoesDTO: LeituraDetalheDTO[] = [];
      for (const sub of substituidasDoDia) {
        const subAutor = await buscarNomeUsuario(sub.usuarioId);
        substituicoesDTO.push({
          id: sub.id.value,
          valorConsumo: sub.valorConsumo.valor,
          valorInjecao: sub.valorInjecao?.valor ?? null,
          medidoEm: sub.medidoEm.toISOString(),
          horaFormatada: formatarHora(sub.medidoEm),
          status: sub.status,
          autorNome: subAutor,
          fotoLocalUri: sub.fotoLocalUri,
          temLocalizacao: sub.temLocalizacao(),
          substituidaEm: sub.substituidaEm?.toISOString() ?? null,
          substituidaPorId: sub.substituidaPorId?.value ?? null,
        });
      }

      medidoresDTO.push({
        padraoId: padrao.id.value,
        numero: padrao.numero,
        teveLeitura: leituraVigenteDTO !== null,
        leituraVigente: leituraVigenteDTO,
        substituicoes: substituicoesDTO,
        temSubstituicao: substituicoesDTO.length > 0,
        alertaForaPadrao,
        referenciaHistorico: referencia
          ? {
              valorConsumo: referencia.valorConsumo,
              valorInjecao: referencia.valorInjecao,
              dataLocal: referencia.dataLocal.value,
            }
          : null,
      });
    }

    const totalMedidores = medidoresDTO.length;
    const medidoresComLeitura = medidoresDTO.filter((m) => m.teveLeitura).length;
    const medidoresSemLeitura = totalMedidores - medidoresComLeitura;
    const totalSubstituicoes = medidoresDTO.reduce((s, m) => s + m.substituicoes.length, 0);
    const totalAlertas = medidoresDTO.filter((m) => m.alertaForaPadrao !== null).length;

    return {
      sucesso: true,
      usinas: usinasDTO,
      usinaSelecionada: usinaAlvoDTO,
      dataLocal: dataLocalAlvo.value,
      dataLocalFormatada: dataLocalAlvo.paraBr(),
      diasComLeitura: Array.from(diasComLeituraSet).sort(),
      resumo: {
        totalMedidores,
        medidoresComLeitura,
        medidoresSemLeitura,
        totalSubstituicoes,
        totalAlertas,
      },
      medidores: medidoresDTO,
    };
  }

  private falha(erro: string): ConsultarLeiturasDiaUsinaOutput {
    return {
      sucesso: false,
      erro,
      usinas: [],
      usinaSelecionada: null,
      dataLocal: '',
      dataLocalFormatada: '',
      diasComLeitura: [],
      resumo: {
        totalMedidores: 0,
        medidoresComLeitura: 0,
        medidoresSemLeitura: 0,
        totalSubstituicoes: 0,
        totalAlertas: 0,
      },
      medidores: [],
    };
  }
}

