import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export interface DashboardScreenProps {
  onNavegarNovaLeitura?: () => void;
  onNavegarUsinas?: () => void;
  onNavegarNovaUsina?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavegarNovaLeitura,
  onNavegarUsinas,
  onNavegarNovaUsina,
}) => {
  const { usuario, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bem-vindo,</Text>
          <Text style={styles.userName}>{usuario?.nome || 'Operador'}</Text>
          <Text style={styles.userBadge}>Perfil: {usuario?.perfil || 'Técnico'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDotOnline} />
          <Text style={styles.statusTitle}>Modo Offline-First Ativo</Text>
        </View>
        <Text style={styles.statusDesc}>
          Seus dados são salvos localmente e sincronizados automaticamente ao reconectar.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Ações Rápidas em Campo</Text>

      <TouchableOpacity
        style={styles.actionCardPrimary}
        onPress={onNavegarNovaLeitura}
        testID="btn-nova-leitura"
      >
        <Text style={styles.actionIcon}>📸</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Nova Leitura de Medidor</Text>
          <Text style={styles.actionSubtitle}>Registrar consumo (kWh) com foto comprobatória e GPS</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={onNavegarUsinas}
        testID="btn-usinas"
      >
        <Text style={styles.actionIcon}>⚡</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Catálogo de Usinas</Text>
          <Text style={styles.actionSubtitle}>Consultar usinas fotovoltaicas e histórico offline</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={onNavegarNovaUsina}
        testID="btn-nova-usina"
      >
        <Text style={styles.actionIcon}>➕</Text>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Cadastro Emergencial de Usina</Text>
          <Text style={styles.actionSubtitle}>Incluir nova usina em campo (Em Comissionamento)</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  welcomeText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  userBadge: {
    fontSize: 12,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDotOnline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  statusDesc: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  actionCardPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});
