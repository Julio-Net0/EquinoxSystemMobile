// Testes das políticas de segurança do banco remoto.
//
// Rodam a migração e o seed de supabase/ num Postgres embutido (PGlite) e
// conferem o isolamento agindo como cada usuário de demonstração. Não falam
// com rede nem com o projeto Supabase real: `npm run test:rls`.
//
// Ficam fora do Jest de propósito — o PGlite é ESM com WebAssembly e não
// precisa (nem se beneficia) do transform do jest-expo.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const EMPRESA_A = '1a000000-0000-4000-8000-000000000001';
const EMPRESA_B = '1a000000-0000-4000-8000-000000000002';
const ENDERECO = (n) => `2b000000-0000-4000-8000-00000000000${n}`;
const PADRAO = (n) => `3c000000-0000-4000-8000-00000000000${n}`;
const SUPER = '4d000000-0000-4000-8000-000000000001';
const ADMIN_A = '4d000000-0000-4000-8000-000000000002';
const TECNICO_A = '4d000000-0000-4000-8000-000000000003';
const PENDENTE_A = '4d000000-0000-4000-8000-000000000004';
const ADMIN_B = '4d000000-0000-4000-8000-000000000005';

const LEITURA_AA = '5e000000-0000-4000-8000-0000000000aa';
const LEITURA_BB = '5e000000-0000-4000-8000-0000000000bb';
const LEITURA_CC = '5e000000-0000-4000-8000-0000000000cc';

/** @type {PGlite} */
let db;

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(ler('tests', 'supabase', 'preludio.sql'));
  // Todas as migrações, na ordem do nome — como o projeto as recebe.
  for (const arquivo of readdirSync(join(RAIZ, 'supabase', 'migrations')).sort()) {
    if (arquivo.endsWith('.sql')) await db.exec(ler('supabase', 'migrations', arquivo));
  }
  await db.exec(ler('supabase', 'seed.sql'));
});

after(async () => {
  await db.close();
});

/** Troca o usuário da requisição dentro da transação corrente. */
async function assumir(papel, usuarioId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [usuarioId ?? '']);
  await db.exec(`set local role ${papel}`);
}

/**
 * Executa a tarefa como o papel e o usuário informados, numa transação que é
 * sempre desfeita — um teste não deixa resíduo para o seguinte.
 */
async function como(papel, usuarioId, tarefa) {
  await db.exec('begin');
  try {
    await assumir(papel, usuarioId);
    return await tarefa();
  } finally {
    await db.exec('rollback');
  }
}

const comoUsuario = (id, tarefa) => como('authenticated', id, tarefa);
const linhas = async (sql, params = []) => (await db.query(sql, params)).rows;

/** Leitura de hoje às 15h UTC (12h em Brasília), pronta para a RPC. */
function leituraDeHoje(extra = {}) {
  const agora = new Date();
  const medido = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 15),
  );
  return {
    id: LEITURA_AA,
    padrao_id: PADRAO(1),
    usuario_id: TECNICO_A,
    valor_consumo: 11300,
    valor_injecao: null,
    foto_path: `${EMPRESA_A}/${ENDERECO(1)}/${LEITURA_AA}.jpg`,
    latitude: -19.9191,
    longitude: -43.9386,
    precisao_metros: 8,
    medido_em: medido.toISOString(),
    data_local: medido.toISOString().slice(0, 10),
    status: 'registrada',
    ...extra,
  };
}

const enviarLeitura = (leitura) =>
  linhas('select public.sincronizar_leitura($1::jsonb) as r', [JSON.stringify(leitura)]);

// ------------------------------------------------------------------ anônimo

// ---------------------------------------------------------------------- seed

const AUTOR_DE_OUTRA_EMPRESA = `
  select l.id from public.leituras l
    join public.perfis p on p.id = l.usuario_id
   where p.empresa_id is distinct from l.empresa_id
  union
  select l.id from public.leituras l
    join public.perfis p on p.id = l.decidida_por_id
   where p.empresa_id is distinct from l.empresa_id and p.nivel_acesso < 3`;

