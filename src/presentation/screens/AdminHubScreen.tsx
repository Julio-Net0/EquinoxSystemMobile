import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SolarTheme } from '@/constants/theme';
import { BadgeStatus } from '@/presentation/components/BadgeStatus';

export const AdminHubScreen: React.FC = () => {
  const router = useRouter();

  // Permissão do usuário logado (ex: Admin ou SuperAdmin)
  const [perfilUsuario] = useState<'Admin' | 'SuperAdmin'>('SuperAdmin');

  const menuItems = [
    {
      id: 'autorizacoes',
      titulo: 'Autorizações Pendentes',
      descricao: 'Aprovar ou recusar solicitações de novos cadastros',
      badge: '3 PENDENTES',
      rota: '/admin/autorizacoes',
      apenasSuperAdmin: false,
    },
    {
      id: 'usuarios',
      titulo: 'Gestão de Usuários',
      descricao: 'Gerenciar permissões, usinas vinculadas e status da equipe',
      rota: '/admin/usuarios',
      apenasSuperAdmin: false,
    },
    {
      id: 'estrutura',
      titulo: 'Estrutura & Padrões',
      descricao: 'Cadastrar e editar Usinas, Endereços e Padrões de medidores',
      rota: '/admin/estrutura',
      apenasSuperAdmin: false,
    },
    {
      id: 'notificacoes',
      titulo: 'Central de Notificações',
      descricao: 'Alertas de leituras atrasadas, conflitos e falhas de integração',
      badge: '2 AVISOS',
      rota: '/admin/notificacoes',
      apenasSuperAdmin: false,
    },
    {
      id: 'empresas',
      titulo: 'Gestão de Empresas (Tenants)',
      descricao: 'Visão Global Multi-Tenant para cadastrar e gerenciar Empresas',
      rota: '/admin/empresas',
      apenasSuperAdmin: true,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PAINEL ADMINISTRATIVO</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Gestão de Acessos & Operação</Text>
          <Text style={styles.bannerSubtitle}>
            Selecione uma das opções abaixo para gerenciar sua empresa e equipe.
          </Text>
          <View style={{ marginTop: 8 }}>
            <BadgeStatus status={perfilUsuario} />
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item) => {
            if (item.apenasSuperAdmin && perfilUsuario !== 'SuperAdmin') return null;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(item.rota as any)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  {item.badge ? (
                    <View style={styles.badgeWrap}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardDesc}>{item.descricao}</Text>
                <Text style={styles.cardLink}>Acessar →</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  banner: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bannerTitle: {
    color: SolarTheme.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
  },
  menuContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: SolarTheme.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: SolarTheme.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  badgeWrap: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 37, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    color: SolarTheme.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  cardDesc: {
    color: SolarTheme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardLink: {
    color: SolarTheme.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
