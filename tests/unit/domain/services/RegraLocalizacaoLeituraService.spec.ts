import {
  AvaliacaoLocalizacao,
  RegraLocalizacaoLeituraService,
} from '@/domain/services/RegraLocalizacaoLeituraService';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

const PRACA_SETE = new CoordenadasGPS(-19.9191, -43.9386);
/** ~300 m da Praça Sete. */
const PERTO = new CoordenadasGPS(-19.9218, -43.9386);
/** Contagem, ~15 km. */
const LONGE = new CoordenadasGPS(-19.9321, -44.0539);

describe('RegraLocalizacaoLeituraService', () => {
  it('o raio padrão é de 500 metros', () => {
    expect(RegraLocalizacaoLeituraService.RAIO_PADRAO_METROS).toBe(500);
  });

  it('aprova quando o técnico está dentro do raio', () => {
    const avaliacao = RegraLocalizacaoLeituraService.avaliar(PERTO, PRACA_SETE);
    expect(avaliacao.situacao).toBe<AvaliacaoLocalizacao['situacao']>('dentro_do_raio');
    expect(avaliacao.distanciaMetros).toBeGreaterThan(0);
    expect(avaliacao.distanciaMetros).toBeLessThan(500);
  });

  it('sinaliza quando o técnico está fora do raio, sem impedir a leitura', () => {
    const avaliacao = RegraLocalizacaoLeituraService.avaliar(LONGE, PRACA_SETE);
    expect(avaliacao.situacao).toBe<AvaliacaoLocalizacao['situacao']>('fora_do_raio');
    expect(avaliacao.distanciaMetros).toBeGreaterThan(500);
  });

  it('não confere nada quando o endereço não tem coordenada cadastrada', () => {
    const avaliacao = RegraLocalizacaoLeituraService.avaliar(PERTO, null);
    expect(avaliacao.situacao).toBe<AvaliacaoLocalizacao['situacao']>('endereco_sem_geocerca');
    expect(avaliacao.distanciaMetros).toBeNull();
  });

  it('registra quando o GPS não respondeu', () => {
    const avaliacao = RegraLocalizacaoLeituraService.avaliar(null, PRACA_SETE);
    expect(avaliacao.situacao).toBe<AvaliacaoLocalizacao['situacao']>('sem_gps');
    expect(avaliacao.distanciaMetros).toBeNull();
  });

  it('sem GPS e sem geocerca também é apenas sem GPS', () => {
    expect(RegraLocalizacaoLeituraService.avaliar(null, null).situacao).toBe('sem_gps');
  });

  it('aceita um raio diferente', () => {
    expect(RegraLocalizacaoLeituraService.avaliar(PERTO, PRACA_SETE, 100).situacao).toBe('fora_do_raio');
    expect(RegraLocalizacaoLeituraService.avaliar(LONGE, PRACA_SETE, 20_000).situacao).toBe('dentro_do_raio');
  });

  it('nenhuma situação impede o registro da leitura', () => {
    const todas = [
      RegraLocalizacaoLeituraService.avaliar(PERTO, PRACA_SETE),
      RegraLocalizacaoLeituraService.avaliar(LONGE, PRACA_SETE),
      RegraLocalizacaoLeituraService.avaliar(PERTO, null),
      RegraLocalizacaoLeituraService.avaliar(null, PRACA_SETE),
    ];
    expect(todas.every((a) => a.impedeRegistro === false)).toBe(true);
  });
});
