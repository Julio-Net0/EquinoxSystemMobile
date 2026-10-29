import { RegistrarLeituraUseCase } from '@/application/use-cases/RegistrarLeituraUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { PadraoRepositoryMemory } from '@/infrastructure/fakes/PadraoRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { NotificacaoRepositoryMemory } from '@/infrastructure/fakes/NotificacaoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { ArquivoFotoGatewayFake } from '@/infrastructure/fakes/ArquivoFotoGatewayFake';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';

/** 10/03/2026 12:00 em Brasília. */
const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const PRACA_SETE = { latitude: -19.9191, longitude: -43.9386 };
const FOTO_TEMP = 'file:///cache/medidor_fake.jpg';

async function cenario(opcoes: { ehUsina?: boolean; comGeocerca?: boolean } = {}) {
  const leituraRepo = new LeituraRepositoryMemory();
  const padraoRepo = new PadraoRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const notificacaoRepo = new NotificacaoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();
  const arquivoFoto = new ArquivoFotoGatewayFake();

  const caso = new RegistrarLeituraUseCase(
    leituraRepo, padraoRepo, enderecoRepo, notificacaoRepo, usuarioRepo,
    arquivoFoto, relogioFixo(AGORA),
  );

  const empresaId = UUIDv4.gerar();
  const endereco = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Sede administrativa', uc: '3001234567',
    ehUsina: opcoes.ehUsina ?? false,
    coordenadas: (opcoes.comGeocerca ?? true)
      ? new CoordenadasGPS(PRACA_SETE.latitude, PRACA_SETE.longitude)
      : null,
  });
  await enderecoRepo.salvar(endereco);

  const padrao = new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: endereco.id, numero: '778811' });
  await padraoRepo.salvar(padrao);

  const tecnico = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'João da Silva', usuario: 'joao',
    email: 'joao@equinox.dev', senha: await new HashSenhaFake().gerar('Equinox@2026'),
    perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [endereco.id],
  });
  await usuarioRepo.salvar(tecnico);

  const entrada = {
    padraoId: padrao.id.value,
    usuarioId: tecnico.id.value,
    valorConsumo: 12_345,
    valorInjecao: null as number | null,
    fotoTemporariaUri: FOTO_TEMP,
    coordenadas: PRACA_SETE,
    confirmouValorMenor: false,
  };

  /** Leitura histórica vigente, para servir de referência. */
  async function leituraAnterior(dataLocalIso: string, valorConsumo: number) {
    const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
    const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, 15));
    const leitura = new Leitura({
      id: UUIDv4.gerar(), padraoId: padrao.id, usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(valorConsumo),
      fotoLocalUri: 'file:///documents/leituras/antiga.jpg',
      medidoEm, dataLocal: DataLocal.de(medidoEm),
    });
    await leituraRepo.salvar(leitura);
    return leitura;
  }

  return {
    caso, entrada, leituraRepo, notificacaoRepo, arquivoFoto,
    endereco, padrao, tecnico, empresaId, leituraAnterior,
  };
}

