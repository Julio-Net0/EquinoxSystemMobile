import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Tipografia } from '@/constants/theme';
import { formatarKwh } from '@/domain/services/FormatadorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { ConsultarDiagnosticoOutput } from '@/application/use-cases/ConsultarDiagnosticoUseCase';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { PilulaEstadoSync, PilulaStatusLeitura } from '@/presentation/components/PilulaStatus';
import {
  PainelSincronizacao,
  PainelSincronizacaoProps,
  formatarInstante,
} from '@/presentation/components/PainelSincronizacao';
import { ItemDaFilaDTO } from '@/application/use-cases/ConsultarEstadoSincronizacaoUseCase';

export interface DiagnosticoScreenProps {
  dados: ConsultarDiagnosticoOutput | null;
  carregando: boolean;
  erro: string | null;
  onRecarregar(): void;
  onVoltar(): void;
  /** Conexão, fila de envio e última sincronização. */
  sincronizacao?: PainelSincronizacaoProps;
  /** O que está na fila de envio, na ordem em que vai subir. */
  fila?: ItemDaFilaDTO[];
}

const ROTULOS: Record<string, string> = {
  empresas: 'Empresas',
  enderecos: 'Endereços',
  padroes: 'Padrões',
  usuarios: 'Usuários',
  vinculos: 'Vínculos usuário-endereço',
  leituras: 'Leituras',
  notificacoes: 'Notificações',
};

/**
 * Mostra o conteúdo real do banco local.
 *
 * Serve para responder "isto está mesmo sendo salvo no aparelho?" — no Expo Go
 * não dá para extrair o arquivo do SQLite e abrir num visualizador, então a
 * conferência precisa acontecer dentro do app.
 *
 * Mostra também se o arquivo de cada foto existe: a linha no banco e a imagem
 * no disco são coisas separadas, e uma pode estar lá sem a outra.
 *
 * E mostra a sincronização por dentro: se há rede, o que ainda está na fila
 * de envio, quantas vezes cada item foi tentado e por que foi recusado. É a
 * tela que prova, numa demonstração, que a leitura feita offline ficou
 * guardada e depois subiu.
 */
