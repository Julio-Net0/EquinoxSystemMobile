import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUsinas } from '../hooks/useUsinas';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { Usina } from '@/domain/entities/Usina';

export interface ListaUsinasScreenProps {
  empresaId: string;
  usinaRepo: IUsinaRepository;
  onSelecionarUsina?: (usina: Usina) => void;
  onNovaUsina?: () => void;
}

export const ListaUsinasScreen: React.FC<ListaUsinasScreenProps> = ({
  empresaId,
  usinaRepo,
  onSelecionarUsina,
  onNovaUsina,
}) => {
  const [busca, setBusca] = useState('');
  const { usinas, isLoading, error, refetch } = useUsinas(usinaRepo, {
    empresaId,
    buscaTexto: busca,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catálogo de Usinas</Text>
        <TouchableOpacity style={styles.newButton} onPress={onNovaUsina} testID="btn-add-usina">
          <Text style={styles.newButtonText}>+ Nova Usina</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Buscar usina por nome ou UC..."
        value={busca}
        onChangeText={setBusca}
        placeholderTextColor="#64748B"
        testID="input-busca-usina"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#0284C7" size="large" />
      ) : (
        <FlatList
          data={usinas}
          keyExtractor={(item) => item.id.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelecionarUsina && onSelecionarUsina(item)}
              testID={`usina-card-${item.id.value}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.usinaName}>{item.nome}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'Ativa'
                      ? styles.badgeAtiva
                      : styles.badgeComissionamento,
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.usinaUc}>Código UC: {item.codigoUC}</Text>
              <Text style={styles.usinaCapacidade}>
                Capacidade: {item.capacidadeNominal} kWh
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhuma usina encontrada no catálogo local.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  newButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F8FAFC',
    marginBottom: 16,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  usinaName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    flex: 1,
  },
  usinaUc: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  usinaCapacidade: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAtiva: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgeComissionamento: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 12,
  },
});