describe('RegistrarLeituraUseCase', () => {
  describe('registro bem-sucedido', () => {
    it('grava a leitura com dia local de Brasília', async () => {
      const { caso, entrada, leituraRepo } = await cenario();

      const saida = await caso.executar(entrada);

      expect(saida.sucesso).toBe(true);
      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.valorConsumo.valor).toBe(12_345);
      expect(salva?.dataLocal.value).toBe('2026-03-10');
      expect(salva?.status).toBe(StatusLeituraEnum.REGISTRADA);
    });

    it('comprime e persiste a foto antes de gravar, e guarda a uri permanente', async () => {
      const { caso, entrada, leituraRepo, arquivoFoto } = await cenario();

      const saida = await caso.executar(entrada);

      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.fotoLocalUri).toContain('file:///documents/leituras/');
      expect(salva?.fotoLocalUri).not.toBe(FOTO_TEMP);
      expect(arquivoFoto.salvos.size).toBe(1);
    });

    it('guarda as coordenadas do técnico', async () => {
      const { caso, entrada, leituraRepo } = await cenario();
      const saida = await caso.executar(entrada);
      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.coordenadas?.latitude).toBeCloseTo(PRACA_SETE.latitude);
    });

    it('não gera notificação quando tudo está em ordem', async () => {
      const { caso, entrada, notificacaoRepo } = await cenario();
      await caso.executar(entrada);
      expect(notificacaoRepo.items.size).toBe(0);
    });
  });

  describe('validações', () => {
    it('recusa quando o padrão não existe', async () => {
      const { caso, entrada } = await cenario();
      const saida = await caso.executar({ ...entrada, padraoId: UUIDv4.gerar().value });
      expect(saida.erro).toBe('Padrão não encontrado');
    });

    it('recusa sem a foto do medidor', async () => {
      const { caso, entrada } = await cenario();
      const saida = await caso.executar({ ...entrada, fotoTemporariaUri: '' });
      expect(saida.erro).toBe('Foto comprobatória do medidor é obrigatória');
    });

    it.each([-1, Number.NaN])('recusa o consumo %p', async (valorConsumo) => {
      const { caso, entrada } = await cenario();
      const saida = await caso.executar({ ...entrada, valorConsumo });
      expect(saida.erro).toBe('Informe um valor de leitura válido');
    });

    it('nada é gravado quando a validação falha', async () => {
      const { caso, entrada, leituraRepo, arquivoFoto } = await cenario();
      await caso.executar({ ...entrada, valorConsumo: -1 });
      expect(leituraRepo.items.size).toBe(0);
      expect(arquivoFoto.salvos.size).toBe(0);
    });

    it('propaga a falha ao salvar a foto sem gravar a leitura', async () => {
      const { caso, entrada, leituraRepo, arquivoFoto } = await cenario();
      arquivoFoto.falharAoPersistir = true;

      const saida = await caso.executar(entrada);

      expect(saida.erro).toBe('Não foi possível salvar a foto no aparelho');
      expect(leituraRepo.items.size).toBe(0);
    });
  });

  describe('injeção em endereço de usina', () => {
    it('exige a leitura de injeção', async () => {
      const { caso, entrada } = await cenario({ ehUsina: true });
      const saida = await caso.executar({ ...entrada, valorInjecao: null });
      expect(saida.erro).toBe('Este endereço é uma usina — informe também a leitura de injeção');
    });

    it('grava consumo e injeção', async () => {
      const { caso, entrada, leituraRepo } = await cenario({ ehUsina: true });
      const saida = await caso.executar({ ...entrada, valorInjecao: 8_421 });
      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.valorInjecao?.valor).toBe(8_421);
    });

    it('ignora a injeção informada num endereço comum', async () => {
      const { caso, entrada, leituraRepo } = await cenario({ ehUsina: false });
      const saida = await caso.executar({ ...entrada, valorInjecao: 999 });
      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.valorInjecao).toBeNull();
    });
  });

  describe('aviso de valor menor', () => {
    it('pede confirmação em vez de gravar, e não consome a foto', async () => {
      const { caso, entrada, leituraRepo, arquivoFoto, leituraAnterior } = await cenario();
      await leituraAnterior('2026-03-09', 20_000);

      const saida = await caso.executar({ ...entrada, valorConsumo: 15_000 });

      expect(saida.sucesso).toBe(false);
      expect(saida.precisaConfirmar).toBe(true);
      expect(saida.aviso).toContain('20.000 kWh');
      expect(leituraRepo.items.size).toBe(1);
      expect(arquivoFoto.salvos.size).toBe(0);
    });

    it('grava quando o técnico confirma, e avisa o administrador', async () => {
      const { caso, entrada, notificacaoRepo, leituraAnterior } = await cenario();
      await leituraAnterior('2026-03-09', 20_000);

      const saida = await caso.executar({
        ...entrada, valorConsumo: 15_000, confirmouValorMenor: true,
      });

      expect(saida.sucesso).toBe(true);
      const tipos = [...notificacaoRepo.items.values()].map((n) => n.tipo);
      expect(tipos).toContain(TipoNotificacaoEnum.LEITURA_VALOR_MENOR);
    });

    it('não pede confirmação quando o valor subiu', async () => {
      const { caso, entrada, leituraAnterior } = await cenario();
      await leituraAnterior('2026-03-09', 10_000);
      expect((await caso.executar(entrada)).sucesso).toBe(true);
    });

    it('ignora leitura substituída ao montar a referência', async () => {
      const { caso, entrada, leituraRepo, leituraAnterior } = await cenario();
      const antiga = await leituraAnterior('2026-03-09', 20_000);
      const corrigida = await leituraAnterior('2026-03-09', 9_000);
      antiga.substituirPor(corrigida, AGORA);
      await leituraRepo.atualizar(antiga);

      // 12.345 é maior que a corrigida (9.000), então não deve avisar.
      expect((await caso.executar(entrada)).sucesso).toBe(true);
    });
  });

  describe('substituição no mesmo dia (last-write-wins)', () => {
    it('a nova leitura substitui a vigente do dia', async () => {
      const { caso, entrada, leituraRepo, padrao } = await cenario();
      const primeira = await caso.executar(entrada);

      const segunda = await caso.executar({ ...entrada, valorConsumo: 12_999 });

      expect(segunda.sucesso).toBe(true);
      expect(segunda.substituiuLeituraId).toBe(primeira.leituraId);

      const vigente = await leituraRepo.buscarVigenteDoDia(padrao.id, DataLocal.parse('2026-03-10'));
      expect(vigente?.valorConsumo.valor).toBe(12_999);

      const antiga = await leituraRepo.buscarPorId(new UUIDv4(primeira.leituraId as string));
      expect(antiga?.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
    });

    it('sobra uma só leitura vigente no dia', async () => {
      const { caso, entrada, leituraRepo, padrao } = await cenario();
      await caso.executar(entrada);
      await caso.executar({ ...entrada, valorConsumo: 12_999 });

      const vigentes = await leituraRepo.listarVigentesDoPadrao(padrao.id);
      expect(vigentes).toHaveLength(1);
    });

    it('avisa o administrador da substituição', async () => {
      const { caso, entrada, notificacaoRepo } = await cenario();
      await caso.executar(entrada);
      await caso.executar({ ...entrada, valorConsumo: 12_999 });

      const tipos = [...notificacaoRepo.items.values()].map((n) => n.tipo);
      expect(tipos).toContain(TipoNotificacaoEnum.LEITURA_SUBSTITUIDA);
    });
  });

  describe('localização', () => {
    it('avisa quando a leitura foi feita longe do endereço, sem impedir', async () => {
      const { caso, entrada, notificacaoRepo } = await cenario();

      const saida = await caso.executar({
        ...entrada, coordenadas: { latitude: -19.9321, longitude: -44.0539 },
      });

      expect(saida.sucesso).toBe(true);
      const tipos = [...notificacaoRepo.items.values()].map((n) => n.tipo);
      expect(tipos).toContain(TipoNotificacaoEnum.LEITURA_FORA_DE_RAIO);
    });

    it('grava sem coordenadas quando o GPS não respondeu, e avisa', async () => {
      const { caso, entrada, leituraRepo, notificacaoRepo } = await cenario();

      const saida = await caso.executar({ ...entrada, coordenadas: null });

      expect(saida.sucesso).toBe(true);
      const salva = await leituraRepo.buscarPorId(new UUIDv4(saida.leituraId as string));
      expect(salva?.coordenadas).toBeNull();
      const tipos = [...notificacaoRepo.items.values()].map((n) => n.tipo);
      expect(tipos).toContain(TipoNotificacaoEnum.LEITURA_SEM_GPS);
    });

    it('não confere distância quando o endereço não tem geocerca', async () => {
      const { caso, entrada, notificacaoRepo } = await cenario({ comGeocerca: false });

      const saida = await caso.executar({
        ...entrada, coordenadas: { latitude: -23.5505, longitude: -46.6333 },
      });

      expect(saida.sucesso).toBe(true);
      expect(notificacaoRepo.items.size).toBe(0);
    });
  });

  describe('leitura atrasada', () => {
    it('gera notificação que exige decisão do administrador', async () => {
      const { caso, entrada, notificacaoRepo } = await cenario();

      // Medida 9 dias antes de hoje (10/03).
      const saida = await caso.executar({
        ...entrada,
        medidoEm: new Date(Date.UTC(2026, 2, 1, 15)),
      });

      expect(saida.sucesso).toBe(true);
      const atrasada = [...notificacaoRepo.items.values()].find(
        (n) => n.tipo === TipoNotificacaoEnum.LEITURA_ATRASADA,
      );
      expect(atrasada?.aguardandoDecisao).toBe(true);
      expect(atrasada?.leituraId?.value).toBe(saida.leituraId);
    });
  });
});
