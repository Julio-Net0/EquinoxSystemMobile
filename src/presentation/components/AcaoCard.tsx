import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Cores, Espaco, Raio, Tipografia } from '@/constants/theme';
import { Cartao } from './Cartao';
import { IconeTile } from './IconeTile';

export interface AcaoCardProps {
  icone: keyof typeof MaterialIcons.glyphMap;
  titulo: string;
  subtitulo: string;
  /** Contador no canto do ícone; oculto quando zero. */
  badge?: number;
  destaque?: boolean;
  onPress(): void;
}

/**
 * Card de ação da tela inicial. Na variante de destaque é o botão grande de
 * "Leitura de padrão", a tarefa central do app.
 */
export function AcaoCard({
  icone,
  titulo,
  subtitulo,
  badge,
  destaque = false,
  onPress,
}: AcaoCardProps) {
  return (
    <Cartao
      nivel={destaque ? 'base' : 'baixo'}
      onPress={onPress}
      destacado={destaque}
      style={destaque ? styles.destaque : undefined}
    >
      <View style={styles.linha}>
        <View>
          <IconeTile icone={icone} tamanho={destaque ? 56 : 48} />

          {badge !== undefined && badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.textos}>
          <Text style={[destaque ? styles.tituloDestaque : Tipografia.tituloCard, styles.titulo]}>
            {titulo}
          </Text>
          <Text style={[Tipografia.corpoSm, styles.subtitulo]} numberOfLines={2}>
            {subtitulo}
          </Text>
        </View>

        <MaterialIcons name="chevron-right" size={24} color={Cores.primary} />
      </View>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  destaque: { borderRadius: Raio.xl, padding: Espaco.xl },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.lg },
  textos: { flex: 1, gap: 2 },
  titulo: { color: Cores.onSurface },
  tituloDestaque: { fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  subtitulo: { color: Cores.onSurfaceVariant },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: Raio.pilula,
    backgroundColor: Cores.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Cores.surface,
  },
  badgeTexto: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
});
