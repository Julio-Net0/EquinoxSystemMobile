import { PurgarLeiturasAntigasUseCase } from '@/application/use-cases/PurgarLeiturasAntigasUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { ArquivoFotoGatewayFake } from '@/infrastructure/fakes/ArquivoFotoGatewayFake';
import { relogioFixo } from '@/domain/services/Relogio';

/** 10/03/2026 em Brasília. */
const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const padraoId = UUIDv4.gerar();
const usuarioId = UUIDv4.gerar();

async function cenario() {
  const leituraRepo = new LeituraRepositoryMemory();
  const arquivoFoto = new ArquivoFotoGatewayFake();
  const caso = new PurgarLeiturasAntigasUseCase(leituraRepo, arquivoFoto, relogioFixo(AGORA));

  async function leitura(dataLocalIso: string, decidida: boolean) {
    const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
    const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, 15));
    const l = new Leitura({
      id: UUIDv4.gerar(), padraoId, usuarioId,
      valorConsumo: new ValorKwh(1800),
      fotoLocalUri: `file:///documents/leituras/${dataLocalIso}.jpg`,
      medidoEm, dataLocal: DataLocal.de(medidoEm),
    });
    if (decidida) l.aprovar(usuarioId, AGORA);
    await leituraRepo.salvar(l);
    arquivoFoto.salvos.set(l.fotoLocalUri, {
      uri: l.fotoLocalUri, bytes: 300_000, largura: 1080, altura: 1440,
    });
    return l;
  }

  return { caso, leituraRepo, arquivoFoto, leitura };
}

describe('PurgarLeiturasAntigasUseCase', () => {
  it('o corte é de 30 dias', () => {
    expect(PurgarLeiturasAntigasUseCase.DIAS_RETENCAO).toBe(30);
  });

  it('remove leitura decidida mais antiga que 30 dias', async () => {
    const { caso, leituraRepo, leitura } = await cenario();
    const antiga = await leitura('2026-01-10', true);

    const saida = await caso.executar();

    expect(saida.removidas).toBe(1);
    expect(await leituraRepo.buscarPorId(antiga.id)).toBeNull();
  });

  it('apaga também a foto, para não deixar arquivo órfão ocupando o aparelho', async () => {
    const { caso, arquivoFoto, leitura } = await cenario();
    const antiga = await leitura('2026-01-10', true);

    await caso.executar();

    expect(await arquivoFoto.existe(antiga.fotoLocalUri)).toBe(false);
  });

  it('mantém leitura decidida dentro da janela de 30 dias', async () => {
    const { caso, leituraRepo, leitura } = await cenario();
    const recente = await leitura('2026-03-01', true);

    const saida = await caso.executar();

    expect(saida.removidas).toBe(0);
    expect(await leituraRepo.buscarPorId(recente.id)).not.toBeNull();
  });

  it('nunca remove leitura que ainda aguarda decisão, por antiga que seja', async () => {
    const { caso, leituraRepo, leitura } = await cenario();
    const pendente = await leitura('2025-06-01', false);

    const saida = await caso.executar();

    expect(saida.removidas).toBe(0);
    expect(await leituraRepo.buscarPorId(pendente.id)).not.toBeNull();
  });

  it('não falha quando não há nada a expurgar', async () => {
    const { caso } = await cenario();
    expect((await caso.executar()).removidas).toBe(0);
  });

  it('segue removendo as demais quando apagar uma foto falha', async () => {
    const { caso, leituraRepo, arquivoFoto, leitura } = await cenario();
    await leitura('2026-01-10', true);
    const outra = await leitura('2026-01-11', true);
    arquivoFoto.remover = jest.fn(async (uri: string) => {
      if (uri.includes('2026-01-10')) throw new Error('arquivo em uso');
    });

    const saida = await caso.executar();

    expect(saida.removidas).toBe(2);
    expect(await leituraRepo.buscarPorId(outra.id)).toBeNull();
  });
});
