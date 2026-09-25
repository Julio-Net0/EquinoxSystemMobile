export interface CapturarFotoResultado {
  uri: string;
  sizeBytes: number;
}

export interface ICameraGateway {
  solicitarPermissao(): Promise<boolean>;
  capturarEComprimirFoto(): Promise<CapturarFotoResultado | null>;
}
