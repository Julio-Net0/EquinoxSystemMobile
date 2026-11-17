import {
  SincronizacaoSupabase,
  VIDA_DA_URL_ASSINADA,
} from '@/infrastructure/supabase/SincronizacaoSupabase';
import { Notificacao } from '@/domain/entities/Notificacao';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ERRO_DE_REDE, criarClienteFalso } from '../../../helpers/clienteSupabaseFalso';
import {
  AGORA,
  IDS,
  novaEmpresa,
  novaLeitura,
  novoEndereco,
  novoPadrao,
  novoUsuario,
  uuid,
} from '../../../helpers/cenarioSync';

const CAMINHO = `${IDS.empresa.value}/${IDS.endereco.value}/${uuid(100).value}.jpg`;
const BYTES = new Uint8Array([0xff, 0xd8, 0xff]).buffer;

function cenario() {
  const falso = criarClienteFalso();
  const lerArquivo = jest.fn(async () => BYTES);
  return { ...falso, lerArquivo, gateway: new SincronizacaoSupabase(falso.cliente, lerArquivo) };
}

const aviso = () =>
  new Notificacao({
    id: uuid(200), empresaId: IDS.empresa, tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
    titulo: 'Leitura atrasada', mensagem: 'Confirme ou descarte', criadaEm: AGORA,
    requerAcao: true, leituraId: uuid(100),
  });

