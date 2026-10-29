import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

const base = () => ({
  id: UUIDv4.gerar(),
  empresaId: UUIDv4.gerar(),
  apelido: 'Sede administrativa',
  uc: '3001234567',
});

describe('Endereco', () => {
  it('é criado com apelido e UC', () => {
    const endereco = new Endereco(base());
    expect(endereco.apelido).toBe('Sede administrativa');
    expect(endereco.uc).toBe('3001234567');
    expect(endereco.ehUsina).toBe(false);
  });

  it('remove espaços das bordas do apelido e da UC', () => {
    const endereco = new Endereco({ ...base(), apelido: '  Galpão 2  ', uc: ' 300999 ' });
    expect(endereco.apelido).toBe('Galpão 2');
    expect(endereco.uc).toBe('300999');
  });

  it.each([['apelido', { apelido: '   ' }], ['UC', { uc: '' }]])(
    'recusa %s vazio',
    (campo, sobrescrita) => {
      expect(() => new Endereco({ ...base(), ...sobrescrita })).toThrow(
        campo === 'apelido' ? 'Apelido do endereço é obrigatório' : 'UC do endereço é obrigatória',
      );
    },
  );

  describe('usina', () => {
    it('aceita leitura de injeção quando é usina', () => {
      const endereco = new Endereco({ ...base(), ehUsina: true });
      expect(endereco.ehUsina).toBe(true);
      expect(endereco.aceitaInjecao()).toBe(true);
    });

    it('não aceita injeção quando não é usina', () => {
      expect(new Endereco(base()).aceitaInjecao()).toBe(false);
    });
  });

  describe('geocerca', () => {
    it('não tem geocerca sem coordenadas', () => {
      const endereco = new Endereco(base());
      expect(endereco.coordenadas).toBeNull();
      expect(endereco.temGeocerca()).toBe(false);
    });

    it('tem geocerca com coordenadas', () => {
      const endereco = new Endereco({ ...base(), coordenadas: new CoordenadasGPS(-19.9191, -43.9386) });
      expect(endereco.temGeocerca()).toBe(true);
    });

    it('adota uma coordenada depois da criação', () => {
      const endereco = new Endereco(base());
      endereco.definirCoordenadas(new CoordenadasGPS(-19.9191, -43.9386));
      expect(endereco.temGeocerca()).toBe(true);
      expect(endereco.coordenadas?.latitude).toBeCloseTo(-19.9191);
    });
  });

  describe('logradouro', () => {
    it('junta os campos preenchidos com separador', () => {
      const endereco = new Endereco({
        ...base(), rua: 'Rua das Flores', numero: '123', bairro: 'Centro', cidade: 'Belo Horizonte',
      });
      expect(endereco.logradouro()).toBe('Rua das Flores, 123 · Centro · Belo Horizonte');
    });

    it('omite os campos ausentes', () => {
      expect(new Endereco({ ...base(), cidade: 'Contagem' }).logradouro()).toBe('Contagem');
    });

    it('devolve string vazia quando nada foi informado', () => {
      expect(new Endereco(base()).logradouro()).toBe('');
    });
  });
});
