import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

export class LeituraRepositoryMemory implements ILeituraRepository {
  public items: Map<string, Leitura> = new Map();

  async salvar(leitura: Leitura): Promise<void> {
    this.items.set(leitura.id.value, leitura);
  }

  async atualizar(leitura: Leitura): Promise<void> {
    if (!this.items.has(leitura.id.value)) {
      throw new Error(`Leitura não encontrada: ${leitura.id.value}`);
    }
    this.items.set(leitura.id.value, leitura);
  }

  async buscarPorId(id: UUIDv4): Promise<Leitura | null> {
    return this.items.get(id.value) ?? null;
  }

  /**
   * A vigente sai primeiro, como no SQLite: ali o índice parcial único recusaria
   * duas leituras vigentes no mesmo (padrão, dia). Manter a mesma ordem aqui faz
   * o dublê falhar nos mesmos casos que a implementação real.
   */
  async salvarSubstituindo(nova: Leitura, vigente: Leitura): Promise<void> {
    this.items.set(vigente.id.value, vigente);

    const jaVigenteNoDia = await this.buscarVigenteDoDia(nova.padraoId, nova.dataLocal);
    if (jaVigenteNoDia) {
      throw new Error('Já existe leitura vigente para este padrão neste dia');
    }

    this.items.set(nova.id.value, nova);
  }

  async buscarVigenteDoDia(padraoId: UUIDv4, dataLocal: DataLocal): Promise<Leitura | null> {
    return (
      Array.from(this.items.values()).find(
        (l) => l.padraoId.equals(padraoId) && l.dataLocal.equals(dataLocal) && l.estaVigente(),
      ) ?? null
    );
  }

  async listarVigentesDoPadrao(padraoId: UUIDv4): Promise<Leitura[]> {
    return this.ordenarPorMedicao(
      Array.from(this.items.values()).filter((l) => l.padraoId.equals(padraoId) && l.estaVigente()),
    );
  }

  async listarDoPadrao(padraoId: UUIDv4): Promise<Leitura[]> {
    return this.ordenarPorMedicao(
      Array.from(this.items.values()).filter((l) => l.padraoId.equals(padraoId)),
    );
  }

  async listarPorUsuario(usuarioId: UUIDv4, limite?: number): Promise<Leitura[]> {
    const lista = this.ordenarPorMedicao(
      Array.from(this.items.values()).filter((l) => l.usuarioId.equals(usuarioId)),
    ).reverse();
    return limite ? lista.slice(0, limite) : lista;
  }

  async listarRegistradasAntesDe(dataLocal: DataLocal): Promise<Leitura[]> {
    return this.ordenarPorMedicao(
      Array.from(this.items.values()).filter(
        (l) => l.status === StatusLeituraEnum.REGISTRADA && l.dataLocal.antesDe(dataLocal),
      ),
    );
  }

  async excluirDecididasAntesDe(dataLocal: DataLocal): Promise<number> {
    // Leitura ainda REGISTRADA nunca é expurgada: ela aguarda decisão do
    // administrador, e apagá-la perderia o caso em aberto.
    const alvos = Array.from(this.items.values()).filter(
      (l) => l.status !== StatusLeituraEnum.REGISTRADA && l.dataLocal.antesDe(dataLocal),
    );
    alvos.forEach((l) => this.items.delete(l.id.value));
    return alvos.length;
  }

  private ordenarPorMedicao(leituras: Leitura[]): Leitura[] {
    return [...leituras].sort((a, b) => a.medidoEm.getTime() - b.medidoEm.getTime());
  }
}
