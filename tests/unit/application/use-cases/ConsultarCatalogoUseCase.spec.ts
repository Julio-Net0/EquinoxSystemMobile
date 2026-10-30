import { ConsultarCatalogoUseCase } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { PadraoRepositoryMemory } from '@/infrastructure/fakes/PadraoRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';

const empresaId = UUIDv4.gerar();
const usuarioId = UUIDv4.gerar();

async function cenario() {
  const leituraRepo = new LeituraRepositoryMemory();
  const padraoRepo = new PadraoRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const caso = new ConsultarCatalogoUseCase(enderecoRepo, padraoRepo, leituraRepo);

  const sede = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Sede administrativa', uc: '3001234567',
    rua: 'Rua das Flores', numero: '123', cidade: 'Belo Horizonte',
  });
  const usina = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Usina Campo Verde', uc: '3009999999', ehUsina: true,
  });
  const alheio = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Não vinculado', uc: '3000000000',
  });
  for (const e of [sede, usina, alheio]) await enderecoRepo.salvar(e);
  enderecoRepo.vincular(usuarioId, [sede.id, usina.id]);

  const padraoSede = new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: sede.id, numero: '778811' });
  const padraoUsina = new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: usina.id, numero: '778812' });
  const padraoAlheio = new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: alheio.id, numero: '000000' });
  for (const p of [padraoSede, padraoUsina, padraoAlheio]) await padraoRepo.salvar(p);

  async function leitura(padraoId: UUIDv4, dataLocalIso: string, valor: number) {
    const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
    const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, 15));
    const l = new Leitura({
      id: UUIDv4.gerar(), padraoId, usuarioId,
      valorConsumo: new ValorKwh(valor),
      fotoLocalUri: 'file:///documents/leituras/foto.jpg',
      medidoEm, dataLocal: DataLocal.de(medidoEm),
    });
    await leituraRepo.salvar(l);
    return l;
  }

  return { caso, sede, usina, padraoSede, padraoUsina, padraoAlheio, leitura, leituraRepo };
}

describe('ConsultarCatalogoUseCase', () => {
  it('traz só os endereços vinculados ao usuário', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.enderecos.map((e) => e.apelido)).toEqual([
      'Sede administrativa',
      'Usina Campo Verde',
    ]);
  });

  it('marca qual endereço é usina, para a tela mostrar o campo de injeção', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.enderecos.map((e) => e.ehUsina)).toEqual([false, true]);
  });

  it('inclui o logradouro montado', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.enderecos[0].logradouro).toBe('Rua das Flores, 123 · Belo Horizonte');
  });

  it('aninha os padrões de cada endereço', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.enderecos[0].padroes.map((p) => p.numero)).toEqual(['778811']);
    expect(saida.enderecos[1].padroes.map((p) => p.numero)).toEqual(['778812']);
  });

  it('traz a última leitura vigente de cada padrão', async () => {
    const { caso, padraoSede, leitura } = await cenario();
    await leitura(padraoSede.id, '2026-03-01', 1000);
    await leitura(padraoSede.id, '2026-03-09', 1800);

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    const ultima = saida.enderecos[0].padroes[0].ultimaLeitura;
    expect(ultima?.valorConsumo).toBe(1800);
    expect(ultima?.dataLocal).toBe('2026-03-09');
  });

  it('deixa a última leitura nula num padrão nunca lido', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: usuarioId.value });
    expect(saida.enderecos[0].padroes[0].ultimaLeitura).toBeNull();
  });

  it('ignora leitura substituída ao dizer qual foi a última', async () => {
    const { caso, padraoSede, leitura, leituraRepo } = await cenario();
    const antiga = await leitura(padraoSede.id, '2026-03-09', 9999);
    const corrigida = await leitura(padraoSede.id, '2026-03-09', 1800);
    antiga.substituirPor(corrigida, new Date());
    await leituraRepo.atualizar(antiga);

    const saida = await caso.executar({ usuarioId: usuarioId.value });

    expect(saida.enderecos[0].padroes[0].ultimaLeitura?.valorConsumo).toBe(1800);
  });

  it('devolve catálogo vazio para usuário sem vínculo', async () => {
    const { caso } = await cenario();
    const saida = await caso.executar({ usuarioId: UUIDv4.gerar().value });
    expect(saida.enderecos).toEqual([]);
  });
});
