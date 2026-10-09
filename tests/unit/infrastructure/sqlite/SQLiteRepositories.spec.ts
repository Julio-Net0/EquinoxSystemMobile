import { LeituraRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/LeituraRepositorySQLite';
import { UsinaRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/UsinaRepositorySQLite';
import { UsuarioRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/UsuarioRepositorySQLite';
import { EmpresaRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/EmpresaRepositorySQLite';
import { ActionQueueRepositorySQLite } from '@/infrastructure/database/sqlite/repositories/ActionQueueRepositorySQLite';

import { Empresa } from '@/domain/entities/Empresa';
import { Usuario } from '@/domain/entities/Usuario';
import { Usina } from '@/domain/entities/Usina';
import { Leitura } from '@/domain/entities/Leitura';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

describe('SQLite Repositories Integration (with Fallback Engine)', () => {
  let empresaRepo: EmpresaRepositorySQLite;
  let usuarioRepo: UsuarioRepositorySQLite;
  let usinaRepo: UsinaRepositorySQLite;
  let leituraRepo: LeituraRepositorySQLite;
  let queueRepo: ActionQueueRepositorySQLite;

  beforeEach(() => {
    empresaRepo = new EmpresaRepositorySQLite();
    usuarioRepo = new UsuarioRepositorySQLite();
    usinaRepo = new UsinaRepositorySQLite();
    leituraRepo = new LeituraRepositorySQLite();
    queueRepo = new ActionQueueRepositorySQLite();
  });

  it('deve salvar e buscar Empresa no repositório SQLite', async () => {
    const id = UUIDv4.gerar();
    const emp = new Empresa({
      id,
      nome: 'Empresa Teste SQLite',
      cnpj: new CNPJ('12345678000195'),
    });

    await empresaRepo.salvar(emp);
    const salva = await empresaRepo.buscarPorId(id);

    expect(salva).not.toBeNull();
    expect(salva?.nome).toBe('Empresa Teste SQLite');
  });

  it('deve salvar e buscar Usuario com usinas vinculadas no repositório SQLite', async () => {
    const id = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const usinaId1 = UUIDv4.gerar();

    const u = new Usuario({
      id,
      empresaId,
      nome: 'Técnico SQLite',
      email: 'tecnico@sqlite.com',
      perfil: PerfilEnum.TECNICO,
      status: 'Ativo',
      usinasVinculadas: [usinaId1],
    });

    await usuarioRepo.salvar(u);
    const salvo = await usuarioRepo.buscarPorId(id);

    expect(salvo).not.toBeNull();
    expect(salvo?.nome).toBe('Técnico SQLite');
    expect(salvo?.usinasVinculadas.length).toBe(1);
  });

  it('deve salvar e listar itens da action_queue', async () => {
    const item = new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao: 'INSERT_LEITURA',
      payloadJSON: JSON.stringify({ leituraId: '12345' }),
    });

    await queueRepo.enfileirar(item);
    const pendentes = await queueRepo.obterPendentes();

    expect(pendentes.length).toBeGreaterThanOrEqual(1);
    await queueRepo.remover(item.id);
  });
});