test('no seed, nenhuma leitura tem autor ou decisor de outra empresa', async () => {
  assert.deepEqual(await linhas(AUTOR_DE_OUTRA_EMPRESA), []);
  const [aviso] = await linhas(
    "select mensagem from public.notificacoes where id = '6f000000-0000-4000-8000-000000000003'",
  );
  assert.match(aviso.mensagem, /Registrada por Helena Síndica/);
});

test('a correção de autoria do seed acerta um projeto antigo e pode rodar de novo', async () => {
  await db.exec('begin');
  try {
    // Como o projeto ficou com o seed antigo.
    await db.exec(`
      alter table public.leituras disable trigger trg_leituras_protecao;
      update public.leituras
         set usuario_id = '4d000000-0000-4000-8000-000000000003',
             decidida_por_id = '4d000000-0000-4000-8000-000000000002'
       where id in ('5e000000-0000-4000-8000-000000000010', '5e000000-0000-4000-8000-000000000011');
      alter table public.leituras enable trigger trg_leituras_protecao;
      update public.notificacoes
         set mensagem = replace(mensagem, 'Helena Síndica', 'João da Silva')
       where id = '6f000000-0000-4000-8000-000000000003';`);
    assert.equal((await linhas(AUTOR_DE_OUTRA_EMPRESA)).length, 2);

    const correcao = ler('supabase', 'correcoes', '20261117_autoria_seed_condominio.sql');
    await db.exec(correcao);
    await db.exec(correcao);

    assert.deepEqual(await linhas(AUTOR_DE_OUTRA_EMPRESA), []);
  } finally {
    await db.exec('rollback');
  }
});

test('anônimo não lê tabela nenhuma', async () => {
  for (const tabela of ['empresas', 'enderecos', 'perfis', 'leituras', 'notificacoes']) {
    await como('anon', null, async () => {
      await assert.rejects(linhas(`select * from public.${tabela}`), /permission denied/);
    });
  }
});

test('anônimo busca empresa para o cadastro e recebe só id e nome', async () => {
  await como('anon', null, async () => {
    const achadas = await linhas("select * from public.buscar_empresas_cadastro('solar')");
    assert.equal(achadas.length, 2);
    assert.deepEqual(Object.keys(achadas[0]).sort(), ['id', 'nome']);
  });
});

test('anônimo não chama a função de envio de leitura', async () => {
  await como('anon', null, async () => {
    await assert.rejects(enviarLeitura(leituraDeHoje()), /permission denied/);
  });
});

// ---------------------------------------------------- isolamento por empresa

test('administrador da empresa B não vê leitura, endereço nem perfil da empresa A', async () => {
  await comoUsuario(ADMIN_B, async () => {
    const leituras = await linhas('select empresa_id from public.leituras');
    assert.ok(leituras.length > 0);
    assert.ok(leituras.every((l) => l.empresa_id === EMPRESA_B));

    const enderecos = await linhas('select empresa_id from public.enderecos');
    assert.deepEqual([...new Set(enderecos.map((e) => e.empresa_id))], [EMPRESA_B]);

    const perfis = await linhas('select id from public.perfis');
    assert.deepEqual(perfis.map((p) => p.id), [ADMIN_B]);

    const empresas = await linhas('select id from public.empresas');
    assert.deepEqual(empresas.map((e) => e.id), [EMPRESA_B]);

    const notificacoes = await linhas('select empresa_id from public.notificacoes');
    assert.ok(notificacoes.every((n) => n.empresa_id === EMPRESA_B));
  });
});

test('administrador da empresa B não altera nem apaga dado da empresa A', async () => {
  await comoUsuario(ADMIN_B, async () => {
    const editados = await db.query(
      "update public.enderecos set apelido = 'invadido' where empresa_id = $1",
      [EMPRESA_A],
    );
    assert.equal(editados.affectedRows, 0);

    const apagados = await db.query('delete from public.enderecos where empresa_id = $1', [
      EMPRESA_A,
    ]);
    assert.equal(apagados.affectedRows, 0);
  });

  await comoUsuario(ADMIN_B, async () => {
    await assert.rejects(
      linhas(
        `insert into public.enderecos (id, empresa_id, apelido, uc)
         values (gen_random_uuid(), $1, 'Invasor', '1')`,
        [EMPRESA_A],
      ),
      /row-level security/,
    );
  });
});

