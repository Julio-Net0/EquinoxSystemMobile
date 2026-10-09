import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { InputGroup } from '@/presentation/components/InputGroup';
import { SolarButton } from '@/presentation/components/SolarButton';
import { GerenciarEmpresasUseCase, EmpresaOutputDTO } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

const empresaRepo = new EmpresaRepositoryMemory();
const gerenciarEmpresasUseCase = new GerenciarEmpresasUseCase(empresaRepo);

export const GestaoEmpresasScreen: React.FC = () => {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<EmpresaOutputDTO[]>([]);
  const [modalNovaEmpresa, setModalNovaEmpresa] = useState(false);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarEmpresas();
  }, []);

  const carregarEmpresas = async () => {
    let lista = await empresaRepo.listarTodas();
    if (lista.length === 0) {
      const e1 = new Empresa({ id: UUIDv4.gerar(), nome: 'Solar Tech Brasil', cnpj: new CNPJ('12345678000195') });
      const e2 = new Empresa({ id: UUIDv4.gerar(), nome: 'Equinox Energia Renovável', cnpj: new CNPJ('11222333000181') });
      await empresaRepo.salvar(e1);
      await empresaRepo.salvar(e2);
    }

    const output = await gerenciarEmpresasUseCase.listar();
    setEmpresas(output);
  };

  const handleCriarEmpresa = async () => {
    if (!nome.trim() || !cnpj.trim()) {
      Alert.alert('Atenção', 'Informe o nome e o CNPJ da empresa.');
      return;
    }

    setLoading(true);
    try {
      await gerenciarEmpresasUseCase.criar({ nome, cnpj });
      setNome('');
      setCnpj('');
      setModalNovaEmpresa(false);
      carregarEmpresas();
    } catch (err: any) {
      Alert.alert('Erro no CNPJ / Cadastro', err.message || 'Falha ao cadastrar empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GESTÃO DE EMPRESAS (SUPERADMIN)</Text>
        <TouchableOpacity onPress={() => setModalNovaEmpresa(true)}>
          <Text style={styles.headerAdd}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle}>Tenants Cadastrados</Text>
          <Text style={styles.topDesc}>
            Toque numa empresa para gerenciar sua estrutura de usinas e integrantes.
          </Text>
          <View style={{ marginTop: 8 }}>
            <BadgeStatus status="SUPERADMIN" />
          </View>
        </View>

        {empresas.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/estrutura')}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empresaNome}>{e.nome}</Text>
                <Text style={styles.empresaCnpj}>CNPJ: {e.cnpj}</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>Status: <Text style={{ color: SolarTheme.emerald, fontWeight: '700' }}>ATIVO</Text></Text>
              <Text style={styles.metaText}>Gerenciar Usinas →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal Criar Empresa */}
      <Modal visible={modalNovaEmpresa} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Nova Empresa (Tenant)</Text>
            <InputGroup
              label="Nome da Empresa"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: SunPower Usinas Solar S.A."
            />
            <InputGroup
              label="CNPJ (apenas números ou formatado)"
              value={cnpj}
              onChangeText={setCnpj}
              placeholder="12.345.678/0001-95"
              keyboardType="numeric"
            />

            <SolarButton
              title="CRIAR EMPRESA"
              loading={loading}
              onPress={handleCriarEmpresa}
              style={{ marginTop: 12 }}
            />
            <SolarButton
              title="CANCELAR"
              variant="secondary"
              onPress={() => setModalNovaEmpresa(false)}
            />
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    marginBottom: 20,
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  empresaNome: {
    color: SolarTheme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  empresaCnpj: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    color: SolarTheme.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  metaText: {
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
