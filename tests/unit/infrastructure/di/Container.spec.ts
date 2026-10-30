import { criarContainerFake } from '@/infrastructure/di/criarContainerFake';
import { Container } from '@/infrastructure/di/Container';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

describe('Container', () => {
  it('resolve todos os repositórios', () => {
    const { repos } = criarContainerFake();
    const esperados: (keyof Container['repos'])[] = [
      'empresa', 'endereco', 'padrao', 'leitura', 'usuario', 'notificacao', 'actionQueue',
    ];

    for (const nome of esperados) expect(repos[nome]).toBeDefined();
  });

  it('resolve todos os gateways', () => {
    const { gateways } = criarContainerFake();
    const esperados: (keyof Container['gateways'])[] = [
      'camera', 'location', 'arquivoFoto', 'hashSenha', 'sessao',
    ];

    for (const nome of esperados) expect(gateways[nome]).toBeDefined();
  });

  it('resolve todos os casos de uso', () => {
    const { casos } = criarContainerFake();
    const esperados: (keyof Container['casos'])[] = [
      'autenticar', 'cadastrarPendente', 'autorizar', 'gerenciarUsuarios',
      'gerenciarEmpresas', 'gerenciarEstrutura', 'perfil', 'consultarCatalogo',
      'registrarLeitura', 'decidirLeitura', 'notificacoes', 'avaliarAtrasadas', 'purgar',
    ];

    for (const nome of esperados) expect(casos[nome]).toBeDefined();
  });

  it('um único repositório é compartilhado por todos os casos de uso', async () => {
    // Era exatamente isto que faltava antes: cada tela instanciava o próprio
    // repositório, então um cadastro feito numa tela não existia na outra.
    const container = criarContainerFake();
    const empresa = new Empresa({
      id: UUIDv4.gerar(),
      nome: 'Equinox Energia Solar',
      cnpj: new CNPJ('19131243000197'),
    });

    await container.repos.empresa.salvar(empresa);

    const pelaOutraPonta = await container.casos.gerenciarEmpresas.listar();
    expect(pelaOutraPonta.map((e) => e.nome)).toContain('Equinox Energia Solar');
  });

  it('o relógio é compartilhado e fixo nos testes', () => {
    const container = criarContainerFake();
    expect(container.relogio.agora()).toEqual(container.relogio.agora());
  });

  it('dois containers são isolados um do outro', async () => {
    const a = criarContainerFake();
    const b = criarContainerFake();

    await a.repos.empresa.salvar(
      new Empresa({ id: UUIDv4.gerar(), nome: 'Só no A', cnpj: new CNPJ('19131243000197') }),
    );

    expect(await b.repos.empresa.listarTodas()).toHaveLength(0);
  });

  it('expõe os dublês concretos para o teste preparar estado', () => {
    const { fakes } = criarContainerFake();
    expect(fakes.usuario.items).toBeInstanceOf(Map);
    expect(fakes.camera.permissaoConcedida).toBe(true);
  });
});
