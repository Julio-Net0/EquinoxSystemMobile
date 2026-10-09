import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { SolarTheme } from '@/constants/theme';

interface InputGroupProps extends TextInputProps {
  label: string;
  error?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({ label, error, style, ...rest }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={SolarTheme.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  label: {
    color: SolarTheme.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: SolarTheme.surfaceContainerHigh,
    color: SolarTheme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputError: {
    borderColor: SolarTheme.rose,
  },
  errorText: {
    color: SolarTheme.rose,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});
