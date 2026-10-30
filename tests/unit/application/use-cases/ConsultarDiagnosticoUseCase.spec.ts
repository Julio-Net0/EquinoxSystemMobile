import { ConsultarDiagnosticoUseCase } from '@/application/use-cases/ConsultarDiagnosticoUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { ArquivoFotoGatewayFake } from '@/infrastructure/fakes/ArquivoFotoGatewayFake';
import { DiagnosticoLocalFake } from '@/infrastructure/fakes/DiagnosticoLocalFake';

const usuarioId = UUIDv4.gerar();

async function cenario() {
  const leituraRepo = new LeituraRepositoryMemory();
  const arquivoFoto = new ArquivoFotoGatewayFake();
  const diagnostico = new DiagnosticoLocalFake();
  const caso = new ConsultarDiagnosticoUseCase(diagnostico, leituraRepo, arquivoFoto);

  async function leitura(dias: number, valor: number, fotoUri: string, comFoto: boolean) {
    const medidoEm = new Date(Date.UTC(2026, 2, 10 - dias, 15));
    const l = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: UUIDv4.gerar(),
      usuarioId,
      valorConsumo: new ValorKwh(valor),
      fotoLocalUri: fotoUri,
      medidoEm,
      dataLocal: DataLocal.de(medidoEm),
    });
    await leituraRepo.salvar(l);

    if (comFoto) {
      arquivoFoto.salvos.set(fotoUri, { uri: fotoUri, bytes: 300_000, largura: 1080, altura: 1440 });
    }
    return l;
  }

  return { caso, diagnostico, leitura, leituraRepo };
}

describe('ConsultarDiagnosticoUseCase', () => {
  it('traz o estado do banco: arquivo, versão do schema e contagens', async () => {
    const { caso } = await cenario();

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    expect(saida.banco.nomeDoArquivo).toBe('equinox.db');
    expect(saida.banco.versaoDoSchema).toBe(2);
    expect(saida.banco.contagens.empresas).toBe(2);
  });

  it('lista as últimas leituras do usuário, da mais recente para a mais antiga', async () => {
    const { caso, leitura } = await cenario();
    await leitura(5, 1000, 'file:///doc/a.jpg', true);
    await leitura(1, 3000, 'file:///doc/b.jpg', true);
    await leitura(3, 2000, 'file:///doc/c.jpg', true);

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    expect(saida.ultimasLeituras.map((l) => l.valorConsumo)).toEqual([3000, 2000, 1000]);
  });

  it('limita a lista para a tela não virar um despejo de banco', async () => {
    const { caso, leitura } = await cenario();
    for (let i = 1; i <= 12; i += 1) {
      await leitura(i, i * 100, `file:///doc/${i}.jpg`, true);
    }

    const saida = await caso.executar({ usuarioId: usuarioId.value, limite: 5 });

    expect(saida.ultimasLeituras).toHaveLength(5);
  });

  it('diz se o arquivo da foto existe mesmo no aparelho', async () => {
    const { caso, leitura } = await cenario();
    await leitura(1, 1000, 'file:///doc/existe.jpg', true);
    await leitura(2, 900, 'file:///doc/sumiu.jpg', false);

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    const porUri = new Map(saida.ultimasLeituras.map((l) => [l.fotoLocalUri, l.fotoExiste]));
    expect(porUri.get('file:///doc/existe.jpg')).toBe(true);
    // As leituras do seed apontam para um arquivo que nunca existiu: é
    // justamente isto que a tela precisa mostrar, em vez de fingir que está lá.
    expect(porUri.get('file:///doc/sumiu.jpg')).toBe(false);
  });

  it('carrega valor, dia local e status de cada leitura', async () => {
    const { caso, leitura } = await cenario();
    const registrada = await leitura(1, 1234.5, 'file:///doc/a.jpg', true);

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    const primeira = saida.ultimasLeituras[0];
    expect(primeira.leituraId).toBe(registrada.id.value);
    expect(primeira.valorConsumo).toBe(1234.5);
    expect(primeira.dataLocal).toBe(registrada.dataLocal.value);
    expect(primeira.status).toBe(StatusLeituraEnum.REGISTRADA);
  });

  it('funciona com o banco ainda vazio de leituras', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.ultimasLeituras).toEqual([]);
  });
});

describe('ConsultarDiagnosticoUseCase — quando o disco não responde', () => {
  it('marca a foto como não verificada em vez de afirmar que sumiu', async () => {
    const leituraRepo = new LeituraRepositoryMemory();
    const arquivoFoto = new ArquivoFotoGatewayFake();
    const caso = new ConsultarDiagnosticoUseCase(
      new DiagnosticoLocalFake(),
      leituraRepo,
      arquivoFoto,
    );

    const medidoEm = new Date(Date.UTC(2026, 2, 9, 15));
    await leituraRepo.salvar(
      new Leitura({
        id: UUIDv4.gerar(),
        padraoId: UUIDv4.gerar(),
        usuarioId,
        valorConsumo: new ValorKwh(1000),
        fotoLocalUri: 'file:///doc/x.jpg',
        medidoEm,
        dataLocal: DataLocal.de(medidoEm),
      }),
    );

    // É o que a API de arquivos do Expo faz na web.
    arquivoFoto.existe = async () => {
      throw new Error('this.validatePath is not a function');
    };

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    expect(saida.ultimasLeituras[0].fotoExiste).toBeNull();
  });
});
