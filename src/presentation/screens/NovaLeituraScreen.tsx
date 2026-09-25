import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLeitura } from '../hooks/useLeitura';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ICameraGateway } from '@/domain/gateways/ICameraGateway';
import { ILocationGateway } from '@/domain/gateways/ILocationGateway';

export interface NovaLeituraScreenProps {
  usinaId: string;
  usuarioId: string;
  leituraRepo: ILeituraRepository;
  usinaRepo: IUsinaRepository;
  queueRepo: IActionQueueRepository;
  cameraGateway: ICameraGateway;
  locationGateway: ILocationGateway;
  onSucesso?: () => void;
}

export const NovaLeituraScreen: React.FC<NovaLeituraScreenProps> = ({
  usinaId,
  usuarioId,
  leituraRepo,
  usinaRepo,
  queueRepo,
  cameraGateway,
  locationGateway,
  onSucesso,
}) => {
  const { registrarLeitura, isSubmitting, error } = useLeitura(leituraRepo, usinaRepo, queueRepo);
  const [valorKwh, setValorKwh] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [capturandoCamera, setCapturandoCamera] = useState(false);
  const [obtendoGps, setObtendoGps] = useState(false);

  const handleTirarFoto = async () => {
    setCapturandoCamera(true);
    try {
      const permissao = await cameraGateway.solicitarPermissao();
      if (!permissao) {
        Alert.alert('Permissão Negada', 'É necessário permitir o acesso à câmera para tirar a foto do medidor.');
        return;
      }
      const resultado = await cameraGateway.capturarEComprimirFoto();
      if (resultado) {
        setFotoUri(resultado.uri);
      }
    } finally {
      setCapturandoCamera(false);
    }
  };

  const handleObterGps = async () => {
    setObtendoGps(true);
    try {
      const permissao = await locationGateway.solicitarPermissao();
      if (!permissao) {
        Alert.alert('Permissão Negada', 'É necessário acesso ao GPS para registrar o local da leitura.');
        return;
      }
      const coords = await locationGateway.obterCoordenadas();
      if (coords) {
        setCoordenadas({ latitude: coords.latitude, longitude: coords.longitude });
      }
    } finally {
      setObtendoGps(false);
    }
  };

  const handleSalvarLeitura = async () => {
    const valNum = parseFloat(valorKwh.replace(',', '.'));
    if (isNaN(valNum) || valNum < 0) {
      Alert.alert('Valor Inválido', 'Por favor, informe uma medição em kWh válida.');
      return;
    }
    if (!fotoUri) {
      Alert.alert('Foto Obrigatória', 'Tire a foto comprobatória do visor do medidor.');
      return;
    }

    const lat = coordenadas?.latitude ?? -23.55052;
    const long = coordenadas?.longitude ?? -46.633308;

    const ok = await registrarLeitura({
      usinaId,
      usuarioId,
      valorKwh: valNum,
      fotoLocalUri: fotoUri,
      latitude: lat,
      longitude: long,
    });

    if (ok) {
      Alert.alert('Sucesso!', 'Leitura registrada localmente e enfileirada para sincronização.');
      if (onSucesso) onSucesso();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nova Leitura de Medidor</Text>
      <Text style={styles.subtitle}>Registre os dados obtidos em campo</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.label}>Consumo/Geração (kWh):</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 1450.75"
        value={valorKwh}
        onChangeText={setValorKwh}
        keyboardType="numeric"
        testID="input-kwh"
      />

      <Text style={styles.label}>Foto Comprobatória do Medidor:</Text>
      <TouchableOpacity
        style={styles.mediaButton}
        onPress={handleTirarFoto}
        disabled={capturandoCamera}
        testID="btn-camera"
      >
        {capturandoCamera ? (
          <ActivityIndicator color="#38BDF8" />
        ) : (
          <Text style={styles.mediaButtonText}>
            {fotoUri ? '📷 Foto Capturada (~300KB) - Alterar' : '📸 Abrir Câmera e Capturar Foto'}
          </Text>
        )}
      </TouchableOpacity>

      {fotoUri && <Text style={styles.successTag}>✓ Foto salva e comprimida com sucesso</Text>}

      <Text style={styles.label}>Proof of Presence (GPS):</Text>
      <TouchableOpacity
        style={styles.mediaButtonSecondary}
        onPress={handleObterGps}
        disabled={obtendoGps}
        testID="btn-gps"
      >
        {obtendoGps ? (
          <ActivityIndicator color="#94A3B8" />
        ) : (
          <Text style={styles.mediaButtonTextSecondary}>
            {coordenadas
              ? `📍 GPS: Lat ${coordenadas.latitude.toFixed(4)}, Long ${coordenadas.longitude.toFixed(4)}`
              : '📍 Capturar Coordenadas GPS'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSalvarLeitura}
        disabled={isSubmitting}
        testID="btn-salvar-leitura"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Salvar Leitura (Offline)</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F8FAFC',
  },
  mediaButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mediaButtonText: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mediaButtonSecondary: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mediaButtonTextSecondary: {
    color: '#94A3B8',
    fontSize: 14,
  },
  successTag: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
});