export function DiagnosticoScreen({
  dados,
  carregando,
  erro,
  onRecarregar,
  onVoltar,
  sincronizacao,
  fila = [],
}: DiagnosticoScreenProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo="Diagnóstico"
        subtitulo="O aparelho e a sincronização com a nuvem"
        onVoltar={onVoltar}
      />

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

        {sincronizacao ? (
          <View style={styles.secao}>
            <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Sincronização</Text>

            <PainelSincronizacao {...sincronizacao} />

            <Cartao nivel="baixo">
              <Linha rotulo="Conexão" valor={sincronizacao.online ? 'Online' : 'Offline'} />
              <Linha rotulo="Na fila de envio" valor={String(sincronizacao.pendentes)} />
              <Linha rotulo="Com envio recusado" valor={String(sincronizacao.isolados)} ultima />
            </Cartao>

            {fila.map((item) => (
              <Cartao key={item.itemId} nivel="baixo">
                <View style={styles.leituraTopo}>
                  <Text style={[Tipografia.corpoSm, styles.valor]}>{item.descricao}</Text>
                  <Text style={[Tipografia.meta, item.isolado ? styles.erro : styles.meta]}>
                    {item.isolado
                      ? 'Fora da fila'
                      : item.tentativas === 0
                        ? 'Aguardando'
                        : `${item.tentativas} tentativa(s)`}
                  </Text>
                </View>
                <Text style={[Tipografia.meta, styles.meta]}>
                  Na fila desde {formatarInstante(item.criadoEm)}
                </Text>
                {item.ultimoErro ? (
                  <Text style={[Tipografia.meta, styles.erro]}>{item.ultimoErro}</Text>
                ) : null}
              </Cartao>
            ))}

            <Text style={[Tipografia.meta, styles.ajuda]}>
              Tudo o que você faz é gravado primeiro neste aparelho e entra numa
              fila. Com conexão, a fila sobe em ordem — a foto antes da leitura.
              Falta de rede não conta como tentativa.
            </Text>
          </View>
        ) : null}

        {!dados && carregando ? (
          <ActivityIndicator color={Cores.primary} style={styles.carregando} />
        ) : !dados ? (
          <EstadoVazio
            icone="storage"
            titulo="Sem dados"
            acao={{ titulo: 'Tentar de novo', onPress: onRecarregar }}
          />
        ) : (
          <>
            <View style={styles.secao}>
              <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Banco de dados</Text>

              <Cartao nivel="baixo">
                <Linha rotulo="Arquivo" valor={dados.banco.nomeDoArquivo} />
                <Linha
                  rotulo="Versão do schema"
                  valor={String(dados.banco.versaoDoSchema)}
                  ultima
                />
              </Cartao>

              <Text style={[Tipografia.meta, styles.ajuda]}>
                O arquivo fica na área privada do app. A versão do schema é o
                `PRAGMA user_version`, que diz até que migração o banco foi levado.
              </Text>
            </View>

            <View style={styles.secao}>
              <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Linhas por tabela</Text>

              <Cartao nivel="baixo">
                {Object.entries(dados.banco.contagens).map(([chave, total], indice, lista) => (
                  <Linha
                    key={chave}
                    rotulo={ROTULOS[chave] ?? chave}
                    valor={String(total)}
                    ultima={indice === lista.length - 1}
                  />
                ))}
              </Cartao>
            </View>

            <View style={styles.secao}>
              <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>
                Suas últimas leituras gravadas
              </Text>

              {dados.ultimasLeituras.length === 0 ? (
                <Cartao nivel="baixo">
                  <Text style={[Tipografia.corpoSm, styles.meta]}>
                    Nenhuma leitura sua neste aparelho ainda.
                  </Text>
                </Cartao>
              ) : (
                dados.ultimasLeituras.map((leitura) => (
                  <Cartao key={leitura.leituraId} nivel="baixo">
                    <View style={styles.leituraTopo}>
                      <Text style={[Tipografia.tituloCard, styles.valor]}>
                        {formatarKwh(leitura.valorConsumo)}
                      </Text>
                      <PilulaStatusLeitura status={leitura.status} />
                    </View>

                    <View style={styles.marcas}>
                      <PilulaEstadoSync estado={leitura.estadoSync} />
                    </View>

                    {leitura.valorInjecao !== null ? (
                      <Text style={[Tipografia.meta, styles.meta]}>
                        Injeção: {formatarKwh(leitura.valorInjecao)}
                      </Text>
                    ) : null}

                    <Text style={[Tipografia.meta, styles.meta]}>
                      Dia local: {DataLocal.parse(leitura.dataLocal).paraBr()}
                    </Text>

                    <View style={styles.marcas}>
                      <Marca
                        estado={leitura.fotoExiste}
                        rotulo={
                          leitura.fotoExiste === null
                            ? 'Foto não verificada'
                            : leitura.fotoExiste
                              ? 'Foto no disco'
                              : 'Foto ausente'
                        }
                      />
                      <Marca
                        estado={leitura.fotoRemotaPath !== null}
                        rotulo={leitura.fotoRemotaPath ? 'Foto na nuvem' : 'Foto só no aparelho'}
                      />
                      <Marca
                        estado={leitura.temLocalizacao}
                        rotulo={leitura.temLocalizacao ? 'Com GPS' : 'Sem GPS'}
                      />
                    </View>
                  </Cartao>
                ))
              )}

              <Text style={[Tipografia.meta, styles.ajuda]}>
                As leituras de demonstração vêm sem arquivo de foto, porque não
                passaram pela câmera. As que você registrar aparecem com a foto
                no disco. No navegador a checagem de arquivo não funciona, e a
                marca fica como não verificada.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Linha({
  rotulo,
  valor,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  ultima?: boolean;
}) {
  return (
    <View style={[styles.linha, !ultima && styles.linhaComBorda]}>
      <Text style={[Tipografia.corpoSm, styles.linhaRotulo]}>{rotulo}</Text>
      <Text style={[Tipografia.corpoSm, styles.linhaValor]}>{valor}</Text>
    </View>
  );
}

/** `null` significa "não deu para verificar", e não "não existe". */
function Marca({ estado, rotulo }: { estado: boolean | null; rotulo: string }) {
  const icone = estado === null ? 'help-outline' : estado ? 'check-circle' : 'cancel';
  const cor = estado ? Cores.sucesso : Cores.onSurfaceVariant;

  return (
    <View style={styles.marca}>
      <MaterialIcons name={icone} size={14} color={cor} />
      <Text style={[Tipografia.meta, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: { paddingHorizontal: Espaco.xl, paddingTop: Espaco.xl, gap: Espaco.xxl },
  carregando: { marginVertical: Espaco.xxxl },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  secao: { gap: Espaco.sm },
  secaoTitulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  ajuda: { color: Cores.onSurfaceVariant, lineHeight: 17, marginLeft: Espaco.xs },
  meta: { color: Cores.onSurfaceVariant },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
    paddingVertical: Espaco.sm,
  },
  linhaComBorda: { borderBottomWidth: 1, borderBottomColor: Overlay.borda },
  linhaRotulo: { color: Cores.onSurfaceVariant, flexShrink: 1 },
  linhaValor: { color: Cores.onSurface, fontWeight: '700', fontVariant: ['tabular-nums'] },
  leituraTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.sm,
    marginBottom: Espaco.xs,
  },
  valor: { color: Cores.onSurface, flexShrink: 1 },
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.lg, marginTop: Espaco.sm },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Espaco.xs },
});