test('super admin vê as duas empresas', async () => {
  await comoUsuario(SUPER, async () => {
    const empresas = await linhas('select id from public.empresas order by id');
    assert.deepEqual(empresas.map((e) => e.id), [EMPRESA_A, EMPRESA_B]);
  });
});

// -------------------------------------------------------------------- técnico

test('técnico vê só os endereços vinculados e os padrões e leituras deles', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const enderecos = await linhas('select id from public.enderecos order by id');
    assert.deepEqual(enderecos.map((e) => e.id), [ENDERECO(1), ENDERECO(3), ENDERECO(4)]);

    const padroes = await linhas('select endereco_id from public.padroes_cemig');
    assert.ok(padroes.length > 0);
    assert.ok(padroes.every((p) => p.endereco_id !== ENDERECO(2)));

    const leituras = await linhas('select endereco_id from public.leituras');
    assert.ok(leituras.length > 0);
    assert.ok(leituras.every((l) => l.endereco_id !== ENDERECO(2)));

    // Notificação é assunto do administrador.
    assert.equal((await linhas('select id from public.notificacoes')).length, 0);

    // Vê os colegas da própria empresa (autor das leituras), e só eles.
    const perfis = await linhas('select empresa_id from public.perfis');
    assert.ok(perfis.length > 1);
    assert.ok(perfis.every((p) => p.empresa_id === EMPRESA_A));
  });
});

test('técnico não altera o perfil de um colega', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const feito = await db.query("update public.perfis set nome = 'Invadido' where id = $1", [
      ADMIN_A,
    ]);
    assert.equal(feito.affectedRows, 0);
  });
});

test('técnico registra leitura em endereço vinculado, em nome próprio', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const [{ r }] = await enviarLeitura(leituraDeHoje());
    assert.equal(r.resultado, 'inserida');

    const [gravada] = await linhas(
      'select empresa_id, endereco_id, usuario_id from public.leituras where id = $1',
      [LEITURA_AA],
    );
    // Escopo derivado do padrão no servidor, não aceito do cliente.
    assert.deepEqual(gravada, {
      empresa_id: EMPRESA_A,
      endereco_id: ENDERECO(1),
      usuario_id: TECNICO_A,
    });
  });
});

test('reenviar a mesma leitura não duplica nem falha', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await enviarLeitura(leituraDeHoje());
    const [{ r }] = await enviarLeitura(leituraDeHoje());
    assert.equal(r.resultado, 'inalterada');

    const [{ total }] = await linhas(
      'select count(*)::int as total from public.leituras where id = $1',
      [LEITURA_AA],
    );
    assert.equal(total, 1);
  });
});

test('técnico não registra leitura em endereço alheio', async () => {
  // Padrão 3 é do Galpão Savassi, ao qual o técnico não está vinculado.
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      enviarLeitura(leituraDeHoje({ padrao_id: PADRAO(3) })),
      /não está vinculado/,
    );
  });

  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      linhas(
        `insert into public.leituras
           (id, padrao_id, endereco_id, empresa_id, usuario_id, valor_consumo, foto_path,
            medido_em, data_local)
         values (gen_random_uuid(), $1, $2, $3, $4, 1, 'x/y/z.jpg',
                 '2026-03-10T15:00:00Z', '2026-03-10')`,
        [PADRAO(3), ENDERECO(1), EMPRESA_A, TECNICO_A],
      ),
      /row-level security/,
    );
  });
});

test('técnico não registra leitura em nome de outro usuário', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(enviarLeitura(leituraDeHoje({ usuario_id: ADMIN_A })), /nome próprio/);
  });
});

