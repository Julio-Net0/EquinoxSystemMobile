import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { InputGroup } from '@/presentation/components/InputGroup';
import { SolarButton } from '@/presentation/components/SolarButton';
import { GerenciarUsuariosEmpresaUseCase, UsuarioOutputDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

const usuarioRepo = new UsuarioRepositoryMemory();
const gerenciarUseCase = new GerenciarUsuariosEmpresaUseCase(usuarioRepo);

export const GestaoUsuariosScreen: React.FC = () => {
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<UsuarioOutputDTO[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarUsuarios();
  }, [termoBusca, statusFiltro]);

  const carregarUsuarios = async () => {
    setLoading(true);

    let lista = await usuarioRepo.listarComFiltros({});
    if (lista.length === 0) {
      const empId = UUIDv4.gerar();
      const u1 = new Usuario({
        id: UUIDv4.gerar(),
        empresaId: empId,
        nome: 'João da Silva',
        usuario: 'joaosilva',
        email: 'joao@solartech.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Ativo',
      });
      const u2 = new Usuario({
        id: UUIDv4.gerar(),
        empresaId: empId,
        nome: 'Maria Andrade',
        usuario: 'mandrade',
        email: 'maria@solartech.com',
        perfil: PerfilEnum.ADMIN,
        status: 'Ativo',
      });
      const u3 = new Usuario({
        id: UUIDv4.gerar(),
        empresaId: empId,
        nome: 'Pedro Rocha',
        usuario: 'procha',
        email: 'pedro@solartech.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Inativo',
      });
      await usuarioRepo.salvar(u1);
      await usuarioRepo.salvar(u2);
      await usuarioRepo.salvar(u3);
    }

    const result = await gerenciarUseCase.listar({
      termoBusca: termoBusca.trim() || undefined,
      status: statusFiltro !== 'todos' ? statusFiltro : undefined,
    });

    setUsuarios(result);
    setLoading(false);
  };

  const handleAlternarStatus = async (user: UsuarioOutputDTO) => {
    try {
      await gerenciarUseCase.alternarStatus({ usuarioId: user.id });
      carregarUsuarios();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao alterar status');
    }
  };

  const handleExcluir = (user: UsuarioOutputDTO) => {
    Alert.alert(
      'Remover Usuário',
      `Tem certeza que deseja remover ${user.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await gerenciarUseCase.excluir({ usuarioId: user.id });
              carregarUsuarios();
            } catch (err: any) {
              Alert.alert('Erro', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GESTÃO DE USUÁRIOS</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <InputGroup
          label="BUSCAR INTEGRANTE"
          value={termoBusca}
          onChangeText={setTermoBusca}
          placeholder="Nome, e-mail ou nome de usuário..."
        />

        <View style={styles.filterBar}>
          {['todos', 'ativo', 'inativo', 'pendente'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, statusFiltro === f && styles.filterChipActive]}
              onPress={() => setStatusFiltro(f)}
            >
              <Text style={[styles.filterText, statusFiltro === f && styles.filterTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {usuarios.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
          </View>
        ) : (
          usuarios.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{u.nome}</Text>
                  <Text style={styles.email}>@{u.usuario || 'usuario'} · {u.email}</Text>
                </View>
                <BadgeStatus status={u.status} />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Nível: <Text style={{ color: SolarTheme.text, fontWeight: '700' }}>{u.perfil}</Text></Text>
                <Text style={styles.metaText}>Usinas: <Text style={{ color: SolarTheme.text, fontWeight: '700' }}>{u.usinasVinculadas.length} vinculada(s)</Text></Text>
              </View>

              <View style={styles.actionRow}>
                <SolarButton
                  title={u.isAtivo ? 'DESATIVAR' : 'ATIVAR'}
                  variant={u.isAtivo ? 'secondary' : 'outline'}
                  onPress={() => handleAlternarStatus(u)}
                  style={{ flex: 1, marginRight: 6 }}
                />
                <SolarButton
                  title="EXCLUIR"
                  variant="danger"
                  onPress={() => handleExcluir(u)}
                  style={{ flex: 1, marginLeft: 6 }}
                />
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
  scrollContent: {
    padding: 20,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: SolarTheme.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: SolarTheme.primary,
  },
  filterText: {
    color: SolarTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    color: SolarTheme.textSecondary,
    fontSize: 14,
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
    marginBottom: 8,
  },
  nome: {
    color: SolarTheme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  email: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  metaText: {
    color: SolarTheme.textSecondary,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
});
