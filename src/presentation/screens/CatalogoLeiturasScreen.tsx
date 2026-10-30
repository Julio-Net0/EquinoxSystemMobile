import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Tipografia } from '@/constants/theme';
import { EnderecoCatalogoDTO } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { formatarKwh } from '@/domain/services/FormatadorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { Cartao } from '@/presentation/components/Cartao';
import { IconeTile } from '@/presentation/components/IconeTile';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { PilulaStatus } from '@/presentation/components/PilulaStatus';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';

export interface CatalogoLeiturasScreenProps {
  enderecos: EnderecoCatalogoDTO[];
  carregando: boolean;
  erro: string | null;
  onRecarregar(): void;
  onAbrirPadrao(padraoId: string): void;
}

/**
 * Escolha do padrão a ler. Mostra a última leitura de cada um, que é a
 * referência do aviso de valor menor — ver o valor anterior antes de digitar
 * evita o erro em vez de só avisar depois.
 */
export function CatalogoLeiturasScreen({
  enderecos,
  carregando,
  erro,
  onRecarregar,
  onAbrirPadrao,
}: CatalogoLeiturasScreenProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.raiz}>
      <CabecalhoTela titulo="Leitura de padrão" subtitulo="Escolha o padrão a registrar" />

      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: bottom + Espaco.xxxl }]}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={onRecarregar} tintColor={Cores.primary} />
        }
      >
        {erro ? (
          <Cartao nivel="baixo">
            <Text style={styles.erro}>{erro}</Text>
          </Cartao>
        ) : null}

        {carregando && enderecos.length === 0 ? (
          <ActivityIndicator color={Cores.primary} style={styles.carregando} />
        ) : enderecos.length === 0 ? (
          <EstadoVazio
            icone="location-off"
            titulo="Nenhum endereço vinculado"
            descricao="Procure um administrador para vincular os endereços da sua conta."
            acao={{ titulo: 'Tentar de novo', onPress: onRecarregar }}
          />
        ) : (
          enderecos.map((endereco) => (
            <View key={endereco.enderecoId} style={styles.grupo}>
              <View style={styles.grupoCabecalho}>
                <Text style={[Tipografia.rotulo, styles.grupoTitulo]} numberOfLines={1}>
                  {endereco.apelido}
                </Text>
                {endereco.ehUsina ? <PilulaStatus texto="Usina" tom="primary" /> : null}
              </View>

              {endereco.padroes.length === 0 ? (
                <Cartao nivel="baixo">
                  <Text style={styles.semPadrao}>
                    Este endereço não tem padrão cadastrado. Procure um administrador.
                  </Text>
                </Cartao>
              ) : (
                endereco.padroes.map((padrao) => (
                  <Cartao key={padrao.padraoId} onPress={() => onAbrirPadrao(padrao.padraoId)}>
                    <View style={styles.padraoLinha}>
                      <IconeTile icone="speed" tamanho={44} />

                      <View style={styles.padraoTextos}>
                        <Text style={[Tipografia.tituloCard, styles.padraoNumero]}>
                          Padrão {padrao.numero}
                        </Text>

                        {padrao.ultimaLeitura ? (
                          <Text style={[Tipografia.meta, styles.padraoMeta]}>
                            Última: {formatarKwh(padrao.ultimaLeitura.valorConsumo)} em{' '}
                            {DataLocal.parse(padrao.ultimaLeitura.dataLocal).paraBr()}
                          </Text>
                        ) : (
                          <Text style={[Tipografia.meta, styles.padraoMeta]}>
                            Nenhuma leitura registrada
                          </Text>
                        )}

                        {padrao.ultimaLeitura?.valorInjecao != null ? (
                          <Text style={[Tipografia.meta, styles.padraoMeta]}>
                            Injeção: {formatarKwh(padrao.ultimaLeitura.valorInjecao)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Cartao>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: {
    paddingHorizontal: Espaco.xl,
    paddingTop: Espaco.xl,
    gap: Espaco.xxl,
  },
  carregando: { marginVertical: Espaco.xxxl },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  grupo: { gap: Espaco.sm },
  grupoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    paddingBottom: Espaco.xs,
    borderBottomWidth: 1,
    borderBottomColor: Overlay.borda,
  },
  grupoTitulo: { color: Cores.onSurfaceVariant, flexShrink: 1 },
  padraoLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  padraoTextos: { flex: 1, gap: 2 },
  padraoNumero: { color: Cores.onSurface },
  padraoMeta: { color: Cores.onSurfaceVariant },
  semPadrao: { ...Tipografia.corpoSm, color: Cores.error },
});