test('técnico não aprova a própria leitura', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(enviarLeitura(leituraDeHoje({ status: 'aprovada' })), /administrador/);
  });

  await comoUsuario(TECNICO_A, async () => {
    const direto = await db.query(
      "update public.leituras set status = 'aprovada' where usuario_id = $1",
      [TECNICO_A],
    );
    assert.equal(direto.affectedRows, 0);
  });
});

test('nem o administrador reescreve o valor medido', async () => {
  await comoUsuario(ADMIN_A, async () => {
    await assert.rejects(
      linhas('update public.leituras set valor_consumo = 1 where empresa_id = $1', [EMPRESA_A]),
      /não pode ser alterada/,
    );
  });
});

test('administrador decide sobre a leitura da própria empresa', async () => {
  await comoUsuario(ADMIN_A, async () => {
    const feito = await db.query(
      `update public.leituras
          set status = 'descartada', decidida_em = now(), decidida_por_id = $1
        where id = '5e000000-0000-4000-8000-000000000090'`,
      [ADMIN_A],
    );
    assert.equal(feito.affectedRows, 1);
  });
});

// ------------------------------------------------------- conflito de leituras

test('duas leituras do mesmo padrão no mesmo dia: vale a medida mais tarde', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const primeira = leituraDeHoje();
    await enviarLeitura(primeira);

    const maisTarde = new Date(new Date(primeira.medido_em).getTime() + 3_600_000).toISOString();
    await enviarLeitura(leituraDeHoje({ id: LEITURA_BB, medido_em: maisTarde }));

    const estado = await linhas(
      `select id, status, substituida_por_id from public.leituras
        where id in ($1, $2) order by id`,
      [LEITURA_AA, LEITURA_BB],
    );
    assert.deepEqual(estado, [
      { id: LEITURA_AA, status: 'substituida', substituida_por_id: LEITURA_BB },
      { id: LEITURA_BB, status: 'registrada', substituida_por_id: null },
    ]);

    // O aviso do conflito nasce no servidor e é do administrador.
    await assumir('authenticated', ADMIN_A);
    const avisos = await linhas('select tipo from public.notificacoes where leitura_id = $1', [
      LEITURA_BB,
    ]);
    assert.deepEqual(avisos, [{ tipo: 'LEITURA_SUBSTITUIDA' }]);
  });
});

test('leitura que chega depois mas foi medida antes entra como substituída', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const vigente = leituraDeHoje();
    await enviarLeitura(vigente);

    const antes = new Date(new Date(vigente.medido_em).getTime() - 3_600_000).toISOString();
    const [{ r }] = await enviarLeitura(leituraDeHoje({ id: LEITURA_CC, medido_em: antes }));
    assert.equal(r.status, 'substituida');
  });
});

// --------------------------------------------------------------------- perfis

test('cadastro pendente lê o próprio perfil e mais nada', async () => {
  await comoUsuario(PENDENTE_A, async () => {
    const perfis = await linhas('select id, status from public.perfis');
    assert.deepEqual(perfis, [{ id: PENDENTE_A, status: 'Pendente' }]);

    for (const tabela of ['empresas', 'enderecos', 'padroes_cemig', 'leituras', 'notificacoes']) {
      assert.equal((await linhas(`select * from public.${tabela}`)).length, 0, tabela);
    }
  });
});

test('técnico não se promove nem se troca de empresa', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      linhas('update public.perfis set nivel_acesso = 3 where id = $1', [TECNICO_A]),
      /não permite alterar nível/,
    );
  });
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      linhas('update public.perfis set empresa_id = $2 where id = $1', [TECNICO_A, EMPRESA_B]),
      /não permite alterar nível/,
    );
  });
});

test('técnico edita o próprio nome', async () => {
  await comoUsuario(TECNICO_A, async () => {
    const feito = await db.query("update public.perfis set nome = 'João S.' where id = $1", [
      TECNICO_A,
    ]);
    assert.equal(feito.affectedRows, 1);
  });
});

/**
 * O perfil como o aparelho o devolve: lido da nuvem, passado por um `Date` do
 * JavaScript (que só guarda milissegundos) e enviado pela RPC, com o nome novo.
 */
