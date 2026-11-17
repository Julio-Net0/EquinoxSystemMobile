import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { CredencialOfflineMemory } from '@/infrastructure/fakes/CredencialOfflineMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { ReautenticacaoEmMemoria } from '@/infrastructure/security/ReautenticacaoEmMemoria';

const SESSAO = {
  usuarioId: '4d000000-0000-4000-8000-000000000003',
  empresaId: null,
  nome: 'João',
  usuario: 'tecnico',
  email: 'tecnico@equinox.dev',
  perfil: PerfilEnum.TECNICO,
};

function montar() {
  const credenciais = new CredencialOfflineMemory();
  const pendente = new ReautenticacaoEmMemoria();
  const servico = new AcessoOfflineService(credenciais, new HashSenhaFake(), pendente);
  return { credenciais, pendente, servico };
}

describe('AcessoOfflineService', () => {
  it('lembrar e depois entrar sem rede libera a sessão guardada', async () => {
    const { servico } = montar();
    await servico.lembrar('Tecnico@Equinox.dev', 'abc123', SESSAO);

    expect(await servico.entrarSemRede('tecnico@equinox.dev', 'abc123')).toEqual({
      tipo: 'liberado',
      sessao: SESSAO,
    });
  });

  it('lembrar apaga uma senha que estivesse esperando em memória', async () => {
    const { servico, pendente } = montar();
    pendente.guardar({ email: 'tecnico@equinox.dev', senha: 'velha' });

    await servico.lembrar('tecnico@equinox.dev', 'abc123', SESSAO);

    expect(pendente.obter()).toBeNull();
  });

  it('distingue conta desconhecida de senha errada', async () => {
    const { servico } = montar();
    await servico.lembrar('tecnico@equinox.dev', 'abc123', SESSAO);

    expect((await servico.entrarSemRede('outra@equinox.dev', 'abc123')).tipo).toBe('sem_credencial');
    expect((await servico.entrarSemRede('tecnico@equinox.dev', 'xyz')).tipo).toBe('senha_incorreta');
  });

  it('verificação corrompida no armazenamento não libera ninguém', async () => {
    const { servico, credenciais } = montar();
    await credenciais.guardar('tecnico@equinox.dev', { sessao: SESSAO, verificador: 'lixo' });

    expect((await servico.entrarSemRede('tecnico@equinox.dev', 'abc123')).tipo).toBe('senha_incorreta');
  });

  it('a senha em memória só vale para a conta que a digitou', async () => {
    const { servico } = montar();
    await servico.lembrar('tecnico@equinox.dev', 'abc123', SESSAO);
    await servico.entrarSemRede('tecnico@equinox.dev', 'abc123');

    expect(servico.pendenteDe('TECNICO@equinox.dev')).toEqual({
      email: 'tecnico@equinox.dev',
      senha: 'abc123',
    });
    expect(servico.pendenteDe('outra@equinox.dev')).toBeNull();

    servico.concluirReautenticacao();
    expect(servico.pendenteDe('tecnico@equinox.dev')).toBeNull();
  });

  it('esquecerSeForAMesma só apaga quando a senha recusada pela nuvem é a que o aparelho conhecia', async () => {
    const { servico, credenciais } = montar();
    await servico.lembrar('tecnico@equinox.dev', 'abc123', SESSAO);

    await servico.esquecerSeForAMesma('tecnico@equinox.dev', 'digitou-errado');
    expect(await credenciais.buscar('tecnico@equinox.dev')).not.toBeNull();

    await servico.esquecerSeForAMesma('tecnico@equinox.dev', 'abc123');
    expect(await credenciais.buscar('tecnico@equinox.dev')).toBeNull();
  });
});
