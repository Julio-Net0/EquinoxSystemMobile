import { GerenciarEmpresasUseCase } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { Empresa } from '@/domain/entities/Empresa';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

const hash = new HashSenhaFake();

async function ator(perfil: PerfilEnum) {
  return new Usuario({
    id: UUIDv4.gerar(),
    empresaId: perfil === PerfilEnum.SUPER_ADMIN ? null : UUIDv4.gerar(),
    nome: 'Pessoa',
    usuario: `u${Math.random().toString(36).slice(2, 8)}`,
    email: `${Math.random().toString(36).slice(2, 8)}@equinox.dev`,
    senha: await hash.gerar('Equinox@2026'),
    perfil,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
  });
}

async function cenario() {
  const empresaRepository = new EmpresaRepositoryMemory();
  const usuarioRepository = new UsuarioRepositoryMemory();
  const caso = new GerenciarEmpresasUseCase(empresaRepository, usuarioRepository);

  const superAdmin = await ator(PerfilEnum.SUPER_ADMIN);
  const admin = await ator(PerfilEnum.ADMIN);
  for (const u of [superAdmin, admin]) await usuarioRepository.salvar(u);

  return { caso, empresaRepository, superAdmin, admin };
}

describe('GerenciarEmpresasUseCase', () => {
  describe('criar', () => {
    it('cadastra uma empresa com CNPJ válido', async () => {
      const { caso, empresaRepository, superAdmin } = await cenario();

      const saida = await caso.criar({
        atorId: superAdmin.id.value,
        nome: 'Empresa Solar Brasil',
        cnpj: '12345678000195',
      });

      expect(saida.empresa?.nome).toBe('Empresa Solar Brasil');
      expect(saida.empresa?.cnpj).toBe('12.345.678/0001-95');
      expect(await empresaRepository.buscarPorId(new UUIDv4(saida.empresa!.id))).not.toBeNull();
    });

    it('só o super admin cria empresa', async () => {
      const { caso, empresaRepository, admin } = await cenario();

      const saida = await caso.criar({
        atorId: admin.id.value,
        nome: 'Empresa de outro',
        cnpj: '12345678000195',
      });

      expect(saida.erro).toBe('Apenas o super admin cadastra empresas');
      expect(empresaRepository.items.size).toBe(0);
    });

    it('recusa nome vazio', async () => {
      const { caso, superAdmin } = await cenario();
      const saida = await caso.criar({
        atorId: superAdmin.id.value, nome: '  ', cnpj: '12345678000195',
      });
      expect(saida.erro).toBe('Informe o nome da empresa');
    });

    it('recusa CNPJ inválido com mensagem legível, em vez de estourar', async () => {
      const { caso, superAdmin } = await cenario();
      const saida = await caso.criar({
        atorId: superAdmin.id.value, nome: 'Empresa X', cnpj: '11111111111111',
      });
      expect(saida.erro).toContain('CNPJ');
    });

    it('recusa CNPJ já cadastrado antes de o banco reclamar', async () => {
      const { caso, empresaRepository, superAdmin } = await cenario();
      await empresaRepository.salvar(
        new Empresa({ id: UUIDv4.gerar(), nome: 'Já existe', cnpj: new CNPJ('12345678000195') }),
      );

      const saida = await caso.criar({
        atorId: superAdmin.id.value, nome: 'Outra', cnpj: '12.345.678/0001-95',
      });

      expect(saida.erro).toBe('Já existe empresa com este CNPJ');
    });
  });

  describe('listar', () => {
    it('lista as empresas cadastradas em ordem de nome', async () => {
      const { caso, empresaRepository } = await cenario();
      await empresaRepository.salvar(
        new Empresa({ id: UUIDv4.gerar(), nome: 'Empresa A', cnpj: new CNPJ('12345678000195') }),
      );
      await empresaRepository.salvar(
        new Empresa({ id: UUIDv4.gerar(), nome: 'Empresa B', cnpj: new CNPJ('11222333000181') }),
      );

      const lista = await caso.listar();

      expect(lista.map((e) => e.nome)).toEqual(['Empresa A', 'Empresa B']);
    });

    it('listar é público: a tela de cadastro precisa das empresas sem sessão', async () => {
      const { caso } = await cenario();
      await expect(caso.listar()).resolves.toEqual([]);
    });
  });
});
