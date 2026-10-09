import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';
import { SolarButton } from '@/presentation/components/SolarButton';
import { AutorizarUsuarioUseCase } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

const usuarioRepo = new UsuarioRepositoryMemory();
const usinaRepo = new UsinaRepositoryMemory();
const autorizarUseCase = new AutorizarUsuarioUseCase(usuarioRepo);

interface UsuarioPendenteItem {
  id: string;
  nome: string;
  usuario?: string;
  email: string;
  empresaNome: string;
  nivelSelecionado: PerfilEnum;
  usinasSelecionadas: string[];
}

export const AutorizacoesPendentesScreen: React.FC = () => {
  const router = useRouter();

  const [pendentes, setPendentes] = useState<UsuarioPendenteItem[]>([]);
  const [usinasDisponiveis, setUsinasDisponiveis] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalUsinaUsuarioId, setModalUsinaUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);

    let usinasList = await usinaRepo.listarTodas();
    if (usinasList.length === 0) {
      const u1 = new Usina({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Usina Solar Parque Central',
        codigoUC: 'UC-1001',
        capacidadeNominal: 500,
        coordenadas: new CoordenadasGPS(-15.7941, -47.8822),
        status: StatusUsinaEnum.ATIVA,
      });
      const u2 = new Usina({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Usina Fotovoltaica Norte',
        codigoUC: 'UC-1002',
        capacidadeNominal: 300,
        coordenadas: new CoordenadasGPS(-15.7941, -47.8822),
        status: StatusUsinaEnum.ATIVA,
      });
      await usinaRepo.salvar(u1);
      await usinaRepo.salvar(u2);
      usinasList = [u1, u2];
    }
    setUsinasDisponiveis(usinasList.map((u) => ({ id: u.id.value, nome: `${u.nome} (${u.codigoUC})` })));

    let pendentesList = await usuarioRepo.listarPendentes();
    if (pendentesList.length === 0) {
      const usuario1 = new Usuario({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Carlos Eduardo Santos',
        usuario: 'carlossantos',
        email: 'carlos.santos@empresa.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Pendente',
      });
      const usuario2 = new Usuario({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Fernanda Oliveira',
        usuario: 'foliveira',
        email: 'fernanda@empresa.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Pendente',
      });
      await usuarioRepo.salvar(usuario1);
      await usuarioRepo.salvar(usuario2);
      pendentesList = [usuario1, usuario2];
    }

    setPendentes(
      pendentesList.map((u) => ({
        id: u.id.value,
        nome: u.nome,
        usuario: u.usuario,
        email: u.email,
        empresaNome: 'Solar Tech Brasil',
        nivelSelecionado: u.perfil,
        usinasSelecionadas: [],
      }))
    );
    setLoading(false);
  };

  const alterarNivel = (id: string, nivel: PerfilEnum) => {
    setPendentes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, nivelSelecionado: nivel } : item))
    );
  };

  const toggleUsina = (usuarioId: string, usinaId: string) => {
    setPendentes((prev) =>
      prev.map((item) => {
        if (item.id !== usuarioId) return item;
        const exists = item.usinasSelecionadas.includes(usinaId);
        const nextUsinas = exists
          ? item.usinasSelecionadas.filter((u) => u !== usinaId)
          : [...item.usinasSelecionadas, usinaId];
        return { ...item, usinasSelecionadas: nextUsinas };
      })
    );
  };

  const handleDecisao = async (item: UsuarioPendenteItem, acao: 'autorizar' | 'recusar') => {
    if (acao === 'autorizar' && item.nivelSelecionado !== PerfilEnum.SUPER_ADMIN && item.usinasSelecionadas.length === 0) {
      alert('Selecione ao menos uma usina para vincular ao usuário.');
      return;
    }

    try {
      await autorizarUseCase.execute({
        usuarioId: item.id,
        perfil: item.nivelSelecionado,
        usinasIds: item.usinasSelecionadas,
        acao,
      });

      setPendentes((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      alert(err.message || 'Erro ao processar ação.');
    }
  };

  const usuarioEmModal = pendentes.find((p) => p.id === modalUsinaUsuarioId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBack}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AUTORIZAÇÕES PENDENTES</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {pendentes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum cadastro pendente</Text>
            <Text style={styles.emptyDesc}>Não há solicitações aguardando sua autorização no momento.</Text>
          </View>
        ) : (
          pendentes.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nome}>{u.nome}</Text>
                  <Text style={styles.email}>@{u.usuario || 'usuario'} · {u.email}</Text>
                  <Text style={styles.empresa}>Empresa: <Text style={{ color: SolarTheme.text, fontWeight: '700' }}>{u.empresaNome}</Text></Text>
                </View>
                <BadgeStatus status="PENDENTE" />
              </View>

              <View style={styles.cardForm}>
                <Text style={styles.label}>NÍVEL DE ACESSO</Text>
                <View style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={[styles.roleChip, u.nivelSelecionado === PerfilEnum.TECNICO && styles.roleChipActive]}
                    onPress={() => alterarNivel(u.id, PerfilEnum.TECNICO)}
                  >
                    <Text style={[styles.roleChipText, u.nivelSelecionado === PerfilEnum.TECNICO && styles.roleChipTextActive]}>Técnico</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleChip, u.nivelSelecionado === PerfilEnum.ADMIN && styles.roleChipActive]}
                    onPress={() => alterarNivel(u.id, PerfilEnum.ADMIN)}
                  >
                    <Text style={[styles.roleChipText, u.nivelSelecionado === PerfilEnum.ADMIN && styles.roleChipTextActive]}>Admin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleChip, u.nivelSelecionado === PerfilEnum.SUPER_ADMIN && styles.roleChipActive]}
                    onPress={() => alterarNivel(u.id, PerfilEnum.SUPER_ADMIN)}
                  >
                    <Text style={[styles.roleChipText, u.nivelSelecionado === PerfilEnum.SUPER_ADMIN && styles.roleChipTextActive]}>SuperAdmin</Text>
                  </TouchableOpacity>
                </View>

                {u.nivelSelecionado !== PerfilEnum.SUPER_ADMIN && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.label}>USINAS VINCULADAS ({u.usinasSelecionadas.length})</Text>
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setModalUsinaUsuarioId(u.id)}
                    >
                      <Text style={styles.selectButtonText}>
                        {u.usinasSelecionadas.length > 0
                          ? `${u.usinasSelecionadas.length} usina(s) selecionada(s)`
                          : 'Toque para vincular usinas…'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <SolarButton
                    title="AUTORIZAR"
                    onPress={() => handleDecisao(u, 'autorizar')}
                    style={{ flex: 1, marginRight: 6 }}
                  />
                  <SolarButton
                    title="RECUSAR"
                    variant="danger"
                    onPress={() => handleDecisao(u, 'recusar')}
                    style={{ flex: 1, marginLeft: 6 }}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de Seleção de Usinas */}
      <Modal visible={modalUsinaUsuarioId !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vincular Usinas</Text>
            <FlatList
              data={usinasDisponiveis}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = usuarioEmModal?.usinasSelecionadas.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.usinaItem}
                    onPress={() => modalUsinaUsuarioId && toggleUsina(modalUsinaUsuarioId, item.id)}
                  >
                    <Text style={[styles.usinaName, isSelected && { color: SolarTheme.primary, fontWeight: '800' }]}>
                      {isSelected ? '✓ ' : '○ '} {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 300, marginVertical: 10 }}
            />
            <SolarButton title="CONCLUÍDO" onPress={() => setModalUsinaUsuarioId(null)} />
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
    textAlign: 'center',
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
  empresa: {
    color: SolarTheme.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  cardForm: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  label: {
    color: SolarTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: SolarTheme.surfaceContainerHigh,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleChipActive: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    borderColor: SolarTheme.primary,
  },
  roleChipText: {
    color: SolarTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  roleChipTextActive: {
    color: SolarTheme.primary,
    fontWeight: '800',
  },
  selectButton: {
    backgroundColor: SolarTheme.surfaceContainerHigh,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectButtonText: {
    color: SolarTheme.text,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
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
  usinaItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  usinaName: {
    color: SolarTheme.text,
    fontSize: 14,
  },
});
