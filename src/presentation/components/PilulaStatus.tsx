import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { PerfilEnum, rotuloDoPerfil } from '@/domain/enums/PerfilEnum';

export type TomPilula = 'primary' | 'erro' | 'sucesso' | 'neutro';

export interface PilulaStatusProps {
  texto: string;
  tom?: TomPilula;
}

const TONS: Record<TomPilula, { fundo: string; borda: string; texto: string }> = {
  primary: { fundo: Overlay.primaryFraco, borda: Overlay.primaryBorda, texto: Cores.primary },
  erro: { fundo: Overlay.errorFraco, borda: Overlay.errorBorda, texto: Cores.error },
  sucesso: { fundo: Overlay.sucessoFraco, borda: Overlay.sucessoBorda, texto: Cores.sucesso },
  neutro: { fundo: Overlay.borda, borda: Overlay.bordaForte, texto: Cores.onSurfaceVariant },
};

export function PilulaStatus({ texto, tom = 'neutro' }: PilulaStatusProps) {
  const cores = TONS[tom];

  return (
    <View style={[styles.base, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
      <Text style={[Tipografia.botaoSm, { color: cores.texto }]}>{texto}</Text>
    </View>
  );
}

/**
 * Mapeamentos explícitos por tipo, em vez de um único mapa de string.
 *
 * O componente anterior casava por texto e caía num âmbar genérico para tudo
 * que não reconhecia — "Técnico", "PENDENTE" e "500 kWp" saíam todos iguais.
 * Com uma função por enum, um status novo quebra a compilação em vez de passar
 * silenciosamente pelo caso padrão.
 */
export function PilulaStatusUsuario({ status }: { status: StatusUsuarioEnum }) {
  const tons: Record<StatusUsuarioEnum, TomPilula> = {
    [StatusUsuarioEnum.ATIVO]: 'sucesso',
    [StatusUsuarioEnum.PENDENTE]: 'primary',
    [StatusUsuarioEnum.RECUSADO]: 'erro',
    [StatusUsuarioEnum.INATIVO]: 'neutro',
  };

  return <PilulaStatus texto={status} tom={tons[status]} />;
}

export function PilulaStatusLeitura({ status }: { status: StatusLeituraEnum }) {
  const rotulos: Record<StatusLeituraEnum, string> = {
    [StatusLeituraEnum.REGISTRADA]: 'Registrada',
    [StatusLeituraEnum.APROVADA]: 'Aprovada',
    [StatusLeituraEnum.SUBSTITUIDA]: 'Substituída',
    [StatusLeituraEnum.DESCARTADA]: 'Descartada',
  };

  const tons: Record<StatusLeituraEnum, TomPilula> = {
    [StatusLeituraEnum.REGISTRADA]: 'primary',
    [StatusLeituraEnum.APROVADA]: 'sucesso',
    [StatusLeituraEnum.SUBSTITUIDA]: 'neutro',
    [StatusLeituraEnum.DESCARTADA]: 'erro',
  };

  return <PilulaStatus texto={rotulos[status]} tom={tons[status]} />;
}

export function PilulaPerfil({ perfil }: { perfil: PerfilEnum }) {
  const tons: Record<PerfilEnum, TomPilula> = {
    [PerfilEnum.SUPER_ADMIN]: 'primary',
    [PerfilEnum.ADMIN]: 'primary',
    [PerfilEnum.TECNICO]: 'neutro',
  };

  return <PilulaStatus texto={rotuloDoPerfil(perfil)} tom={tons[perfil]} />;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: Espaco.sm,
    paddingVertical: 3,
    borderRadius: Raio.pilula,
    borderWidth: 1,
  },
});
