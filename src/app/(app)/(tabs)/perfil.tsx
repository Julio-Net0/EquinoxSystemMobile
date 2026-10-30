import React from 'react';
import { useRouter } from 'expo-router';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { PerfilScreen } from '@/presentation/screens/PerfilScreen';
import { useAuth } from '@/presentation/hooks/useAuth';
import { useCasos } from '@/presentation/context/ContainerProvider';

export default function PerfilRoute() {
  const router = useRouter();
  const { usuario, perfil, recarregar, sair } = useAuth();
  const casos = useCasos();

  if (!usuario) return null;

  return (
    <PerfilScreen
      nome={usuario.nome}
      usuario={usuario.usuario}
      email={usuario.email}
      perfil={perfil ?? PerfilEnum.TECNICO}
      onSalvarDados={async (dados) => {
        const saida = await casos.perfil.alterarDados({
          usuarioId: usuario.usuarioId,
          ...dados,
        });
        // A sessão guarda nome, login e e-mail para o cabeçalho.
        if (saida.sucesso) await recarregar();
        return saida;
      }}
      onAlterarSenha={async (dados) => {
        const saida = await casos.perfil.alterarSenha({
          usuarioId: usuario.usuarioId,
          ...dados,
        });
        // Trocar a senha limpa a sessão: relê para o app voltar ao login.
        if (saida.sucesso) await recarregar();
        return saida;
      }}
      onSair={() => void sair()}
      onDiagnostico={() => router.push('/(app)/diagnostico')}
    />
  );
}