async function perfilComoOAppEnvia(id, mudancas = {}) {
  const [p] = await linhas(
    'select id, nome, usuario, nivel_acesso, nivel_anterior, status, autorizado_em, autorizado_por from public.perfis where id = $1',
    [id],
  );
  return {
    ...p,
    autorizado_em: p.autorizado_em ? new Date(p.autorizado_em).toISOString() : null,
    ...mudancas,
  };
}

const sincronizarPerfil = (perfil) =>
  linhas('select public.sincronizar_perfil($1::jsonb)', [JSON.stringify(perfil)]);

/**
 * No Supabase, `now()` tem microssegundos; o relógio do PGlite não. O dono do
 * banco grava um horário com microssegundos antes de o teste agir como o
 * usuário — é o que o app encontra no projeto real.
 */
async function comAutorizacaoEmMicrossegundos(id, tarefa) {
  await db.exec('begin');
  try {
    await db.query(
      "update public.perfis set autorizado_em = '2026-11-17 11:00:00.123456+00' where id = $1",
      [id],
    );
    await assumir('authenticated', id);
    return await tarefa();
  } finally {
    await db.exec('rollback');
  }
}

test('técnico edita o próprio nome pela RPC do app, com horários em milissegundos', async () => {
  await comAutorizacaoEmMicrossegundos(TECNICO_A, async () => {
    await sincronizarPerfil(await perfilComoOAppEnvia(TECNICO_A, { nome: 'João S.' }));

    const [p] = await linhas('select nome, autorizado_em from public.perfis where id = $1', [
      TECNICO_A,
    ]);
    assert.equal(p.nome, 'João S.');
  });
});

test('administrador edita o próprio nome pela RPC do app', async () => {
  await comAutorizacaoEmMicrossegundos(ADMIN_A, async () => {
    await sincronizarPerfil(await perfilComoOAppEnvia(ADMIN_A, { nome: 'Ana Admin' }));
    const [p] = await linhas('select nome from public.perfis where id = $1', [ADMIN_A]);
    assert.equal(p.nome, 'Ana Admin');
  });
});

test('pela RPC, o técnico continua sem mexer na própria autorização', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      sincronizarPerfil(
        await perfilComoOAppEnvia(TECNICO_A, { autorizado_em: '2020-01-01T00:00:00.000Z' }),
      ),
      /não permite alterar nível/,
    );
  });
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(
      sincronizarPerfil(await perfilComoOAppEnvia(TECNICO_A, { nivel_acesso: 2 })),
      /não permite alterar nível/,
    );
  });
});

test('administrador autoriza o pendente e define os vínculos numa transação', async () => {
  await comoUsuario(ADMIN_A, async () => {
    await linhas('select public.sincronizar_perfil($1::jsonb)', [
      JSON.stringify({
        id: PENDENTE_A,
        nome: 'Maria Souza',
        usuario: 'maria.souza',
        nivel_acesso: 1,
        nivel_anterior: null,
        status: 'Ativo',
        autorizado_em: new Date().toISOString(),
        autorizado_por: ADMIN_A,
        enderecos: [ENDERECO(1), ENDERECO(2)],
      }),
    ]);

    const [perfil] = await linhas('select status from public.perfis where id = $1', [PENDENTE_A]);
    assert.equal(perfil.status, 'Ativo');

    const vinculos = await linhas(
      'select endereco_id from public.usuario_enderecos where usuario_id = $1 order by 1',
      [PENDENTE_A],
    );
    assert.deepEqual(vinculos.map((v) => v.endereco_id), [ENDERECO(1), ENDERECO(2)]);
  });
});

test('administrador não promove ninguém a super admin', async () => {
  await comoUsuario(ADMIN_A, async () => {
    await assert.rejects(
      linhas('update public.perfis set nivel_acesso = 3 where id = $1', [TECNICO_A]),
      /não permite alterar nível/,
    );
  });
});

test('administrador não vincula usuário a endereço de outra empresa', async () => {
  await comoUsuario(ADMIN_A, async () => {
    await assert.rejects(
      linhas('insert into public.usuario_enderecos (usuario_id, endereco_id) values ($1, $2)', [
        TECNICO_A,
        ENDERECO(5),
      ]),
      /row-level security/,
    );
  });
});

