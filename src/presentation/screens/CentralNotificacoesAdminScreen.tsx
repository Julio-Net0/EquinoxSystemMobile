import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { SolarButton } from '@/presentation/components/SolarButton';

interface NotificacaoItem {
  id: string;
  tipo: 'LEITURA_ATRASADA' | 'LEITURA_SUBSTITUIDA' | 'LEITURA_VALOR_MENOR' | 'PLANILHA_FALHA';
  titulo: string;
  mensagem: string;
  dataHora: string;
  lida: boolean;
  detalhes?: { usina: string; valorMedido: number; valorAnterior?: number; operador: string };
}

export const CentralNotificacoesAdminScreen: React.FC = () => {
  const router = useRouter();

  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([
    {
      id: '1',
      tipo: 'LEITURA_VALOR_MENOR',
      titulo: 'Medição menor que a anterior',
      mensagem: 'O técnico informou 4.250 kWh na Usina Parque Central, porém a leitura anterior era 4.310 kWh.',
      dataHora: '09/10/2026 14:30',
      lida: false,
      detalhes: { usina: 'Usina Solar Parque Central', valorMedido: 4250, valorAnterior: 4310, operador: 'João da Silva' },
    },
    {
      id: '2',
      tipo: 'LEITURA_ATRASADA',
      titulo: 'Leitura Atrasada pendente de decisão',
      mensagem: 'Leitura referente a 05/10 enviada com atraso pelo operador.',
      dataHora: '08/10/2026 18:15',
      lida: false,
      detalhes: { usina: 'Usina Fotovoltaica Norte', valorMedido: 1890, operador: 'Carlos Santos' },
    },
    {
      id: '3',
      tipo: 'LEITURA_SUBSTITUIDA',
      titulo: 'Duplicidade Resolvida (Last Write Wins)',
      mensagem: 'Leitura mais recente prevaleceu automaticamente no servidor.',
      dataHora: '07/10/2026 09:10',
      lida: true,
    },
  ]);

  const handleMarcarLida = (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const handleMarcarTodasLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const handleDecidirLeitura = (id: string, decisao: 'aprovar' | 'rejeitar') => {
    Alert.alert(
      decisao === 'aprovar' ? 'Aprovar Medição' : 'Rejeitar Medição',
      `Confirma a ação de ${decisao} para esta notificação?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            setNotificacoes((prev) => prev.filter((n) => n.id !== id));
          },
        },
      ]
    );
  };

  const getTipoIcon = (tipo: NotificacaoItem['tipo']) => {
    switch (tipo) {
      case 'LEITURA_ATRASADA':
        return '⏰';
      case 'LEITURA_SUBSTITUIDA':
        return '🔄';
      case 'LEITURA_VALOR_MENOR':
        return '📉';
      case 'PLANILHA_FALHA':
        return '⚠️';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOTIFICAÇÕES ADMIN</Text>
        <TouchableOpacity onPress={handleMarcarTodasLidas}>
          <Text style={styles.headerLidas}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {notificacoes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptyDesc}>Você está com todas as notificações em dia!</Text>
          </View>
        ) : (
          notificacoes.map((item) => (
            <View key={item.id} style={[styles.card, !item.lida && styles.cardNaoLida]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{getTipoIcon(item.tipo)}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  <Text style={styles.cardData}>{item.dataHora}</Text>
                </View>
                {!item.lida ? <BadgeStatus status="NOVA" /> : null}
              </View>

              <Text style={styles.cardMsg}>{item.mensagem}</Text>

              {item.detalhes ? (
                <View style={styles.detalhesBox}>
                  <Text style={styles.detalheText}>Usina: {item.detalhes.usina}</Text>
                  <Text style={styles.detalheText}>Operador: {item.detalhes.operador}</Text>
                  <Text style={styles.detalheText}>
                    Medido: <Text style={{ color: SolarTheme.primary, fontWeight: '800' }}>{item.detalhes.valorMedido} kWh</Text>
                    {item.detalhes.valorAnterior ? ` (Anterior: ${item.detalhes.valorAnterior} kWh)` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardActions}>
                {item.tipo === 'LEITURA_VALOR_MENOR' || item.tipo === 'LEITURA_ATRASADA' ? (
                  <View style={styles.decisionRow}>
                    <SolarButton
                      title="ACEITAR MEDIÇÃO"
                      onPress={() => handleDecidirLeitura(item.id, 'aprovar')}
                      style={{ flex: 1, marginRight: 6 }}
                    />
                    <SolarButton
                      title="REJEITAR"
                      variant="danger"
                      onPress={() => handleDecidirLeitura(item.id, 'rejeitar')}
                      style={{ flex: 1, marginLeft: 6 }}
                    />
                  </View>
                ) : !item.lida ? (
                  <SolarButton
                    title="MARCAR COMO LIDA"
                    variant="secondary"
                    onPress={() => handleMarcarLida(item.id)}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerBack: {
    color: SolarTheme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: SolarTheme.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerLidas: {
    color: SolarTheme.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
  },
  emptyCard: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: SolarTheme.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDesc: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
  },
  card: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardNaoLida: {
    borderColor: 'rgba(249, 168, 37, 0.3)',
    backgroundColor: SolarTheme.surfaceContainerHigh,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    color: SolarTheme.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cardData: {
    color: SolarTheme.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  cardMsg: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  detalhesBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  detalheText: {
    color: SolarTheme.text,
    fontSize: 12,
  },
  cardActions: {
    marginTop: 12,
  },
  decisionRow: {
    flexDirection: 'row',
  },
});
