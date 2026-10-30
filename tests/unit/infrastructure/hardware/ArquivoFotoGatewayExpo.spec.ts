import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ArquivoFotoGatewayExpo } from '@/infrastructure/hardware/midia/ArquivoFotoGatewayExpo';

/**
 * Dublê próprio do expo-file-system, no lugar do global do setup, para este
 * teste controlar o tamanho do arquivo e observar o move do cache para o
 * armazenamento permanente.
 */
const mockEstado = {
  tamanhos: [] as number[],
  pastaExiste: true,
  criadas: [] as string[],
  movimentos: [] as { de: string; para: string }[],
  apagados: [] as string[],
};

jest.mock('expo-file-system', () => {
  class FileDuble {
    uri: string;

    constructor(...segmentos: unknown[]) {
      this.uri = segmentos
        .map((s) => (typeof s === 'string' ? s : (s as { uri: string }).uri))
        .join('/');
    }

    get size(): number {
      // Cada leitura consome um tamanho da fila; esgotada, fica no último.
      const fila = mockEstado.tamanhos;
      return fila.length > 1 ? (fila.shift() as number) : (fila[0] ?? 0);
    }

    get exists(): boolean {
      return true;
    }

    move(destino: { uri: string }) {
      mockEstado.movimentos.push({ de: this.uri, para: destino.uri });
    }

    delete() {
      mockEstado.apagados.push(this.uri);
    }
  }

  class DirectoryDuble {
    uri: string;

    constructor(...segmentos: unknown[]) {
      this.uri = segmentos
        .map((s) => (typeof s === 'string' ? s : (s as { uri: string }).uri))
        .join('/');
    }

    get exists(): boolean {
      return mockEstado.pastaExiste;
    }

    create() {
      mockEstado.criadas.push(this.uri);
    }
  }

  return {
    Paths: { document: 'file:///documents', cache: 'file:///cache' },
    File: FileDuble,
    Directory: DirectoryDuble,
  };
});

const URI_CAMERA = 'file:///cache/medidor_cru.jpg';

describe('ArquivoFotoGatewayExpo', () => {
  let gateway: ArquivoFotoGatewayExpo;

  beforeEach(() => {
    gateway = new ArquivoFotoGatewayExpo();
    mockEstado.tamanhos = [300_000];
    mockEstado.pastaExiste = true;
    mockEstado.criadas = [];
    mockEstado.movimentos = [];
    mockEstado.apagados = [];
    jest.clearAllMocks();
  });

  describe('compressão', () => {
    it('reduz para 1080 de largura, preservando a proporção', async () => {
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      const contexto = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
      // Só a largura: passar os dois lados distorceria a foto do visor.
      expect(contexto.resize).toHaveBeenCalledWith({ width: 1080 });
    });

    it('parte da foto que a câmera entregou', async () => {
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');
      expect(ImageManipulator.manipulate).toHaveBeenCalledWith(URI_CAMERA);
    });

    it('salva em JPEG', async () => {
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      const contexto = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
      const renderizada = await contexto.renderAsync.mock.results[0].value;
      expect(renderizada.saveAsync).toHaveBeenCalledWith(
        expect.objectContaining({ format: SaveFormat.JPEG }),
      );
    });

    it('não insiste na qualidade quando o arquivo já cabe no orçamento', async () => {
      mockEstado.tamanhos = [300_000];

      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      const contexto = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
      const renderizada = await contexto.renderAsync.mock.results[0].value;
      expect(renderizada.saveAsync).toHaveBeenCalledTimes(1);
    });

    it('baixa a qualidade enquanto o arquivo passa de ~300 KB', async () => {
      // Primeira tentativa grande demais, segunda dentro do orçamento.
      mockEstado.tamanhos = [900_000, 280_000];

      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      const contexto = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
      const renderizada = await contexto.renderAsync.mock.results[0].value;
      const qualidades = renderizada.saveAsync.mock.calls.map(
        (chamada: [{ compress: number }]) => chamada[0].compress,
      );

      expect(qualidades.length).toBeGreaterThan(1);
      expect(qualidades[1]).toBeLessThan(qualidades[0]);
    });

    it('para de tentar mesmo se o arquivo nunca couber', async () => {
      mockEstado.tamanhos = [900_000];

      await expect(gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1')).resolves.toBeDefined();

      const contexto = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
      const renderizada = await contexto.renderAsync.mock.results[0].value;
      expect(renderizada.saveAsync.mock.calls.length).toBeLessThanOrEqual(4);
    });
  });

  describe('persistência', () => {
    it('move do cache para o armazenamento permanente', async () => {
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      // A uri da câmera é um arquivo temporário que o sistema pode apagar:
      // sem este passo a leitura ficaria sem comprovante.
      expect(mockEstado.movimentos).toHaveLength(1);
      expect(mockEstado.movimentos[0].para).toContain('file:///documents');
      expect(mockEstado.movimentos[0].para).toContain('leituras');
    });

    it('nomeia o arquivo pelo identificador da leitura', async () => {
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-abc');
      expect(mockEstado.movimentos[0].para).toContain('leitura-abc.jpg');
    });

    it('cria a pasta de leituras na primeira foto', async () => {
      mockEstado.pastaExiste = false;

      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      expect(mockEstado.criadas).toHaveLength(1);
      expect(mockEstado.criadas[0]).toContain('leituras');
    });

    it('não recria a pasta quando ela já existe', async () => {
      mockEstado.pastaExiste = true;
      await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');
      expect(mockEstado.criadas).toHaveLength(0);
    });

    it('devolve a uri permanente e as medidas, não a do cache', async () => {
      const foto = await gateway.comprimirEPersistir(URI_CAMERA, 'leitura-1');

      expect(foto.uri).toContain('file:///documents');
      expect(foto.uri).not.toBe(URI_CAMERA);
      expect(foto.largura).toBe(1080);
      expect(foto.bytes).toBeGreaterThan(0);
    });
  });

  describe('remoção', () => {
    it('apaga o arquivo pedido', async () => {
      await gateway.remover('file:///documents/leituras/antiga.jpg');
      expect(mockEstado.apagados).toContain('file:///documents/leituras/antiga.jpg');
    });
  });
});
