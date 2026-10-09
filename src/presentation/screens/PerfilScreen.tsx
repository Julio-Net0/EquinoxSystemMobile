import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { InputGroup } from '@/presentation/components/InputGroup';
import { SolarButton } from '@/presentation/components/SolarButton';

export const PerfilScreen: React.FC = () => {
  const router = useRouter();

  // Dados do usuário em sessão (mockup/state)
  const [nome, setNome] = useState('João da Silva');
  const [email, setEmail] = useState('joao@solartech.com');
  const [usuario] = useState('joaosilva');
  const [perfil] = useState('Técnico');
  const [empresa] = useState('Solar Tech Brasil');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const getInitials = (n: string) =>
    n
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'US';

  const handleSalvarPerfil = () => {
    setFeedback({ tipo: 'sucesso', msg: 'Dados atualizados com sucesso!' });
  };

  const handleAlterarSenha = () => {
    setFeedback(null);
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setFeedback({ tipo: 'erro', msg: 'Preencha todas as senhas.' });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setFeedback({ tipo: 'erro', msg: 'A nova senha e a confirmação não coincidem.' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setFeedback({ tipo: 'sucesso', msg: 'Senha alterada com sucesso!' });
    }, 600);
  };

  const handleLogout = () => {
    Alert.alert('Sair da Conta', 'Deseja realmente encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => router.replace('/login') },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MEU PERFIL</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(nome)}</Text>
          </View>
          <Text style={styles.profileName}>{nome}</Text>
          <Text style={styles.profileMeta}>@{usuario} · {empresa}</Text>
          <View style={{ marginTop: 8 }}>
            <BadgeStatus status={perfil} />
          </View>
        </View>

        {feedback ? (
          <View
            style={[
              styles.feedbackBanner,
              feedback.tipo === 'sucesso' ? styles.feedbackSucesso : styles.feedbackErro,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.tipo === 'sucesso' ? styles.textSucesso : styles.textErro,
              ]}
            >
              {feedback.msg}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>DADOS CADASTRAIS</Text>
          <InputGroup label="Nome Completo" value={nome} onChangeText={setNome} />
          <InputGroup label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <SolarButton title="SALVAR ALTERAÇÕES" variant="secondary" onPress={handleSalvarPerfil} style={{ marginTop: 8 }} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ALTERAR SENHA</Text>
          <InputGroup label="Senha Atual" value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry />
          <InputGroup label="Nova Senha" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry />
          <InputGroup label="Confirmar Nova Senha" value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry />
          <SolarButton title="ATUALIZAR SENHA" loading={loading} onPress={handleAlterarSenha} style={{ marginTop: 8 }} />
        </View>

        <SolarButton title="ENCERRAR SESSÃO" variant="danger" onPress={handleLogout} style={{ marginTop: 12, marginBottom: 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SolarTheme.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    color: SolarTheme.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SolarTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
  },
  profileName: {
    color: SolarTheme.text,
    fontSize: 20,
    fontWeight: '900',
  },
  profileMeta: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  feedbackBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedbackSucesso: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackErro: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  textSucesso: {
    color: SolarTheme.emerald,
  },
  textErro: {
    color: SolarTheme.rose,
  },
  sectionCard: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    color: SolarTheme.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
});
