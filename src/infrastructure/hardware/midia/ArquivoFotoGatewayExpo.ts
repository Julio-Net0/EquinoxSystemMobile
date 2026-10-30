import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { FotoPersistida, IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';

/** Lado maior em pixels, conforme AGENTS.md seção 6. */
const LARGURA_ALVO = 1080;

/** Alvo de ~300 KB do AGENTS.md, com folga para não degradar demais. */
const ORCAMENTO_BYTES = 320_000;

/** Qualidades tentadas em ordem até caber no orçamento. */
const QUALIDADES = [0.8, 0.7, 0.6, 0.5];

const PASTA = 'leituras';

/**
 * Comprime a foto do medidor e move do cache para o armazenamento permanente.
 *
 * A uri que a câmera devolve aponta para um arquivo temporário de cache, que o
 * sistema pode apagar a qualquer momento — sem esta etapa a leitura ficaria sem
 * comprovante. O destino é `Paths.document`, que não é purgado.
 *
 * Usa a API contextual do SDK 57 (`ImageManipulator.manipulate`); o
 * `manipulateAsync` antigo está deprecado.
 */
export class ArquivoFotoGatewayExpo implements IArquivoFotoGateway {
  async comprimirEPersistir(uriTemporaria: string, nomeBase: string): Promise<FotoPersistida> {
    const contexto = ImageManipulator.manipulate(uriTemporaria);
    // Só a largura: a proporção é preservada, então 1080 vira o lado maior em
    // retrato, que é como o medidor é fotografado.
    contexto.resize({ width: LARGURA_ALVO });
    const renderizada = await contexto.renderAsync();

    const destino = this.arquivoDestino(nomeBase);

    let salva = await renderizada.saveAsync({
      format: SaveFormat.JPEG,
      compress: QUALIDADES[0],
    });

    // Reduz a qualidade só enquanto o arquivo passar do orçamento. Um visor de
    // medidor é quase todo fundo uniforme, então em geral a primeira já cabe.
    for (let i = 1; i < QUALIDADES.length; i += 1) {
      if (new File(salva.uri).size <= ORCAMENTO_BYTES) break;
      salva = await renderizada.saveAsync({
        format: SaveFormat.JPEG,
        compress: QUALIDADES[i],
      });
    }

    const origem = new File(salva.uri);
    await origem.move(destino);

    return {
      uri: destino.uri,
      bytes: destino.size ?? 0,
      largura: salva.width,
      altura: salva.height,
    };
  }

  async remover(uri: string): Promise<void> {
    const arquivo = new File(uri);
    if (arquivo.exists) await arquivo.delete();
  }

  async existe(uri: string): Promise<boolean> {
    return new File(uri).exists;
  }

  private arquivoDestino(nomeBase: string): File {
    const pasta = new Directory(Paths.document, PASTA);
    if (!pasta.exists) pasta.create();

    return new File(pasta, `${nomeBase}.jpg`);
  }
}
