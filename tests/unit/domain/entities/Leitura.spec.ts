import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

describe('Leitura Aggregate Root', () => {
  it('deve instanciar uma Leitura válida com status inicial Pendente', () => {
    const id = UUIDv4.gerar();
    const usinaId = UUIDv4.gerar();
    const usuarioId = UUIDv4.gerar();
    const valorKwh = new ValorKwh(1250.75);
    const coords = new CoordenadasGPS(-23.55, -46.63);

    const leitura = new Leitura({
      id,
      usinaId,
      usuarioId,
      valorKwh,
      caminhoImagemLocal: '/storage/emulated/0/Pictures/medidor_01.jpg',
      coordenadas: coords,
    });

    expect(leitura.id.equals(id)).toBe(true);
    expect(leitura.usinaId.equals(usinaId)).toBe(true);
    expect(leitura.usuarioId.equals(usuarioId)).toBe(true);
    expect(leitura.valorKwh.equals(valorKwh)).toBe(true);
    expect(leitura.caminhoImagemLocal).toBe('/storage/emulated/0/Pictures/medidor_01.jpg');
    expect(leitura.statusSync).toBe(StatusSyncEnum.PENDENTE);
    expect(leitura.urlImagemRemota).toBeNull();
    expect(leitura.dataHora).toBeInstanceOf(Date);
  });

  it('deve lançar erro se o caminho da imagem local for vazio', () => {
    expect(
      () =>
        new Leitura({
          id: UUIDv4.gerar(),
          usinaId: UUIDv4.gerar(),
          usuarioId: UUIDv4.gerar(),
          valorKwh: new ValorKwh(100),
          caminhoImagemLocal: '   ',
          coordenadas: new CoordenadasGPS(-23.55, -46.63),
        })
    ).toThrow('Foto comprobatória do medidor é obrigatória');
  });

  it('deve transicionar status para Sincronizada ao associar URL remota', () => {
    const leitura = new Leitura({
      id: UUIDv4.gerar(),
      usinaId: UUIDv4.gerar(),
      usuarioId: UUIDv4.gerar(),
      valorKwh: new ValorKwh(500),
      caminhoImagemLocal: '/cache/foto.jpg',
      coordenadas: new CoordenadasGPS(-23.55, -46.63),
    });

    expect(leitura.statusSync).toBe(StatusSyncEnum.PENDENTE);
    const urlRemota = 'https://supabase.co/storage/v1/object/public/comprovantes/foto.jpg';
    leitura.marcarComoSincronizada(urlRemota);

    expect(leitura.statusSync).toBe(StatusSyncEnum.SINCRONIZADA);
    expect(leitura.urlImagemRemota).toBe(urlRemota);
  });

  it('deve transicionar status para Conflito ou Rejeitada', () => {
    const leitura = new Leitura({
      id: UUIDv4.gerar(),
      usinaId: UUIDv4.gerar(),
      usuarioId: UUIDv4.gerar(),
      valorKwh: new ValorKwh(500),
      caminhoImagemLocal: '/cache/foto.jpg',
      coordenadas: new CoordenadasGPS(-23.55, -46.63),
    });

    leitura.marcarComoConflito();
    expect(leitura.statusSync).toBe(StatusSyncEnum.CONFLITO);

    leitura.marcarComoRejeitada();
    expect(leitura.statusSync).toBe(StatusSyncEnum.REJEITADA);
  });
});
