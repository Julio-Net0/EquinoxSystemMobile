import { ConsultarLeiturasDiaUsinaUseCase } from '@/application/use-cases/ConsultarLeiturasDiaUsinaUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { relogioFixo } from '@/domain/services/Relogio';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { PadraoRepositoryMemory } from '@/infrastructure/fakes/PadraoRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';

const AGORA = new Date(Date.UTC(2026, 2, 10, 15)); // 10/03/2026 12:00 BRT
const HOJE_ISO = '2026-03-10';

async function setup() {
  const leituraRepo = new LeituraRepositoryMemory();
  const padraoRepo = new PadraoRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();
  const empresaRepo = new EmpresaRepositoryMemory();
  const relogio = relogioFixo(AGORA);

  const caso = new ConsultarLeiturasDiaUsinaUseCase(
    enderecoRepo,
    padraoRepo,
    leituraRepo,
    usuarioRepo,
    empresaRepo,
    relogio,
  );

  const empresaA = new Empresa({
    id: UUIDv4.gerar(),
    nome: 'Empresa Solar Alfa',
    cnpj: new CNPJ('19131243000197'),
  });
  const empresaB = new Empresa({
    id: UUIDv4.gerar(),
    nome: 'Empresa Solar Beta',
    cnpj: new CNPJ('11222333000181'),
  });
  await empresaRepo.salvar(empresaA);
  await empresaRepo.salvar(empresaB);

  const senha = new SenhaHash('sha256-iter', 10_000, 'a'.repeat(32), 'b'.repeat(64));

  const adminA = new Usuario({
    id: UUIDv4.gerar(),
    empresaId: empresaA.id,
    nome: 'Admin Alfa',
    usuario: 'admin.alfa',
    email: 'admin@alfa.com',
    senha,
    perfil: PerfilEnum.ADMIN,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [],
  });

  const superAdmin = new Usuario({
    id: UUIDv4.gerar(),
    empresaId: null,
    nome: 'Super Admin',
    usuario: 'super.admin',
    email: 'super@global.com',
    senha,
    perfil: PerfilEnum.SUPER_ADMIN,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [],
  });

  const tecnico = new Usuario({
    id: UUIDv4.gerar(),
    empresaId: empresaA.id,
    nome: 'Técnico Fulano',
    usuario: 'tecnico.fulano',
    email: 'tecnico@alfa.com',
    senha,
    perfil: PerfilEnum.TECNICO,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [],
  });

  await usuarioRepo.salvar(adminA);
  await usuarioRepo.salvar(superAdmin);
  await usuarioRepo.salvar(tecnico);

  // Endereços: Usina A1 e Comum A2 para empresa A, Usina B1 para empresa B
  const usinaA1 = new Endereco({
    id: UUIDv4.gerar(),
    empresaId: empresaA.id,
    apelido: 'Usina Pampulha',
    uc: '3001111111',
    ehUsina: true,
    rua: 'Av. Negrão de Lima',
    numero: '100',
    cidade: 'Belo Horizonte',
  });
  const comumA2 = new Endereco({
    id: UUIDv4.gerar(),
    empresaId: empresaA.id,
    apelido: 'Sede Escritório',
    uc: '3002222222',
    ehUsina: false,
  });
  const usinaB1 = new Endereco({
    id: UUIDv4.gerar(),
    empresaId: empresaB.id,
    apelido: 'Usina Betim',
    uc: '3003333333',
    ehUsina: true,
    cidade: 'Betim',
  });

  await enderecoRepo.salvar(usinaA1);
  await enderecoRepo.salvar(comumA2);
  await enderecoRepo.salvar(usinaB1);

  // Padrões de Usina A1: dois medidores
  const padrao1 = new PadraoCemig({
    id: UUIDv4.gerar(),
    enderecoId: usinaA1.id,
    numero: 'PAD-01',
  });
  const padrao2 = new PadraoCemig({
    id: UUIDv4.gerar(),
    enderecoId: usinaA1.id,
    numero: 'PAD-02',
  });
  // Padrão de Usina B1
  const padraoB = new PadraoCemig({
    id: UUIDv4.gerar(),
    enderecoId: usinaB1.id,
    numero: 'PAD-B1',
  });

  await padraoRepo.salvar(padrao1);
  await padraoRepo.salvar(padrao2);
  await padraoRepo.salvar(padraoB);

  return {
    caso,
    empresaA,
    empresaB,
    adminA,
    superAdmin,
    tecnico,
    usinaA1,
    comumA2,
    usinaB1,
    padrao1,
    padrao2,
    padraoB,
    leituraRepo,
    padraoRepo,
  };
}

