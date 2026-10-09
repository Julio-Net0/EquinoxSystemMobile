import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { loginOnline, desbloquearComPin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [modoOffline, setModoOffline] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleLoginOnline = async () => {
    if (!email || email.trim() === '') {
      setErro('Por favor, informe seu email.');
      return;
    }
    setErro(null);
    const ok = await loginOnline(email);
    if (!ok) {
      setErro('Falha ao autenticar. Verifique o email informado.');
    }
  };

  const handleDesbloqueioPin = async () => {
    if (!pin || pin.trim() === '') {
      setErro('Por favor, informe o PIN local.');
      return;
    }
    setErro(null);
    const ok = await desbloquearComPin(pin);
    if (!ok) {
      setErro('PIN local incorreto.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Equinox Mobile ☀️</Text>
        <Text style={styles.subtitle}>
          {modoOffline ? 'Desbloqueio Offline em Campo' : 'Autenticação de Usuário'}
        </Text>

        {erro && <Text style={styles.errorText}>{erro}</Text>}

        {!modoOffline ? (
          <>
            <Text style={styles.label}>Email Corporativo:</Text>
            <TextInput
              style={styles.input}
              placeholder="tecnico@equinox.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="input-email"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleLoginOnline}
              disabled={isLoading}
              testID="button-login"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar (Online)</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setModoOffline(true)}
            >
              <Text style={styles.linkText}>Modo Offline (Acessar com PIN Local)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton, { marginTop: 12 }]}
              onPress={() => router.push('/cadastro')}
            >
              <Text style={[styles.linkText, { color: '#F9A825', fontWeight: 'bold' }]}>
                Não tem uma conta? Criar conta →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>PIN de Acesso Local (6 dígitos):</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              testID="input-pin"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleDesbloqueioPin}
              disabled={isLoading}
              testID="button-pin"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Desbloquear Offline</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setModoOffline(false)}
            >
              <Text style={styles.linkText}>Voltar para Login Online</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F8FAFC',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#38BDF8',
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    textAlign: 'center',
  },
});
