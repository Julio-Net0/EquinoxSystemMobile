import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { InputGroup } from '@/presentation/components/InputGroup';
import { SolarButton } from '@/presentation/components/SolarButton';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

const usinaRepo = new UsinaRepositoryMemory();

interface UsinaComPadrao {
  id: string;
  nome: string;
  codigoUC: string;
  capacidadeNominal: number;
  concessionaria: string;
  padroes: { id: string; medidor: string; multiplicador: number }[];
}

export const GestaoEstruturaScreen: React.FC = () => {
  const router = useRouter();

  const [usinas, setUsinas] = useState<UsinaComPadrao[]>([]);
  const [modalNovaUsinaVisivel, setModalNovaUsinaVisivel] = useState(false);
  const [modalPadraoUsinaId, setModalPadraoUsinaId] = useState<string | null>(null);

  // Form de nova usina
  const [nomeUsina, setNomeUsina] = useState('');
  const [codigoUC, setCodigoUC] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [concessionaria, setConcessionaria] = useState('CEMIG');

  // Form de novo padrão
  const [numMedidor, setNumMedidor] = useState('');
  const [multiplicador, setMultiplicador] = useState('1.0');

  useEffect(() => {
    carregarUsinas();
  }, []);

  const carregarUsinas = async () => {
    let lista = await usinaRepo.listarTodas();
    if (lista.length === 0) {
      const u1 = new Usina({ id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(), nome: 'Usina Solar Parque Central', codigoUC: 'UC-1001', capacidadeNominal: 500 });
      const u2 = new Usina({ id: UUIDv4.gerar(), empresaId: UUIDv4.gerar(), nome: 'Usina Fotovoltaica Norte', codigoUC: 'UC-1002', capacidadeNominal: 300 });
      await usinaRepo.salvar(u1);
      await usinaRepo.salvar(u2);
      lista = [u1, u2];
    }

    setUsinas(
      lista.map((u) => ({
        id: u.id.value,
        nome: u.nome,
        codigoUC: u.codigoUC,
        capacidadeNominal: u.capacidadeNominal,
        concessionaria: 'CEMIG D',
        padroes: [
          { id: '1', medidor: 'MED-778811', multiplicador: 1.0 },
          { id: '2', medidor: 'MED-778812', multiplicador: 1.0 },
        ],
      }))
    );
  };

  const handleCriarUsina = async () => {
    if (!nomeUsina.trim() || !codigoUC.trim() || !capacidade.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos da usina.');
      return;
    }

    const nova = new Usina({
      id: UUIDv4.gerar(),
      empresaId: UUIDv4.gerar(),
      nome: nomeUsina,
      codigoUC,
      capacidadeNominal: Number(capacidade) || 100,
    });

    await usinaRepo.salvar(nova);
    setNomeUsina('');
    setCodigoUC('');
    setCapacidade('');
    setModalNovaUsinaVisivel(false);
    carregarUsinas();
  };

  const handleAdicionarPadrao = (usinaId: string) => {
    if (!numMedidor.trim()) {
      Alert.alert('Atenção', 'Informe o número do medidor.');
      return;
    }

    setUsinas((prev) =>
      prev.map((u) => {
        if (u.id !== usinaId) return u;
        return {
          ...u,
          padroes: [
            ...u.padroes,
            { id: Date.now().toString(), medidor: numMedidor, multiplicador: Number(multiplicador) || 1.0 },
          ],
        };
      })
    );

    setNumMedidor('');
    setMultiplicador('1.0');
    setModalPadraoUsinaId(null);
  };

  const usinaSelecionadaModal = usinas.find((u) => u.id === modalPadraoUsinaId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ESTRUTURA & PADRÕES</Text>
        <TouchableOpacity onPress={() => setModalNovaUsinaVisivel(true)}>
          <Text style={styles.headerAdd}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle}>Usinas & Medidores Configurados</Text>
          <Text style={styles.topDesc}>Gerencie os locais de geração de energia e seus padrões de medição.</Text>
        </View>

        {usinas.map((u) => (
          <View key={u.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.usinaNome}>{u.nome}</Text>
                <Text style={styles.usinaUc}>UC: {u.codigoUC} · {u.concessionaria}</Text>
              </View>
              <BadgeStatus status={`${u.capacidadeNominal} kWp`} />
            </View>

            <View style={styles.padroesSection}>
              <Text style={styles.sectionLabel}>PADRÕES DE MEDIÇÃO ({u.padroes.length})</Text>
              {u.padroes.map((p) => (
                <View key={p.id} style={styles.padraoItem}>
                  <Text style={styles.padraoMedidor}>📟 {p.medidor}</Text>
                  <Text style={styles.padraoMult}>Mult: {p.multiplicador}x</Text>
                </View>
              ))}

              <SolarButton
                title="+ ADICIONAR PADRÃO"
                variant="outline"
                onPress={() => setModalPadraoUsinaId(u.id)}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal Criar Usina */}
      <Modal visible={modalNovaUsinaVisivel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Nova Usina</Text>
            <InputGroup label="Nome da Usina" value={nomeUsina} onChangeText={setNomeUsina} placeholder="Ex: Usina Fotovoltaica Leste" />
            <InputGroup label="Código UC (Unidade Consumidora)" value={codigoUC} onChangeText={setCodigoUC} placeholder="Ex: UC-9988" />
            <InputGroup label="Capacidade Nominal (kWp)" value={capacidade} onChangeText={setCapacidade} placeholder="Ex: 450" keyboardType="numeric" />
            <InputGroup label="Concessionária" value={concessionaria} onChangeText={setConcessionaria} placeholder="CEMIG, ENERGISA, etc" />

            <SolarButton title="SALVAR USINA" onPress={handleCriarUsina} style={{ marginTop: 12 }} />
            <SolarButton title="CANCELAR" variant="secondary" onPress={() => setModalNovaUsinaVisivel(false)} />
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar Padrão Medidor */}
      <Modal visible={modalPadraoUsinaId !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Padrão de Medidor</Text>
            <Text style={{ color: SolarTheme.textSecondary, marginBottom: 12, fontSize: 13 }}>
              Usina: <Text style={{ color: SolarTheme.text, fontWeight: '700' }}>{usinaSelecionadaModal?.nome}</Text>
            </Text>

            <InputGroup label="Número do Medidor" value={numMedidor} onChangeText={setNumMedidor} placeholder="Ex: MED-123456" />
            <InputGroup label="Multiplicador" value={multiplicador} onChangeText={setMultiplicador} placeholder="1.0" keyboardType="numeric" />

            <SolarButton
              title="VINCULAR MEDIDOR"
              onPress={() => modalPadraoUsinaId && handleAdicionarPadrao(modalPadraoUsinaId)}
              style={{ marginTop: 12 }}
            />
            <SolarButton title="CANCELAR" variant="secondary" onPress={() => setModalPadraoUsinaId(null)} />
          </View>
        </View>
      </Modal>
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
  headerAdd: {
    color: SolarTheme.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  topInfo: {
    marginBottom: 16,
  },
  topTitle: {
    color: SolarTheme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  topDesc: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  usinaNome: {
    color: SolarTheme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  usinaUc: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  padroesSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  sectionLabel: {
    color: SolarTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  padraoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: SolarTheme.surfaceContainerHigh,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  padraoMedidor: {
    color: SolarTheme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  padraoMult: {
    color: SolarTheme.textSecondary,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: SolarTheme.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
});
