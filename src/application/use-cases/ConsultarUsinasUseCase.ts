import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

export interface ConsultarUsinasInputDTO {
  empresaId: string;
  buscaTexto?: string;
  status?: StatusUsinaEnum;
}

export class ConsultarUsinasUseCase {
  constructor(private readonly usinaRepo: IUsinaRepository) {}

  async executar(input: ConsultarUsinasInputDTO): Promise<Usina[]> {
    const empresaId = new UUIDv4(input.empresaId);
    let usinas = await this.usinaRepo.listarPorEmpresa(empresaId);

    if (input.buscaTexto && input.buscaTexto.trim() !== '') {
      const termo = input.buscaTexto.toLowerCase().trim();
      usinas = usinas.filter(
        (u) =>
          u.nome.toLowerCase().includes(termo) ||
          u.codigoUC.toLowerCase().includes(termo)
      );
    }

    if (input.status) {
      usinas = usinas.filter((u) => u.status === input.status);
    }

    return usinas;
  }
}
