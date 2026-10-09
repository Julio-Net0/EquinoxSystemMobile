import { SupabaseStorageGateway } from '@/infrastructure/database/supabase/gateways/SupabaseStorageGateway';
import { SupabaseAuthGateway } from '@/infrastructure/database/supabase/gateways/SupabaseAuthGateway';
import { SupabaseDatabaseGateway } from '@/infrastructure/database/supabase/gateways/SupabaseDatabaseGateway';
import { Leitura } from '@/domain/entities/Leitura';
import { Usina } from '@/domain/entities/Usina';
import { Usuario } from '@/domain/entities/Usuario';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('Fase 4 - Supabase Gateways & Storage Integrations', () => {
  let storageGateway: SupabaseStorageGateway;
  let authGateway: SupabaseAuthGateway;
  let databaseGateway: SupabaseDatabaseGateway;

  beforeEach(() => {
    storageGateway = new SupabaseStorageGateway();
    authGateway = new SupabaseAuthGateway();
    databaseGateway = new SupabaseDatabaseGateway();
  });

  describe('SupabaseStorageGateway', () => {
    it('deve gerar URL de armazenamento para foto do medidor com fallback seguro em teste', async () => {
      const url = await storageGateway.uploadFotoComprovante({
        caminhoLocal: '/tmp/foto.jpg',
        idLeitura: UUIDv4.gerar().value,
        empresaId: UUIDv4.gerar().value,
        usinaId: UUIDv4.gerar().value,
      });

      expect(url).toBeDefined();
      expect(url).toContain('comprovantes');
      expect(url).toContain('.jpg');
    });
  });

  describe('SupabaseAuthGateway', () => {
    it('deve retornar null graciosamente quando a autenticação remota falhar sem conexao', async () => {
      const res = await authGateway.autenticarComEmailSenha('invalid@equinox.com', '123456');
      expect(res).toBeNull();
    });

    it('deve permitir chamar logout sem lancar excecao', async () => {
      await expect(authGateway.logout()).resolves.not.toThrow();
    });
  });

  describe('SupabaseDatabaseGateway', () => {
    const empresaId = UUIDv4.gerar();
    const usinaId = UUIDv4.gerar();
    const usuarioId = UUIDv4.gerar();
    const leituraId = UUIDv4.gerar();

    it('deve tratar envio de leitura para Supabase graciosamente em ambiente desconectado', async () => {
      const leitura = new Leitura({
        id: leituraId,
        usinaId,
        usuarioId,
        valorKwh: new ValorKwh(1500),
        caminhoImagemLocal: '/tmp/medidor.jpg',
        coordenadas: new CoordenadasGPS(-15.7941, -47.8822),
      });

      const sucesso = await databaseGateway.enviarLeitura(leitura);
      expect(typeof sucesso).toBe('boolean');
    });

    it('deve tratar envio de usina para Supabase graciosamente', async () => {
      const usina = new Usina({
        id: usinaId,
        empresaId,
        nome: 'Usina Solar Sol do Cerrado',
        codigoUC: 'UC-998877',
        capacidadeNominal: 500,
        coordenadas: new CoordenadasGPS(-15.7941, -47.8822),
        status: StatusUsinaEnum.ATIVA,
      });

      const sucesso = await databaseGateway.enviarUsina(usina);
      expect(typeof sucesso).toBe('boolean');
    });

    it('deve tratar envio de usuario para Supabase graciosamente', async () => {
      const usuario = new Usuario({
        id: usuarioId,
        empresaId,
        nome: 'Engenheiro Sol',
        email: 'eng@equinox.com',
        perfil: PerfilEnum.ADMIN,
        status: 'Ativo',
      });

      const sucesso = await databaseGateway.enviarUsuario(usuario);
      expect(typeof sucesso).toBe('boolean');
    });

    it('deve tratar envio de empresa para Supabase graciosamente', async () => {
      const empresa = new Empresa({
        id: empresaId,
        nome: 'Equinox Energy Corp',
        cnpj: new CNPJ('12345678000195'),
      });

      const sucesso = await databaseGateway.enviarEmpresa(empresa);
      expect(typeof sucesso).toBe('boolean');
    });

    it('deve retornar lista de leituras/usinas novas graciosamente em ambiente desconectado', async () => {
      const leituras = await databaseGateway.buscarNovasLeituras(empresaId.value, new Date());
      const usinas = await databaseGateway.buscarNovasUsinas(empresaId.value, new Date());

      expect(Array.isArray(leituras)).toBe(true);
      expect(Array.isArray(usinas)).toBe(true);
    });
  });
});
