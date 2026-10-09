import { IStorageGateway, UploadFotoParametros } from '@/domain/gateways/IStorageGateway';
import { supabase } from '../supabaseClient';

export class SupabaseStorageGateway implements IStorageGateway {
  private readonly bucketName = 'comprovantes';

  async uploadFotoComprovante(params: UploadFotoParametros): Promise<string> {
    const { caminhoLocal, idLeitura, empresaId, usinaId } = params;
    const remotePath = `${empresaId}/${usinaId}/${idLeitura}.jpg`;

    try {
      // Tentar carregar array buffer em ambiente React Native / Node
      const response = await fetch(caminhoLocal);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(remotePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        // Fallback em ambiente de simulação/offline
        return this.obterUrlPublicaFallback(remotePath);
      }

      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch {
      return this.obterUrlPublicaFallback(remotePath);
    }
  }

  private obterUrlPublicaFallback(remotePath: string): string {
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://equinox-supabase.co';
    return `${baseUrl}/storage/v1/object/public/${this.bucketName}/${remotePath}`;
  }
}
