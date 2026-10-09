export interface UploadFotoParametros {
  caminhoLocal: string;
  idLeitura: string;
  empresaId: string;
  usinaId: string;
}

export interface IStorageGateway {
  uploadFotoComprovante(params: UploadFotoParametros): Promise<string>;
}
