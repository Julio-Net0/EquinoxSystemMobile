import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import { formatarKwh } from '@/domain/services/FormatadorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { EnderecoCatalogoDTO, PadraoCatalogoDTO } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { SituacaoGps } from '@/presentation/hooks/useNovaLeitura';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { CampoNumerico } from '@/presentation/components/CampoNumerico';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { IconeTile } from '@/presentation/components/IconeTile';
import { ModalShell } from '@/presentation/components/ModalShell';
import { PilulaStatus } from '@/presentation/components/PilulaStatus';
import { SolarButton } from '@/presentation/components/SolarButton';

export interface NovaLeituraScreenProps {
  carregando: boolean;
  erro: string | null;
  endereco: EnderecoCatalogoDTO | null;
  padrao: PadraoCatalogoDTO | null;

  consumo: string;
  injecao: string;
  onConsumo(valor: string): void;
  onInjecao(valor: string): void;

  fotoUri: string | null;
  onAbrirCamera(): void;

  gps: SituacaoGps;
  onTentarGps(): void;

  salvando: boolean;
  avisoValorMenor: string | null;
  sucesso: boolean;
  onSalvar(): void;
  onConfirmarValorMenor(): void;
  onCancelarAviso(): void;

  onVoltar(): void;
  onConcluir(): void;
}

const ROTULO_GPS: Record<SituacaoGps, string> = {
  buscando: 'Obtendo localização…',
  obtido: 'Localização obtida',
  indisponivel: 'Sem localização',
};

/**
 * Registro da leitura, portada de
 * example/Equinox.MOBILE/src/pages/leituraPadrao.ts, com as duas features que o
 * app antigo não tinha: foto do medidor e GPS.
 *
 * A foto é obrigatória; o GPS não. Casa de medidor costuma ser lugar sem sinal,
 * e travar a leitura por isso deixaria o técnico sem saída no local.
 */
