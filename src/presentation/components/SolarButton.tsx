import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SolarTheme } from '@/constants/theme';

interface SolarButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
}

export const SolarButton: React.FC<SolarButtonProps> = ({
  title,
  loading = false,
  variant = 'primary',
  disabled,
  style,
  ...rest
}) => {
  const isBusy = loading || disabled;

  let btnStyle: ViewStyle = styles.primaryBtn;
  let textStyle: TextStyle = styles.primaryText;

  if (variant === 'secondary') {
    btnStyle = styles.secondaryBtn;
    textStyle = styles.secondaryText;
  } else if (variant === 'danger') {
    btnStyle = styles.dangerBtn;
    textStyle = styles.dangerText;
  } else if (variant === 'outline') {
    btnStyle = styles.outlineBtn;
    textStyle = styles.outlineText;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isBusy}
      style={[styles.baseBtn, btnStyle, isBusy && styles.disabledBtn, style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#000000' : SolarTheme.primary} />
      ) : (
        <Text style={[styles.baseText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  primaryBtn: {
    backgroundColor: SolarTheme.primary,
  },
  primaryText: {
    color: '#000000',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    backgroundColor: SolarTheme.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryText: {
    color: SolarTheme.text,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dangerText: {
    color: SolarTheme.rose,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SolarTheme.primary,
  },
  outlineText: {
    color: SolarTheme.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  baseText: {
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
