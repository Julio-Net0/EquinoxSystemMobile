import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SolarTheme } from '@/constants/theme';

interface BadgeStatusProps {
  status: string;
}

export const BadgeStatus: React.FC<BadgeStatusProps> = ({ status }) => {
  let badgeBg: string = 'rgba(245, 158, 11, 0.15)';
  let badgeBorder: string = 'rgba(245, 158, 11, 0.4)';
  let badgeText: string = SolarTheme.amber;

  const normalized = status.toLowerCase();

  if (normalized === 'ativo' || normalized === 'sincronizada' || normalized === 'operacional') {
    badgeBg = 'rgba(16, 185, 129, 0.15)';
    badgeBorder = 'rgba(16, 185, 129, 0.4)';
    badgeText = SolarTheme.emerald;
  } else if (normalized === 'recusado' || normalized === 'inativo' || normalized === 'erro') {
    badgeBg = 'rgba(239, 68, 68, 0.15)';
    badgeBorder = 'rgba(239, 68, 68, 0.4)';
    badgeText = SolarTheme.rose;
  } else if (normalized === 'superadmin' || normalized === 'admin') {
    badgeBg = 'rgba(99, 102, 241, 0.15)';
    badgeBorder = 'rgba(99, 102, 241, 0.4)';
    badgeText = SolarTheme.indigo;
  }

  return (
    <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
      <Text style={[styles.text, { color: badgeText }]}>{status.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
