import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { EmpresaRepositorySQLite } from '../repositories/EmpresaRepositorySQLite';
import { EnderecoRepositorySQLite } from '../repositories/EnderecoRepositorySQLite';
import { PadraoRepositorySQLite } from '../repositories/PadraoRepositorySQLite';
import { UsuarioRepositorySQLite } from '../repositories/UsuarioRepositorySQLite';
import { LeituraRepositorySQLite } from '../repositories/LeituraRepositorySQLite';
import { NotificacaoRepositorySQLite } from '../repositories/NotificacaoRepositorySQLite';

/**
 * Senha única dos três usuários de demonstração. Está aqui e em
 * docs/credenciais-demo.md de propósito: é dado de teste de um banco local,
 * não credencial de produção.
 */
export const SENHA_DEMO = 'Equinox@2026';

/**
 * As fotos do seed apontam para um arquivo que não existe no aparelho — são
 * leituras históricas de demonstração, criadas sem passar pela câmera. A tela
 * mostra o espaço da foto vazio nessas, e só nessas.
 */
const FOTO_SEED = 'file:///documents/leituras/seed-demo.jpg';

/** UUIDs fixos: um re-run manual do seed não duplica nada. */
const id = (prefixo: string, n: number): UUIDv4 =>
  new UUIDv4(`${prefixo}000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

const EMPRESA = (n: number) => id('1a', n);
const ENDERECO = (n: number) => id('2b', n);
const PADRAO = (n: number) => id('3c', n);
const USUARIO = (n: number) => id('4d', n);
const LEITURA = (n: number) => id('5e', n);
const NOTIFICACAO = (n: number) => id('6f', n);

/** Instante de N dias atrás, às 10h de Brasília. */
function diasAtras(agora: Date, dias: number): Date {
  const alvo = new Date(agora.getTime() - dias * 86_400_000);
  // 13h UTC = 10h em Brasília.
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate(), 13));
}

export function criarMigracaoSeedDemo(
  hashSenha: IHashSenhaGateway,
  relogio: IRelogio = relogioSistema,
): Migracao {
  return {
    versao: 2,
    nome: '002_seed_demo',

    async aplicar(db: SQLiteDatabase): Promise<void> {
      const agora = relogio.agora();

      const empresaRepo = new EmpresaRepositorySQLite(db);
      const enderecoRepo = new EnderecoRepositorySQLite(db);
      const padraoRepo = new PadraoRepositorySQLite(db);
      const usuarioRepo = new UsuarioRepositorySQLite(db);
      const leituraRepo = new LeituraRepositorySQLite(db);
      const notificacaoRepo = new NotificacaoRepositorySQLite(db);

      // ---------------------------------------------------------- empresas
      const equinox = new Empresa({
        id: EMPRESA(1),
        nome: 'Equinox Energia Solar',
        cnpj: new CNPJ('19131243000197'),
        dataCriacao: agora,
      });
      const condominio = new Empresa({
        id: EMPRESA(2),
        nome: 'Condomínio Solar do Vale',
        cnpj: new CNPJ('11222333000181'),
        dataCriacao: agora,
      });
      await empresaRepo.salvar(equinox);
      await empresaRepo.salvar(condominio);

      // --------------------------------------------------------- endereços
      const enderecos = [
        new Endereco({
          id: ENDERECO(1), empresaId: equinox.id,
          apelido: 'Sede administrativa', uc: '3001234567',
          rua: 'Avenida Afonso Pena', numero: '1500', bairro: 'Centro', cidade: 'Belo Horizonte',
          coordenadas: new CoordenadasGPS(-19.9191, -43.9386),
          criadoEm: agora,
        }),
        new Endereco({
          id: ENDERECO(2), empresaId: equinox.id,
          apelido: 'Galpão Savassi', uc: '3002345678',
          rua: 'Rua Pernambuco', numero: '1200', bairro: 'Savassi', cidade: 'Belo Horizonte',
          coordenadas: new CoordenadasGPS(-19.9385, -43.9355),
          criadoEm: agora,
        }),
        new Endereco({
          id: ENDERECO(3), empresaId: equinox.id,
          apelido: 'Usina Pampulha', uc: '3003456789', ehUsina: true,
          rua: 'Avenida Otacílio Negrão de Lima', bairro: 'Pampulha', cidade: 'Belo Horizonte',
          coordenadas: new CoordenadasGPS(-19.8519, -43.9794),
          criadoEm: agora,
        }),
        new Endereco({
          id: ENDERECO(4), empresaId: equinox.id,
          apelido: 'Depósito Contagem', uc: '3004567890',
          bairro: 'Eldorado', cidade: 'Contagem',
          // Sem coordenada de propósito: exercita o caminho "endereço sem
          // geocerca", em que a distância não é conferida.
          criadoEm: agora,
        }),
        new Endereco({
          id: ENDERECO(5), empresaId: condominio.id,
          apelido: 'Bloco A', uc: '3005678901',
          rua: 'Rua das Palmeiras', numero: '45', cidade: 'Nova Lima',
          coordenadas: new CoordenadasGPS(-19.9856, -43.8469),
          criadoEm: agora,
        }),
        new Endereco({
          id: ENDERECO(6), empresaId: condominio.id,
          apelido: 'Usina do condomínio', uc: '3006789012', ehUsina: true,
          rua: 'Rua das Palmeiras', numero: '45', cidade: 'Nova Lima',
          coordenadas: new CoordenadasGPS(-19.9861, -43.8475),
          criadoEm: agora,
        }),
      ];
      for (const endereco of enderecos) await enderecoRepo.salvar(endereco);

      // ----------------------------------------------------------- padrões
      const padroes = [
        new PadraoCemig({ id: PADRAO(1), enderecoId: ENDERECO(1), numero: '778811', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(2), enderecoId: ENDERECO(1), numero: '778812', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(3), enderecoId: ENDERECO(2), numero: '881122', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(4), enderecoId: ENDERECO(3), numero: '993344', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(5), enderecoId: ENDERECO(4), numero: '114455', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(6), enderecoId: ENDERECO(5), numero: '225566', criadoEm: agora }),
        new PadraoCemig({ id: PADRAO(7), enderecoId: ENDERECO(6), numero: '336677', criadoEm: agora }),
      ];
      for (const padrao of padroes) await padraoRepo.salvar(padrao);

      // ---------------------------------------------------------- usuários
      const senha = await hashSenha.gerar(SENHA_DEMO);

      const superAdmin = new Usuario({
        id: USUARIO(1),
        // Super admin não pertence a empresa: o escopo dele é global.
        empresaId: null,
        nome: 'Ana Superintendente', usuario: 'super', email: 'super@equinox.dev',
        senha, perfil: PerfilEnum.SUPER_ADMIN, status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: [], criadoEm: agora, autorizadoEm: agora,
      });
      const admin = new Usuario({
        id: USUARIO(2), empresaId: equinox.id,
        nome: 'Carlos Administrador', usuario: 'admin', email: 'admin@equinox.dev',
        senha, perfil: PerfilEnum.ADMIN, status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: [ENDERECO(1), ENDERECO(2), ENDERECO(3), ENDERECO(4)],
        criadoEm: agora, autorizadoEm: agora,
      });
      const tecnico = new Usuario({
        id: USUARIO(3), empresaId: equinox.id,
        nome: 'João da Silva', usuario: 'tecnico', email: 'tecnico@equinox.dev',
        senha, perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
        enderecosVinculados: [ENDERECO(1), ENDERECO(3), ENDERECO(4)],
        criadoEm: agora, autorizadoEm: agora,
      });
      // Pendente, para a tela de autorizações abrir com algo para decidir.
      const pendente = new Usuario({
        id: USUARIO(4), empresaId: equinox.id,
        nome: 'Maria Souza', usuario: 'maria.souza', email: 'maria@equinox.dev',
        senha, perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.PENDENTE,
        enderecosVinculados: [], criadoEm: diasAtras(agora, 2),
      });

      for (const usuario of [superAdmin, admin, tecnico, pendente]) {
        await usuarioRepo.salvar(usuario);
      }

      // ---------------------------------------------------------- leituras
      // Medidor é acumulado: dia mais antigo tem valor menor. Isso dá
      // referência para o aviso de valor menor na primeira leitura real.
      const historico: { padrao: UUIDv4; dias: number; consumo: number; injecao?: number }[] = [
        { padrao: PADRAO(1), dias: 12, consumo: 10_240 },
        { padrao: PADRAO(1), dias: 5, consumo: 10_890 },
        { padrao: PADRAO(1), dias: 1, consumo: 11_150 },
        { padrao: PADRAO(2), dias: 6, consumo: 4_310 },
        { padrao: PADRAO(2), dias: 1, consumo: 4_480 },
        { padrao: PADRAO(3), dias: 3, consumo: 22_700 },
        { padrao: PADRAO(4), dias: 9, consumo: 31_200, injecao: 18_400 },
        { padrao: PADRAO(4), dias: 2, consumo: 32_050, injecao: 19_120 },
        { padrao: PADRAO(5), dias: 4, consumo: 1_980 },
        { padrao: PADRAO(6), dias: 2, consumo: 7_640 },
        { padrao: PADRAO(7), dias: 2, consumo: 15_300, injecao: 9_870 },
      ];

      let sequencia = 1;
      for (const item of historico) {
        const medidoEm = diasAtras(agora, item.dias);
        const leitura = new Leitura({
          id: LEITURA(sequencia),
          padraoId: item.padrao,
          usuarioId: tecnico.id,
          valorConsumo: new ValorKwh(item.consumo),
          valorInjecao: item.injecao === undefined ? null : new ValorKwh(item.injecao),
          fotoLocalUri: FOTO_SEED,
          coordenadas: new CoordenadasGPS(-19.9191, -43.9386),
          medidoEm,
          dataLocal: DataLocal.de(medidoEm),
          // Histórico já conferido, para o varredor de atraso não acusar tudo.
          status: StatusLeituraEnum.APROVADA,
          decididaEm: agora,
          decididaPorId: admin.id,
        });
        await leituraRepo.salvar(leitura);
        sequencia += 1;
      }

      // Uma leitura deliberadamente atrasada e sem decisão, para a central de
      // notificações abrir com um caso real aguardando aprovação.
      const medidoEmAtrasada = diasAtras(agora, 11);
      const atrasada = new Leitura({
        id: LEITURA(90),
        padraoId: PADRAO(3),
        usuarioId: tecnico.id,
        valorConsumo: new ValorKwh(22_410),
        fotoLocalUri: FOTO_SEED,
        coordenadas: new CoordenadasGPS(-19.9385, -43.9355),
        medidoEm: medidoEmAtrasada,
        dataLocal: DataLocal.de(medidoEmAtrasada),
        status: StatusLeituraEnum.REGISTRADA,
      });
      await leituraRepo.salvar(atrasada);

      // ----------------------------------------------------- notificações
      await notificacaoRepo.salvarVarias([
        new Notificacao({
          id: NOTIFICACAO(1), empresaId: equinox.id,
          tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
          titulo: 'Leitura atrasada no padrão 881122',
          mensagem:
            'Galpão Savassi: leitura do dia '
            + `${DataLocal.de(medidoEmAtrasada).paraBr()} registrada com 11 dias de atraso por `
            + 'João da Silva. Confirme ou descarte.',
          criadaEm: diasAtras(agora, 1),
          requerAcao: true,
          leituraId: atrasada.id,
        }),
        new Notificacao({
          id: NOTIFICACAO(2), empresaId: equinox.id,
          tipo: TipoNotificacaoEnum.LEITURA_SEM_GPS,
          titulo: 'Leitura sem GPS no padrão 114455',
          mensagem:
            'Depósito Contagem: João da Silva registrou a leitura sem localização. '
            + 'A foto do medidor segue como comprovante.',
          criadaEm: diasAtras(agora, 3),
        }),
        new Notificacao({
          id: NOTIFICACAO(3), empresaId: condominio.id,
          tipo: TipoNotificacaoEnum.LEITURA_VALOR_MENOR,
          titulo: 'Valor menor no padrão 225566',
          mensagem:
            'Bloco A: a última leitura deste padrão foi 7.900 kWh. '
            + 'Foi digitado 7.640 kWh. Registrada por João da Silva.',
          criadaEm: diasAtras(agora, 2),
          lida: true,
        }),
      ]);
    },
  };
}