export function NovaLeituraScreen(props: NovaLeituraScreenProps) {
  const { bottom } = useSafeAreaInsets();
  const {
    carregando, erro, endereco, padrao,
    consumo, injecao, onConsumo, onInjecao,
    fotoUri, onAbrirCamera,
    gps, onTentarGps,
    salvando, avisoValorMenor, sucesso,
    onSalvar, onConfirmarValorMenor, onCancelarAviso,
    onVoltar, onConcluir,
  } = props;

  if (carregando) {
    return (
      <View style={styles.raiz}>
        <CabecalhoTela titulo="Leitura de padrão" onVoltar={onVoltar} />
        <ActivityIndicator color={Cores.primary} style={styles.carregando} />
      </View>
    );
  }

  if (!endereco || !padrao) {
    return (
      <View style={styles.raiz}>
        <CabecalhoTela titulo="Leitura de padrão" onVoltar={onVoltar} />
        <EstadoVazio
          icone="error-outline"
          titulo="Padrão não encontrado"
          descricao={erro ?? 'Este padrão não está entre os seus endereços.'}
          acao={{ titulo: 'Voltar', onPress: onVoltar }}
        />
      </View>
    );
  }

  if (sucesso) {
    return (
      <View style={styles.raiz}>
        <View style={styles.sucesso}>
          <IconeTile icone="task-alt" tamanho={80} tom="sucesso" />
          <Text style={[Tipografia.titulo, styles.sucessoTitulo]}>Leitura registrada!</Text>
          <Text style={[Tipografia.corpoSm, styles.sucessoTexto]}>
            {formatarKwh(Number(consumo.replace(',', '.')))} no padrão {padrao.numero}.
            {'\n'}Salva no aparelho.
          </Text>
          <View style={styles.sucessoAcao}>
            <SolarButton titulo="Voltar ao início" onPress={onConcluir} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo={`Padrão ${padrao.numero}`}
        subtitulo={endereco.apelido}
        onVoltar={onVoltar}
      />

      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Cartao nivel="baixo">
            <View style={styles.contextoLinha}>
              <IconeTile icone={endereco.ehUsina ? 'solar-power' : 'location-on'} tamanho={44} />
              <View style={styles.contextoTextos}>
                <View style={styles.contextoCabecalho}>
                  <Text style={[Tipografia.tituloCard, styles.contextoTitulo]} numberOfLines={1}>
                    {endereco.apelido}
                  </Text>
                  {endereco.ehUsina ? <PilulaStatus texto="Usina" tom="primary" /> : null}
                </View>
                <Text style={[Tipografia.meta, styles.contextoMeta]}>UC {endereco.uc}</Text>
                {padrao.ultimaLeitura ? (
                  <Text style={[Tipografia.meta, styles.contextoMeta]}>
                    Última: {formatarKwh(padrao.ultimaLeitura.valorConsumo)} em{' '}
                    {DataLocal.parse(padrao.ultimaLeitura.dataLocal).paraBr()}
                  </Text>
                ) : (
                  <Text style={[Tipografia.meta, styles.contextoMeta]}>
                    Primeira leitura deste padrão
                  </Text>
                )}
              </View>
            </View>
          </Cartao>

          <CampoNumerico
            rotulo="Consumo (003)"
            valor={consumo}
            onChangeValor={onConsumo}
            placeholder="Ex.: 12345"
            ajuda={
              padrao.ultimaLeitura
                ? `Anterior: ${formatarKwh(padrao.ultimaLeitura.valorConsumo)}`
                : undefined
            }
          />

          {endereco.ehUsina ? (
            <CampoNumerico
              rotulo="Injeção (103)"
              valor={injecao}
              onChangeValor={onInjecao}
              placeholder="Ex.: 8421"
              ajuda={
                padrao.ultimaLeitura?.valorInjecao != null
                  ? `Anterior: ${formatarKwh(padrao.ultimaLeitura.valorInjecao)}`
                  : 'Obrigatória neste endereço, que é usina'
              }
            />
          ) : null}

          <View style={styles.secao}>
            <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Foto do medidor</Text>

            {fotoUri ? (
              <Pressable onPress={onAbrirCamera} style={styles.fotoCaixa}>
                <Image source={{ uri: fotoUri }} style={styles.foto} resizeMode="cover" />
                <View style={styles.fotoSobre}>
                  <MaterialIcons name="refresh" size={18} color={Cores.onSurface} />
                  <Text style={[Tipografia.botaoSm, styles.fotoSobreTexto]}>Tirar de novo</Text>
                </View>
              </Pressable>
            ) : (
              <SolarButton
                titulo="Abrir câmera"
                variante="secundario"
                icone="photo-camera"
                onPress={onAbrirCamera}
              />
            )}

            <Text style={[Tipografia.meta, styles.ajuda]}>
              A foto é o comprovante do valor e é obrigatória.
            </Text>
          </View>

          <View style={styles.secao}>
            <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Localização</Text>

            <Pressable
              onPress={gps === 'indisponivel' ? onTentarGps : undefined}
              style={styles.gpsLinha}
            >
              {gps === 'buscando' ? (
                <ActivityIndicator color={Cores.primary} size="small" />
              ) : (
                <MaterialIcons
                  name={gps === 'obtido' ? 'gps-fixed' : 'gps-off'}
                  size={20}
                  color={gps === 'obtido' ? Cores.sucesso : Cores.onSurfaceVariant}
                />
              )}

              <Text style={[Tipografia.corpoSm, styles.gpsTexto]}>{ROTULO_GPS[gps]}</Text>

              {gps === 'indisponivel' ? (
                <Text style={[Tipografia.botaoSm, styles.gpsTentar]}>Tentar</Text>
              ) : null}
            </Pressable>

            {gps === 'indisponivel' ? (
              <Text style={[Tipografia.meta, styles.ajuda]}>
                A leitura pode ser registrada sem localização. O administrador recebe um aviso.
              </Text>
            ) : null}

            {!endereco.temGeocerca ? (
              <Text style={[Tipografia.meta, styles.ajuda]}>
                Este endereço não tem coordenada cadastrada, então a distância não é conferida.
              </Text>
            ) : null}
          </View>

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <SolarButton
            titulo="Registrar leitura"
            carregando={salvando}
            onPress={onSalvar}
            testID="botao-registrar"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalShell
        visivel={avisoValorMenor !== null}
        icone="trending-down"
        titulo="Confira o valor"
        subtitulo={avisoValorMenor ?? undefined}
        confirmarLabel="Está certo, salvar"
        cancelarLabel="Corrigir"
        confirmando={salvando}
        onConfirmar={onConfirmarValorMenor}
        onFechar={onCancelarAviso}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.xxl },
  carregando: { marginTop: Espaco.xxxl },

  contextoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.md },
  contextoTextos: { flex: 1, gap: 2 },
  contextoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  contextoTitulo: { color: Cores.onSurface, flexShrink: 1 },
  contextoMeta: { color: Cores.onSurfaceVariant },

  secao: { gap: Espaco.sm },
  secaoTitulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  ajuda: { color: Cores.onSurfaceVariant, marginLeft: Espaco.xs, lineHeight: 17 },

  fotoCaixa: {
    borderRadius: Raio.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Overlay.primaryBorda,
  },
  foto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Cores.surfaceContainer },
  fotoSobre: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.sm,
    paddingVertical: Espaco.sm,
    backgroundColor: Overlay.modal,
  },
  fotoSobreTexto: { color: Cores.onSurface },

  gpsLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
    minHeight: 44,
    paddingHorizontal: Espaco.lg,
    borderRadius: Raio.md,
    borderWidth: 1,
    borderColor: Overlay.borda,
    backgroundColor: Cores.surfaceContainerLow,
  },
  gpsTexto: { flex: 1, color: Cores.onSurface },
  gpsTentar: { color: Cores.primary },

  erro: { ...Tipografia.corpoSm, color: Cores.error, textAlign: 'center' },

  sucesso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.xxl,
    gap: Espaco.md,
  },
  sucessoTitulo: { color: Cores.onSurface, marginTop: Espaco.lg },
  sucessoTexto: { color: Cores.onSurfaceVariant, textAlign: 'center', lineHeight: 21 },
  sucessoAcao: { alignSelf: 'stretch', marginTop: Espaco.xxl },
});