describe('ConsultarLeiturasDiaUsinaUseCase', () => {
  it('recusa acesso para usuários com perfil Técnico', async () => {
    const { caso, tecnico } = await setup();

    const resultado = await caso.executar({ atorId: tecnico.id.value });
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe('Seu perfil não permite acessar o monitoramento de leituras');
  });

  it('recusa quando atorId não existe', async () => {
    const { caso } = await setup();

    const resultado = await caso.executar({ atorId: UUIDv4.gerar().value });
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe('Sessão inválida');
  });

  it('admin lista todos os endereços da própria empresa, usina ou não', async () => {
    const { caso, adminA, usinaA1, comumA2 } = await setup();

    const resultado = await caso.executar({ atorId: adminA.id.value });
    expect(resultado.sucesso).toBe(true);
    expect(resultado.usinas.map((u) => [u.id, u.ehUsina])).toEqual([
      [usinaA1.id.value, true],
      [comumA2.id.value, false],
    ]);
  });

  it('super admin lista os endereços de todas as empresas', async () => {
    const { caso, superAdmin, usinaA1, comumA2, usinaB1 } = await setup();

    const resultado = await caso.executar({ atorId: superAdmin.id.value });
    expect(resultado.sucesso).toBe(true);
    expect(resultado.usinas.map((u) => u.apelido).sort()).toEqual(
      [usinaA1.apelido, comumA2.apelido, usinaB1.apelido].sort(),
    );
  });

  it('abre um endereço comum, sem injeção, como qualquer outro', async () => {
    const { caso, adminA, comumA2, tecnico, leituraRepo, padraoRepo } = await setup();
    const padraoComum = new PadraoCemig({
      id: UUIDv4.gerar(),
      enderecoId: comumA2.id,
      numero: 'PAD-SEDE',
    });
    await padraoRepo.salvar(padraoComum);
    await leituraRepo.salvar(
      new Leitura({
        id: UUIDv4.gerar(),
        padraoId: padraoComum.id,
        usuarioId: tecnico.id,
        valorConsumo: new ValorKwh(4200),
        fotoLocalUri: 'leituras/sede.jpg',
        medidoEm: AGORA,
        dataLocal: DataLocal.de(AGORA),
      }),
    );

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: comumA2.id.value,
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.usinaSelecionada?.ehUsina).toBe(false);
    expect(resultado.medidores).toHaveLength(1);
    expect(resultado.medidores[0].leituraVigente).toMatchObject({
      valorConsumo: 4200,
      valorInjecao: null,
    });
  });

  it('seleciona por padrão a primeira usina quando usinaId não é informado', async () => {
    const { caso, adminA, usinaA1 } = await setup();

    const resultado = await caso.executar({ atorId: adminA.id.value });
    expect(resultado.usinaSelecionada?.id).toBe(usinaA1.id.value);
    expect(resultado.dataLocal).toBe(HOJE_ISO);
  });

  it('recusa se o admin tentar consultar uma usina de outra empresa', async () => {
    const { caso, adminA, usinaB1 } = await setup();

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaB1.id.value,
    });
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe('Endereço não encontrado ou fora do seu escopo');
  });

  it('identifica quais medidores tiveram leituras no dia e quais estão pendentes', async () => {
    const { caso, adminA, usinaA1, padrao1, padrao2, tecnico, leituraRepo } = await setup();

    // Registra leitura no padrao1 para hoje
    const medidoEm = new Date(Date.UTC(2026, 2, 10, 13, 30));
    const l1 = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5000),
      valorInjecao: new ValorKwh(3200),
      fotoLocalUri: 'file:///foto1.jpg',
      medidoEm,
      dataLocal: DataLocal.de(medidoEm),
      status: StatusLeituraEnum.REGISTRADA,
    });
    await leituraRepo.salvar(l1);

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaA1.id.value,
      dataLocal: HOJE_ISO,
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.medidores).toHaveLength(2);

    const m1 = resultado.medidores.find((m) => m.padraoId === padrao1.id.value);
    const m2 = resultado.medidores.find((m) => m.padraoId === padrao2.id.value);

    expect(m1?.teveLeitura).toBe(true);
    expect(m1?.leituraVigente?.valorConsumo).toBe(5000);
    expect(m1?.leituraVigente?.valorInjecao).toBe(3200);
    expect(m1?.leituraVigente?.autorNome).toBe(tecnico.nome);
    expect(m1?.temSubstituicao).toBe(false);

    expect(m2?.teveLeitura).toBe(false);
    expect(m2?.leituraVigente).toBeNull();
  });

  it('detecta e expande leituras substituídas no mesmo dia', async () => {
    const { caso, adminA, usinaA1, padrao1, tecnico, leituraRepo } = await setup();

    // Primeira leitura do dia às 10h (que depois foi substituída)
    const medidoEm1 = new Date(Date.UTC(2026, 2, 10, 13, 0)); // 10h BRT
    const medidoEm2 = new Date(Date.UTC(2026, 2, 10, 17, 0)); // 14h BRT

    const lNova = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5200),
      valorInjecao: new ValorKwh(3300),
      fotoLocalUri: 'file:///fotoNova.jpg',
      medidoEm: medidoEm2,
      dataLocal: DataLocal.de(medidoEm2),
      status: StatusLeituraEnum.REGISTRADA,
    });

    const lAntiga = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5100),
      valorInjecao: new ValorKwh(3250),
      fotoLocalUri: 'file:///fotoAntiga.jpg',
      medidoEm: medidoEm1,
      dataLocal: DataLocal.de(medidoEm1),
      status: StatusLeituraEnum.SUBSTITUIDA,
      substituidaEm: medidoEm2,
      substituidaPorId: lNova.id,
    });

    await leituraRepo.salvar(lAntiga);
    await leituraRepo.salvar(lNova);

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaA1.id.value,
      dataLocal: HOJE_ISO,
    });

    const m1 = resultado.medidores.find((m) => m.padraoId === padrao1.id.value);
    expect(m1?.teveLeitura).toBe(true);
    expect(m1?.temSubstituicao).toBe(true);
    expect(m1?.substituicoes).toHaveLength(1);
    expect(m1?.substituicoes[0].id).toBe(lAntiga.id.value);
    expect(m1?.substituicoes[0].valorConsumo).toBe(5100);
    expect(m1?.leituraVigente?.id).toBe(lNova.id.value);
    expect(m1?.leituraVigente?.valorConsumo).toBe(5200);
  });

  it('emite alerta de leitura fora do padrão do histórico quando o valor é menor que o anterior', async () => {
    const { caso, adminA, usinaA1, padrao1, tecnico, leituraRepo } = await setup();

    // Leitura histórica anterior (ontem): 6000 kWh consumo, 4000 kWh injeção
    const ontemMedicao = new Date(Date.UTC(2026, 2, 9, 15, 0));
    const leituraHistorica = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(6000),
      valorInjecao: new ValorKwh(4000),
      fotoLocalUri: 'file:///fotoOntem.jpg',
      medidoEm: ontemMedicao,
      dataLocal: DataLocal.de(ontemMedicao),
      status: StatusLeituraEnum.APROVADA,
    });
    await leituraRepo.salvar(leituraHistorica);

    // Leitura de hoje com valor menor (anômalo): 5500 kWh consumo
    const hojeMedicao = new Date(Date.UTC(2026, 2, 10, 15, 0));
    const leituraHoje = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5500),
      valorInjecao: new ValorKwh(4100),
      fotoLocalUri: 'file:///fotoHoje.jpg',
      medidoEm: hojeMedicao,
      dataLocal: DataLocal.de(hojeMedicao),
      status: StatusLeituraEnum.REGISTRADA,
    });
    await leituraRepo.salvar(leituraHoje);

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaA1.id.value,
      dataLocal: HOJE_ISO,
    });

    const m1 = resultado.medidores.find((m) => m.padraoId === padrao1.id.value);
    expect(m1?.alertaForaPadrao).not.toBeNull();
    expect(m1?.alertaForaPadrao).toContain('A última leitura deste padrão foi 6.000 kWh');
    expect(m1?.alertaForaPadrao).toContain('Você digitou 5.500 kWh');
  });

  it('calcula métricas de resumo consolidadas do dia', async () => {
    const { caso, adminA, usinaA1, padrao1, padrao2, tecnico, leituraRepo } = await setup();

    // Ontem: 6000 kWh
    const ontemMedicao = new Date(Date.UTC(2026, 2, 9, 15, 0));
    await leituraRepo.salvar(
      new Leitura({
        id: UUIDv4.gerar(),
        padraoId: padrao1.id,
        usuarioId: tecnico.id,
        valorConsumo: new ValorKwh(6000),
        valorInjecao: new ValorKwh(4000),
        fotoLocalUri: 'file:///ontem.jpg',
        medidoEm: ontemMedicao,
        dataLocal: DataLocal.de(ontemMedicao),
        status: StatusLeituraEnum.APROVADA,
      }),
    );

    // Hoje: 1 leitura substituída e 1 vigente no padrao1 (com valor menor gerando alerta)
    const agoraHoje = new Date(Date.UTC(2026, 2, 10, 15, 0));
    const lNova = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5800),
      valorInjecao: new ValorKwh(4100),
      fotoLocalUri: 'file:///hoje.jpg',
      medidoEm: agoraHoje,
      dataLocal: DataLocal.de(agoraHoje),
      status: StatusLeituraEnum.REGISTRADA,
    });
    const lAntiga = new Leitura({
      id: UUIDv4.gerar(),
      padraoId: padrao1.id,
      usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(5700),
      valorInjecao: new ValorKwh(4050),
      fotoLocalUri: 'file:///antiga.jpg',
      medidoEm: new Date(Date.UTC(2026, 2, 10, 14, 0)),
      dataLocal: DataLocal.de(agoraHoje),
      status: StatusLeituraEnum.SUBSTITUIDA,
      substituidaEm: agoraHoje,
      substituidaPorId: lNova.id,
    });
    await leituraRepo.salvar(lAntiga);
    await leituraRepo.salvar(lNova);

    // padrao2 sem leitura hoje

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaA1.id.value,
      dataLocal: HOJE_ISO,
    });

    expect(resultado.resumo.totalMedidores).toBe(2);
    expect(resultado.resumo.medidoresComLeitura).toBe(1);
    expect(resultado.resumo.medidoresSemLeitura).toBe(1);
    expect(resultado.resumo.totalSubstituicoes).toBe(1);
    expect(resultado.resumo.totalAlertas).toBe(1);
  });

  it('retorna a lista de dias que tiveram leituras na usina para marcar no calendário', async () => {
    const { caso, adminA, usinaA1, padrao1, tecnico, leituraRepo } = await setup();

    const d1 = new Date(Date.UTC(2026, 2, 5, 15, 0)); // 2026-03-05
    const d2 = new Date(Date.UTC(2026, 2, 10, 15, 0)); // 2026-03-10

    await leituraRepo.salvar(
      new Leitura({
        id: UUIDv4.gerar(),
        padraoId: padrao1.id,
        usuarioId: tecnico.id,
        valorConsumo: new ValorKwh(1000),
        fotoLocalUri: 'file:///f1.jpg',
        medidoEm: d1,
        dataLocal: DataLocal.de(d1),
        status: StatusLeituraEnum.APROVADA,
      }),
    );

    await leituraRepo.salvar(
      new Leitura({
        id: UUIDv4.gerar(),
        padraoId: padrao1.id,
        usuarioId: tecnico.id,
        valorConsumo: new ValorKwh(1200),
        fotoLocalUri: 'file:///f2.jpg',
        medidoEm: d2,
        dataLocal: DataLocal.de(d2),
        status: StatusLeituraEnum.REGISTRADA,
      }),
    );

    const resultado = await caso.executar({
      atorId: adminA.id.value,
      usinaId: usinaA1.id.value,
    });

    expect(resultado.diasComLeitura).toContain('2026-03-05');
    expect(resultado.diasComLeitura).toContain('2026-03-10');
  });
});