describe('SincronizacaoSupabase', () => {
  describe('enviarFoto', () => {
    it('sobe os bytes do arquivo para o bucket privado, como JPEG, sem sobrescrever', async () => {
      const { gateway, storage, balde, lerArquivo } = cenario();

      const saida = await gateway.enviarFoto(CAMINHO, 'file:///documents/leituras/100.jpg');

      expect(lerArquivo).toHaveBeenCalledWith('file:///documents/leituras/100.jpg');
      expect(storage.from).toHaveBeenCalledWith('comprovantes');
      expect(balde.upload).toHaveBeenCalledWith(CAMINHO, BYTES, {
        contentType: 'image/jpeg', upsert: false,
      });
      expect(saida.ok).toBe(true);
    });

    it('arquivo que já existe conta como sucesso: é o reenvio após queda de rede', async () => {
      const { gateway, balde } = cenario();
      balde.upload.mockResolvedValueOnce({
        data: null as never, error: { message: 'The resource already exists', statusCode: '409' },
      });

      expect((await gateway.enviarFoto(CAMINHO, 'file:///x.jpg')).ok).toBe(true);
    });

    it('recusa do Storage (política) é rejeição', async () => {
      const { gateway, balde } = cenario();
      balde.upload.mockResolvedValueOnce({
        data: null as never,
        error: { message: 'new row violates row-level security policy', statusCode: '403' },
      });

      expect(await gateway.enviarFoto(CAMINHO, 'file:///x.jpg')).toEqual({
        ok: false, motivo: 'rejeitado',
        mensagem: 'A nuvem recusou: seu perfil não tem permissão para esta operação',
      });
    });

    it('sem rede', async () => {
      const { gateway, balde } = cenario();
      balde.upload.mockRejectedValueOnce(new TypeError('Network request failed'));

      expect(await gateway.enviarFoto(CAMINHO, 'file:///x.jpg')).toMatchObject({ ok: false, motivo: 'rede' });
    });

    it('arquivo ilegível no aparelho é rejeição, não exceção', async () => {
      const { gateway, lerArquivo } = cenario();
      lerArquivo.mockRejectedValueOnce(new Error('arquivo não existe'));

      expect(await gateway.enviarFoto(CAMINHO, 'file:///x.jpg')).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: 'arquivo não existe',
      });
    });
  });

  describe('enviarLeitura', () => {
    it('chama a função idempotente do banco com a leitura e o caminho da foto', async () => {
      const { gateway, rpcs, responder } = cenario();
      responder('rpc:sincronizar_leitura', { data: { resultado: 'inserida', status: 'registrada' } });
      const leitura = novaLeitura({
        valorInjecao: new ValorKwh(9_870),
        coordenadas: new CoordenadasGPS(-19.9191, -43.9386, 8),
      });

      const saida = await gateway.enviarLeitura(leitura, CAMINHO);

      expect(rpcs).toEqual([
        {
          nome: 'sincronizar_leitura',
          args: {
            p: {
              id: uuid(100).value, padrao_id: IDS.padrao.value, usuario_id: IDS.tecnico.value,
              valor_consumo: 11_300, valor_injecao: 9_870, foto_path: CAMINHO,
              latitude: -19.9191, longitude: -43.9386, precisao_metros: 8,
              medido_em: AGORA.toISOString(), data_local: '2026-03-10', status: 'registrada',
              substituida_em: null, substituida_por_id: null,
              decidida_em: null, decidida_por_id: null,
            },
          },
        },
      ]);
      expect(saida).toEqual({ ok: true, valor: { status: StatusLeituraEnum.REGISTRADA } });
    });

    it('não envia a uri do arquivo local nem o estado de sincronização', async () => {
      const { gateway, rpcs } = cenario();

      await gateway.enviarLeitura(novaLeitura(), CAMINHO);

      const enviado = JSON.stringify(rpcs[0].args);
      expect(enviado).not.toContain('file://');
      expect(enviado).not.toContain('sync');
    });

    it('devolve o status que o servidor decidiu num conflito de vaga', async () => {
      const { gateway, responder } = cenario();
      responder('rpc:sincronizar_leitura', { data: { resultado: 'inserida', status: 'substituida' } });

      const saida = await gateway.enviarLeitura(novaLeitura(), CAMINHO);

      expect(saida).toEqual({ ok: true, valor: { status: StatusLeituraEnum.SUBSTITUIDA } });
    });

    it('a recusa do banco chega com a mensagem em português da função', async () => {
      const { gateway, responder } = cenario();
      responder('rpc:sincronizar_leitura', {
        error: { message: 'Você não está vinculado ao endereço deste padrão', code: '42501' },
        status: 403,
      });

      expect(await gateway.enviarLeitura(novaLeitura(), CAMINHO)).toEqual({
        ok: false, motivo: 'rejeitado',
        mensagem: 'Você não está vinculado ao endereço deste padrão',
      });
    });
  });

  describe('enviarNotificacao', () => {
    it('insere o aviso', async () => {
      const { gateway, consultas } = cenario();

      expect((await gateway.enviarNotificacao(aviso())).ok).toBe(true);
      expect(consultas.map((c) => `${c.tabela}:${c.operacao}`)).toEqual(['notificacoes:insert']);
      expect(consultas[0].carga).toMatchObject({
        id: uuid(200).value, empresa_id: IDS.empresa.value, requer_acao: true, lida: false,
        leitura_id: uuid(100).value,
      });
    });

    it('se já existe, atualiza só leitura e resolução', async () => {
      const { gateway, consultas, responder } = cenario();
      responder('notificacoes:insert', { error: { message: 'duplicate key', code: '23505' }, status: 409 });
      const resolvido = aviso();
      resolvido.resolver(ResolucaoEnum.APROVADA, IDS.admin, AGORA);

      expect((await gateway.enviarNotificacao(resolvido)).ok).toBe(true);

      expect(consultas[1]).toMatchObject({
        tabela: 'notificacoes', operacao: 'update',
        carga: {
          lida: true, resolucao: 'aprovada',
          resolvida_em: AGORA.toISOString(), resolvida_por: IDS.admin.value,
        },
      });
      expect(consultas[1].filtros).toEqual([['eq', 'id', uuid(200).value]]);
    });

    it('outra recusa na inserção não tenta atualizar', async () => {
      const { gateway, consultas, responder } = cenario();
      responder('notificacoes:insert', {
        error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403,
      });

      expect(await gateway.enviarNotificacao(aviso())).toMatchObject({ ok: false, motivo: 'rejeitado' });
      expect(consultas).toHaveLength(1);
    });

    it('falha na atualização é devolvida', async () => {
      const { gateway, responder } = cenario();
      responder('notificacoes:insert', { error: { message: 'duplicate key', code: '23505' }, status: 409 });
      responder('notificacoes:update', { error: ERRO_DE_REDE, status: 0 });

      expect(await gateway.enviarNotificacao(aviso())).toMatchObject({ ok: false, motivo: 'rede' });
    });
  });

  it('marcarNotificacoesLidas filtra pela empresa, ou por nenhuma para o super admin', async () => {
    const { gateway, consultas } = cenario();

    await gateway.marcarNotificacoesLidas(IDS.empresa);
    await gateway.marcarNotificacoesLidas(null);

    expect(consultas[0]).toMatchObject({ operacao: 'update', carga: { lida: true } });
    expect(consultas[0].filtros).toEqual([['eq', 'lida', false], ['eq', 'empresa_id', IDS.empresa.value]]);
    expect(consultas[1].filtros).toEqual([['eq', 'lida', false]]);
  });

  describe('estrutura e usuários', () => {
    it('upsert pelo id de empresa, endereço e padrão', async () => {
      const { gateway, consultas } = cenario();

      await gateway.enviarEmpresa(novaEmpresa());
      await gateway.enviarEndereco(novoEndereco());
      await gateway.enviarPadrao(novoPadrao());

      expect(consultas.map((c) => `${c.tabela}:${c.operacao}`)).toEqual([
        'empresas:upsert', 'enderecos:upsert', 'padroes_cemig:upsert',
      ]);
      expect(consultas.every((c) => (c.opcoes as { onConflict: string }).onConflict === 'id')).toBe(true);
      expect(consultas[0].carga).toMatchObject({ id: IDS.empresa.value, cnpj: '19131243000197' });
      // Booleano de verdade no Postgres, não 0/1 como no SQLite.
      expect(consultas[1].carga).toMatchObject({ eh_usina: false, latitude: -19.9191 });
      expect(consultas[2].carga).toMatchObject({ endereco_id: IDS.endereco.value, numero: '778811' });
    });

    it('exclui endereço, padrão e perfil pelo id', async () => {
      const { gateway, consultas } = cenario();

      await gateway.excluirEndereco(IDS.endereco);
      await gateway.excluirPadrao(IDS.padrao);
      await gateway.excluirUsuario(IDS.tecnico);

      expect(consultas.map((c) => `${c.tabela}:${c.operacao}`)).toEqual([
        'enderecos:delete', 'padroes_cemig:delete', 'perfis:delete',
      ]);
      expect(consultas[2].filtros).toEqual([['eq', 'id', IDS.tecnico.value]]);
    });

    it('o perfil e os vínculos sobem juntos pela função do banco, sem e-mail nem empresa', async () => {
      const { gateway, rpcs } = cenario();

      await gateway.enviarUsuario(
        novoUsuario({ perfil: PerfilEnum.ADMIN, autorizadoEm: AGORA, autorizadoPorId: IDS.admin }),
      );

      expect(rpcs[0]).toEqual({
        nome: 'sincronizar_perfil',
        args: {
          p: {
            id: IDS.tecnico.value, nome: 'João da Silva', usuario: 'tecnico',
            nivel_acesso: 2, nivel_anterior: null, status: 'Ativo',
            autorizado_em: AGORA.toISOString(), autorizado_por: IDS.admin.value,
            enderecos: [IDS.endereco.value],
          },
        },
      });
    });

    it('as recusas são devolvidas', async () => {
      const { gateway, responder } = cenario();
      responder('enderecos:upsert', { error: { message: 'violates foreign key', code: '23503' }, status: 409 });
      responder('enderecos:delete', { error: ERRO_DE_REDE, status: 0 });
      responder('rpc:sincronizar_perfil', { error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 });

      expect(await gateway.enviarEndereco(novoEndereco())).toEqual({
        ok: false, motivo: 'rejeitado',
        mensagem: 'A nuvem recusou: este registro depende de outro que não existe mais lá',
      });
      expect(await gateway.excluirEndereco(IDS.endereco)).toMatchObject({ ok: false, motivo: 'rede' });
      expect(await gateway.enviarUsuario(novoUsuario())).toMatchObject({ ok: false, motivo: 'nao_autenticado' });
    });
  });

  describe('baixarAlteracoes', () => {
    const CARIMBO = '2026-03-10T15:00:00.123456+00:00';

    it('consulta cada tabela na ordem das dependências, sem filtrar por empresa', async () => {
      const { gateway, consultas } = cenario();

      await gateway.baixarAlteracoes({});

      expect(consultas.map((c) => c.tabela)).toEqual([
        'exclusoes', 'empresas', 'enderecos', 'padroes_cemig', 'perfis', 'leituras', 'notificacoes',
      ]);
      // Quem restringe o que volta é o RLS do servidor, não um filtro do app.
      for (const c of consultas) {
        expect(c.filtros.map((f) => f[0])).toEqual(['order', 'range']);
      }
    });

    it('com cursor, pede só o que tem carimbo do servidor mais novo', async () => {
      const { gateway, consultas } = cenario();

      await gateway.baixarAlteracoes({ leituras: CARIMBO, exclusoes: '2026-03-01T00:00:00+00:00' });

      const leituras = consultas.find((c) => c.tabela === 'leituras');
      expect(leituras?.filtros[0]).toEqual(['gt', 'atualizado_em', CARIMBO]);
      const exclusoes = consultas.find((c) => c.tabela === 'exclusoes');
      expect(exclusoes?.filtros[0]).toEqual(['gt', 'excluido_em', '2026-03-01T00:00:00+00:00']);
      // Tabela sem cursor continua vindo inteira.
      expect(consultas.find((c) => c.tabela === 'empresas')?.filtros[0][0]).toBe('order');
    });

    it('converte as linhas em entidades e guarda o carimbo exato como cursor', async () => {
      const { gateway, responder } = cenario();
      responder('empresas:select', {
        data: [{ id: IDS.empresa.value, nome: 'Equinox', cnpj: '19131243000197', criado_em: CARIMBO, atualizado_em: CARIMBO }],
      });
      responder('enderecos:select', {
        data: [{
          id: IDS.endereco.value, empresa_id: IDS.empresa.value, apelido: 'Usina', uc: '1',
          rua: null, numero: null, bairro: null, cidade: 'BH', eh_usina: true,
          latitude: null, longitude: null, criado_em: CARIMBO, atualizado_em: CARIMBO,
        }],
      });
      responder('padroes_cemig:select', {
        data: [{ id: IDS.padrao.value, endereco_id: IDS.endereco.value, numero: '778811', criado_em: CARIMBO, atualizado_em: CARIMBO }],
      });
      responder('perfis:select', {
        data: [{
          id: IDS.tecnico.value, empresa_id: IDS.empresa.value, nome: 'João', usuario: 'tecnico',
          email: 'tecnico@equinox.dev', nivel_acesso: 1, nivel_anterior: null, status: 'Ativo',
          criado_em: CARIMBO, autorizado_em: null, autorizado_por: null, atualizado_em: CARIMBO,
          usuario_enderecos: [{ endereco_id: IDS.endereco.value }],
        }],
      });
      responder('leituras:select', {
        data: [{
          id: uuid(100).value, padrao_id: IDS.padrao.value, usuario_id: IDS.tecnico.value,
          valor_consumo: 11300, valor_injecao: 9870, foto_path: CAMINHO,
          latitude: -19.9, longitude: -43.9, precisao_metros: 8,
          medido_em: '2026-03-10T15:00:00+00:00', data_local: '2026-03-10', status: 'aprovada',
          substituida_em: null, substituida_por_id: null,
          decidida_em: '2026-03-10T16:00:00+00:00', decidida_por_id: IDS.admin.value,
          atualizado_em: CARIMBO,
        }],
      });
      responder('notificacoes:select', {
        data: [{
          id: uuid(200).value, empresa_id: IDS.empresa.value, tipo: 'LEITURA_SEM_GPS',
          titulo: 'Sem GPS', mensagem: 'Leitura sem GPS', requer_acao: false, leitura_id: null,
          criada_em: CARIMBO, lida: true, resolucao: null, resolvida_em: null, resolvida_por: null,
          atualizado_em: CARIMBO,
        }],
      });
      responder('exclusoes:select', {
        data: [
          { id: 1, tabela: 'padroes_cemig', registro_id: uuid(21).value, excluido_em: CARIMBO },
          { id: 2, tabela: 'perfis', registro_id: uuid(32).value, excluido_em: CARIMBO },
          { id: 3, tabela: 'tabela_desconhecida', registro_id: uuid(33).value, excluido_em: CARIMBO },
        ],
      });

      const saida = await gateway.baixarAlteracoes({});
      const pacote = saida.ok ? saida.valor : null;

      expect(pacote?.empresas[0].nome).toBe('Equinox');
      expect(pacote?.enderecos[0].ehUsina).toBe(true);
      expect(pacote?.enderecos[0].coordenadas).toBeNull();
      expect(pacote?.padroes[0].numero).toBe('778811');
      expect(pacote?.usuarios[0].enderecosVinculados).toHaveLength(1);

      const leitura = pacote?.leituras[0];
      expect(leitura?.status).toBe(StatusLeituraEnum.APROVADA);
      expect(leitura?.estadoSync).toBe(EstadoSyncEnum.SINCRONIZADA);
      expect(leitura?.fotoRemotaPath).toBe(CAMINHO);
      expect(leitura?.temFotoNoAparelho()).toBe(false);
      expect(leitura?.valorInjecao?.valor).toBe(9870);

      expect(pacote?.notificacoes[0].lida).toBe(true);
      expect(pacote?.exclusoes.map((e) => e.tabela)).toEqual(['padroes', 'usuarios']);
      expect(pacote?.cursores.leituras).toBe(CARIMBO);
      expect(pacote?.cursores.exclusoes).toBe(CARIMBO);
      expect(pacote?.ignorados).toEqual([]);
    });

    it('tabela sem novidade mantém o cursor que já tinha', async () => {
      const { gateway } = cenario();

      const saida = await gateway.baixarAlteracoes({ leituras: CARIMBO });

      expect(saida.ok && saida.valor.cursores).toEqual({ leituras: CARIMBO });
    });

    it('linha inválida é anotada e pulada, sem derrubar o pacote', async () => {
      const { gateway, responder } = cenario();
      responder('empresas:select', {
        data: [
          { id: IDS.empresa.value, nome: 'Boa', cnpj: '19131243000197', criado_em: CARIMBO, atualizado_em: CARIMBO },
          { id: IDS.outraEmpresa.value, nome: 'CNPJ torto', cnpj: '123', criado_em: CARIMBO, atualizado_em: CARIMBO },
        ],
      });

      const saida = await gateway.baixarAlteracoes({});
      const pacote = saida.ok ? saida.valor : null;

      expect(pacote?.empresas).toHaveLength(1);
      expect(pacote?.ignorados).toHaveLength(1);
      expect(pacote?.ignorados[0]).toContain(IDS.outraEmpresa.value);
    });

    it('pagina até a página vir incompleta', async () => {
      const { gateway, consultas, responder } = cenario();
      const linha = (n: number) => ({
        id: uuid(1000 + n).value, endereco_id: IDS.endereco.value, numero: String(n),
        criado_em: CARIMBO, atualizado_em: CARIMBO,
      });
      responder(
        'padroes_cemig:select',
        { data: Array.from({ length: 500 }, (_, i) => linha(i)) },
        { data: [linha(500)] },
      );

      const saida = await gateway.baixarAlteracoes({});

      expect(saida.ok && saida.valor.padroes).toHaveLength(501);
      const paginas = consultas.filter((c) => c.tabela === 'padroes_cemig').map((c) => c.filtros.at(-1));
      expect(paginas).toEqual([['range', 0, 499], ['range', 500, 999]]);
    });

    it('erro em qualquer tabela interrompe e não devolve pacote pela metade', async () => {
      const { gateway, responder } = cenario();
      responder('leituras:select', { error: ERRO_DE_REDE, status: 0 });

      expect(await gateway.baixarAlteracoes({})).toMatchObject({ ok: false, motivo: 'rede' });
    });
  });

  describe('urlAssinadaDaFoto', () => {
    it('pede uma URL assinada de vida curta do bucket privado', async () => {
      const { gateway, storage, balde } = cenario();

      const saida = await gateway.urlAssinadaDaFoto(CAMINHO);

      expect(storage.from).toHaveBeenCalledWith('comprovantes');
      expect(balde.createSignedUrl).toHaveBeenCalledWith(CAMINHO, VIDA_DA_URL_ASSINADA);
      expect(VIDA_DA_URL_ASSINADA).toBeLessThanOrEqual(300);
      expect(saida.ok && saida.valor).toContain('token=');
    });

    it('sem permissão ou sem arquivo, não há URL', async () => {
      const { gateway, balde } = cenario();
      balde.createSignedUrl.mockResolvedValueOnce({
        data: null, error: { message: 'Object not found', statusCode: '404' },
      });
      expect(await gateway.urlAssinadaDaFoto(CAMINHO)).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: 'Object not found',
      });

      balde.createSignedUrl.mockResolvedValueOnce({ data: null, error: null });
      expect(await gateway.urlAssinadaDaFoto(CAMINHO)).toEqual({
        ok: false, motivo: 'rejeitado', mensagem: 'Comprovante não encontrado',
      });
    });
  });
});
