import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { InputGroup } from '@/presentation/components/InputGroup';
import { SolarButton } from '@/presentation/components/SolarButton';
import { CadastrarUsuarioPendenteUseCase } from '@/application/use-cases/CadastrarUsuarioPendenteUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

// Instâncias para demonstração desacoplada (Clean Architecture)
const empresaRepo = new EmpresaRepositoryMemory();
const usuarioRepo = new UsuarioRepositoryMemory();
const cadastrarUseCase = new CadastrarUsuarioPendenteUseCase(usuarioRepo, empresaRepo);

export const CadastroScreen: React.FC = () => {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1); // 1 = Form, 2 = Confirm, 3 = Sucesso

  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<{ id: string; nome: string } | null>(null);

  const [modalEmpresaVisivel, setModalEmpresaVisivel] = useState(false);
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Carga inicial de empresas mockup para seleção no cadastro
    async function carregarEmpresas() {
      let lista = await empresaRepo.listarTodas();
      if (lista.length === 0) {
        const e1 = new Empresa({ id: UUIDv4.gerar(), nome: 'Solar Tech Brasil', cnpj: new CNPJ('12345678000195') });
        const e2 = new Empresa({ id: UUIDv4.gerar(), nome: 'Equinox Energia Renovável', cnpj: new CNPJ('11222333000181') });
        await empresaRepo.salvar(e1);
        await empresaRepo.salvar(e2);
        lista = [e1, e2];
      }
      setEmpresas(lista.map((e) => ({ id: e.id.value, nome: e.nome })));
    }
    carregarEmpresas();
  }, []);

  const empresasFiltradas = empresas.filter((e) =>
    e.nome.toLowerCase().includes(buscaEmpresa.toLowerCase())
  );

  const avancarParaConfirmacao = () => {
    setErro(null);
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErro('Preencha os campos obrigatórios (Nome, E-mail e Senha).');
      return;
    }
    if (!empresaSelecionada) {
      setErro('Selecione a empresa à qual você pertence.');
      return;
    }
    if (senha !== senha2) {
      setErro('As senhas digitadas não coincidem.');
      return;
    }
    setEtapa(2);
  };

  const confirmarCadastro = async () => {
    setErro(null);
    setLoading(true);
    try {
      await cadastrarUseCase.execute({
        empresaId: empresaSelecionada!.id,
        nome,
        usuario: usuario.trim() || undefined,
        email,
      });
      setEtapa(3);
    } catch (err: any) {
      setErro(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (etapa > 1 ? setEtapa(1) : router.back())}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRIAR CONTA</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>
            EQUINOX <Text style={{ color: SolarTheme.primary }}>MOBILE</Text>
          </Text>
          <Text style={styles.brandSubtitle}>
            {etapa === 1
              ? 'Preencha seus dados e selecione sua empresa.'
              : etapa === 2
              ? 'Confira seus dados antes de confirmar.'
              : 'Solicitação registrada!'}
          </Text>
        </View>

        {erro ? <Text style={styles.errorBanner}>{erro}</Text> : null}

        {etapa === 1 && (
          <View style={styles.formCard}>
            <InputGroup label="Nome completo *" value={nome} onChangeText={setNome} placeholder="Seu nome completo" />
            <InputGroup label="Usuário" value={usuario} onChangeText={setUsuario} placeholder="nome_usuario" autoCapitalize="none" />
            <InputGroup label="E-mail *" value={email} onChangeText={setEmail} placeholder="seu@email.com" keyboardType="email-address" autoCapitalize="none" />

            <View style={styles.selectGroup}>
              <Text style={styles.selectLabel}>Empresa *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setModalEmpresaVisivel(true)}>
                <Text style={styles.selectButtonText}>
                  {empresaSelecionada ? empresaSelecionada.nome : 'Selecione uma empresa…'}
                </Text>
              </TouchableOpacity>
            </View>

            <InputGroup label="Senha *" value={senha} onChangeText={setSenha} placeholder="••••••••" secureTextEntry />
            <InputGroup label="Confirmar Senha *" value={senha2} onChangeText={setSenha2} placeholder="••••••••" secureTextEntry />

            <SolarButton title="CONTINUAR" onPress={avancarParaConfirmacao} style={{ marginTop: 12 }} />
          </View>
        )}

        {etapa === 2 && (
          <View style={styles.formCard}>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>NOME</Text>
              <Text style={styles.reviewValue}>{nome}</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>USUÁRIO</Text>
              <Text style={styles.reviewValue}>{usuario || '-'}</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>E-MAIL</Text>
              <Text style={styles.reviewValue}>{email}</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>EMPRESA</Text>
              <Text style={styles.reviewValue}>{empresaSelecionada?.nome}</Text>
            </View>

            <SolarButton title="CONFIRMAR CADASTRO" loading={loading} onPress={confirmarCadastro} style={{ marginTop: 16 }} />
            <SolarButton title="CORRIGIR DADOS" variant="secondary" onPress={() => setEtapa(1)} />
          </View>
        )}

        {etapa === 3 && (
          <View style={[styles.formCard, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Solicitação Enviada!</Text>
            <Text style={styles.successText}>
              Seu cadastro foi realizado com status <Text style={{ color: SolarTheme.amber, fontWeight: '700' }}>PENDENTE</Text>.
              Aguarde a aprovação do administrador da sua empresa para acessar a plataforma.
            </Text>
            <SolarButton title="IR PARA LOGIN" onPress={() => router.replace('/login')} style={{ width: '100%', marginTop: 24 }} />
          </View>
        )}
      </ScrollView>

      {/* Modal de Seleção de Empresa */}
      <Modal visible={modalEmpresaVisivel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Empresa</Text>
            <InputGroup label="Buscar Empresa" value={buscaEmpresa} onChangeText={setBuscaEmpresa} placeholder="Digite o nome..." />
            <FlatList
              data={empresasFiltradas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.empresaItem}
                  onPress={() => {
                    setEmpresaSelecionada(item);
                    setModalEmpresaVisivel(false);
                  }}
                >
                  <Text style={styles.empresaName}>{item.nome}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 250, marginVertical: 10 }}
            />
            <SolarButton title="FECHAR" variant="secondary" onPress={() => setModalEmpresaVisivel(false)} />
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
  scrollContent: {
    padding: 20,
  },
  brandContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  brandTitle: {
    color: SolarTheme.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: SolarTheme.rose,
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
    fontSize: 13,
  },
  formCard: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectGroup: {
    marginVertical: 8,
  },
  selectLabel: {
    color: SolarTheme.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  selectButton: {
    backgroundColor: SolarTheme.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectButtonText: {
    color: SolarTheme.text,
    fontSize: 14,
  },
  reviewItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 8,
  },
  reviewLabel: {
    color: SolarTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewValue: {
    color: SolarTheme.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  successIcon: {
    fontSize: 48,
    color: SolarTheme.emerald,
    marginBottom: 12,
  },
  successTitle: {
    color: SolarTheme.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  successText: {
    color: SolarTheme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  empresaItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  empresaName: {
    color: SolarTheme.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
