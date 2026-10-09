import { supabase } from '../supabaseClient';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface AutenticacaoResultado {
  token: string;
  usuario: Usuario;
}

export class SupabaseAuthGateway {
  async autenticarComEmailSenha(email: string, senha: string): Promise<AutenticacaoResultado | null> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (authError || !authData.session) {
        return null;
      }

      // Buscar perfil estendido na tabela public.usuarios
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        return null;
      }

      const usuario = new Usuario({
        id: new UUIDv4(userData.id),
        empresaId: new UUIDv4(userData.empresa_id),
        nome: userData.nome,
        email: userData.email,
        perfil: userData.perfil as PerfilEnum,
        status: userData.ativo ? 'Ativo' : 'Inativo',
      });

      return {
        token: authData.session.access_token,
        usuario,
      };
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora erro offline no logout
    }
  }
}
