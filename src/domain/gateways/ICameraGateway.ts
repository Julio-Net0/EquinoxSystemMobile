export interface FotoCapturada {
  uri: string;
  largura: number;
  altura: number;
}

/**
 * Captura crua da câmera. A uri que volta aponta para um arquivo temporário de
 * cache — quem torna a foto permanente é o IArquivoFotoGateway.
 *
 * A implementação real precisa de uma ref do componente CameraView, que só
 * existe enquanto a tela está montada; por isso ela expõe um registro de
 * capturador em vez de falar com o hardware direto.
 */
export interface ICameraGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  capturar(): Promise<FotoCapturada | null>;
}