test('o cadastro nasce técnico e pendente, digam o que disserem os metadados', async () => {
  const novo = '4d000000-0000-4000-8000-0000000000ff';
  await db.exec('begin');
  try {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'Novo@Exemplo.dev', $2::jsonb)`,
      [
        novo,
        JSON.stringify({
          nome: ' Novo Usuário ',
          usuario: 'Novo.Usuario',
          empresa_id: EMPRESA_A,
          nivel_acesso: 3,
          status: 'Ativo',
        }),
      ],
    );
    const [perfil] = await linhas(
      `select nome, usuario, email, nivel_acesso, status, empresa_id
         from public.perfis where id = $1`,
      [novo],
    );
    assert.deepEqual(perfil, {
      nome: 'Novo Usuário',
      usuario: 'novo.usuario',
      email: 'novo@exemplo.dev',
      nivel_acesso: 1,
      status: 'Pendente',
      empresa_id: EMPRESA_A,
    });
  } finally {
    await db.exec('rollback');
  }
});

// -------------------------------------------------------------- notificações

test('técnico grava aviso só para a própria empresa', async () => {
  const aviso = (empresa) =>
    linhas(
      `insert into public.notificacoes (id, empresa_id, tipo, titulo, mensagem, criada_em)
       values (gen_random_uuid(), $1, 'LEITURA_SEM_GPS', 'Sem GPS', 'Leitura sem GPS', now())`,
      [empresa],
    );

  await comoUsuario(TECNICO_A, async () => {
    await aviso(EMPRESA_A);
  });
  await comoUsuario(TECNICO_A, async () => {
    await assert.rejects(aviso(EMPRESA_B), /row-level security/);
  });
});

// -------------------------------------------------------------------- lápides

test('excluir um endereço deixa lápide para os outros aparelhos', async () => {
  await comoUsuario(ADMIN_A, async () => {
    await linhas('delete from public.enderecos where id = $1', [ENDERECO(2)]);
    const lapides = await linhas('select tabela, registro_id from public.exclusoes');
    // Só a do endereço: o padrão saiu em cascata e não precisa de lápide própria.
    assert.deepEqual(lapides, [{ tabela: 'enderecos', registro_id: ENDERECO(2) }]);
  });
});

// -------------------------------------------------------------------- storage

const objeto = (nome) =>
  linhas("insert into storage.objects (bucket_id, name) values ('comprovantes', $1)", [nome]);

test('o bucket de comprovantes é privado', async () => {
  const [bucket] = await linhas("select public from storage.buckets where id = 'comprovantes'");
  assert.equal(bucket.public, false);
});

test('técnico envia foto só para a pasta de endereço vinculado', async () => {
  await comoUsuario(TECNICO_A, async () => {
    await objeto(`${EMPRESA_A}/${ENDERECO(1)}/foto.jpg`);
  });
  for (const proibido of [
    `${EMPRESA_A}/${ENDERECO(2)}/foto.jpg`,
    `${EMPRESA_B}/${ENDERECO(5)}/foto.jpg`,
    'solta-na-raiz.jpg',
  ]) {
    await comoUsuario(TECNICO_A, async () => {
      await assert.rejects(objeto(proibido), /row-level security/, proibido);
    });
  }
});

test('usuário de outra empresa não enxerga a foto', async () => {
  const caminho = `${EMPRESA_A}/${ENDERECO(1)}/foto.jpg`;
  await objeto(caminho);
  try {
    await comoUsuario(ADMIN_B, async () => {
      assert.equal((await linhas('select name from storage.objects')).length, 0);
    });
    await comoUsuario(TECNICO_A, async () => {
      assert.deepEqual(await linhas('select name from storage.objects'), [{ name: caminho }]);
    });
    await como('anon', null, async () => {
      await assert.rejects(linhas('select name from storage.objects'), /permission denied/);
    });
  } finally {
    await db.query('delete from storage.objects where name = $1', [caminho]);
  }
});
