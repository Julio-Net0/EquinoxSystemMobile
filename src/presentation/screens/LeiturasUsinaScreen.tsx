import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Raio, Tipografia } from '@/constants/theme';
import {
  MedidorDiaDTO,
  ResumoLeiturasDiaDTO,
  UsinaItemDTO,
} from '@/application/use-cases/ConsultarLeiturasDiaUsinaUseCase';
import { formatarKwh } from '@/domain/services/FormatadorKwh';
import { CabecalhoTela } from '@/presentation/components/CabecalhoTela';
import { Cartao } from '@/presentation/components/Cartao';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { IconeTile } from '@/presentation/components/IconeTile';
import { PilulaStatus, PilulaStatusLeitura } from '@/presentation/components/PilulaStatus';

export interface LeiturasUsinaScreenProps {
  usinas: UsinaItemDTO[];
  usinaSelecionada: UsinaItemDTO | null;
  dataLocal: string;
  dataLocalFormatada: string;
  diasComLeitura: string[];
  resumo: ResumoLeiturasDiaDTO;
  medidores: MedidorDiaDTO[];
  carregando: boolean;
  erro: string | null;
  onSelecionarUsina(usinaId: string): void;
  onDesmarcarUsina?(): void;
  onMudarData?(dataLocal: string): void;
  onDiaAnterior(): void;
  onDiaSeguinte(): void;
  onRecarregar(): void;
  onVoltar(): void;
  /** Abre o comprovante de uma leitura. */
  onVerFoto?(leituraId: string): void;
}

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function LeiturasUsinaScreen({
  usinas,
  usinaSelecionada,
  dataLocal,
  dataLocalFormatada,
  diasComLeitura,
  resumo,
  medidores,
  carregando,
  erro,
  onSelecionarUsina,
  onDesmarcarUsina,
  onMudarData,
  onDiaAnterior,
  onDiaSeguinte,
  onRecarregar,
  onVoltar,
  onVerFoto,
}: LeiturasUsinaScreenProps) {
  const { bottom, top } = useSafeAreaInsets();
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);

  // Ano e Mês exibidos no calendário
  const [anoCalendario, setAnoCalendario] = useState<number>(() => {
    if (dataLocal) {
      const a = Number(dataLocal.split('-')[0]);
      if (Number.isFinite(a)) return a;
    }
    return new Date().getFullYear();
  });

  const [mesCalendario, setMesCalendario] = useState<number>(() => {
    if (dataLocal) {
      const m = Number(dataLocal.split('-')[1]);
      if (Number.isFinite(m)) return m;
    }
    return new Date().getMonth() + 1;
  });

  const alternarExpansao = (padraoId: string) => {
    setExpandidos((prev) => ({
      ...prev,
      [padraoId]: !prev[padraoId],
    }));
  };

  const abrirCalendario = () => {
    if (dataLocal) {
      const [anoStr, mesStr] = dataLocal.split('-');
      setAnoCalendario(Number(anoStr));
      setMesCalendario(Number(mesStr));
    }
    setModalCalendarioAberto(true);
  };

  const mesAnterior = () => {
    if (mesCalendario === 1) {
      setMesCalendario(12);
      setAnoCalendario((a) => a - 1);
    } else {
      setMesCalendario((m) => m - 1);
    }
  };

  const mesSeguinte = () => {
    if (mesCalendario === 12) {
      setMesCalendario(1);
      setAnoCalendario((a) => a + 1);
    } else {
      setMesCalendario((m) => m + 1);
    }
  };

  const selecionarDiaDoCalendario = (diaNumero: number) => {
    const mesStr = String(mesCalendario).padStart(2, '0');
    const diaStr = String(diaNumero).padStart(2, '0');
    const novaDataIso = `${anoCalendario}-${mesStr}-${diaStr}`;
    setModalCalendarioAberto(false);
    if (onMudarData) {
      onMudarData(novaDataIso);
    }
  };

  // Grade de dias do mês para o calendário
  const gradeDias = useMemo(() => {
    const totalDiasNoMes = new Date(Date.UTC(anoCalendario, mesCalendario, 0)).getUTCDate();
    const diaSemanaInicio = new Date(Date.UTC(anoCalendario, mesCalendario - 1, 1)).getUTCDay();

    const vaziosIniciais = Array.from({ length: diaSemanaInicio }, (_, i) => i);
    const dias = Array.from({ length: totalDiasNoMes }, (_, i) => i + 1);

    return { vaziosIniciais, dias };
  }, [anoCalendario, mesCalendario]);

  // Se o usuário ainda não escolheu uma usina e existem várias disponíveis
  const mostrandoListaUsinas = usinaSelecionada === null && usinas.length > 1;

  if (mostrandoListaUsinas) {
    return (
      <View style={styles.raiz}>
        <CabecalhoTela
          titulo="Leituras da usina"
          subtitulo="Selecione a usina para ver as medições"
          onVoltar={onVoltar}
          acao={
            <Pressable
              onPress={onRecarregar}
              hitSlop={Espaco.sm}
              accessibilityRole="button"
              accessibilityLabel="Recarregar"
            >
              <MaterialIcons name="refresh" size={22} color={Cores.onSurface} />
            </Pressable>
          }
        />

        {erro ? (
          <View style={styles.blocoErro}>
            <Cartao nivel="baixo">
              <Text style={styles.erroTexto}>{erro}</Text>
            </Cartao>
          </View>
        ) : null}

        <FlatList
          data={usinas}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.conteudoLista, { paddingBottom: bottom + Espaco.xxxl }]}
          refreshControl={
            <RefreshControl
              refreshing={carregando}
              onRefresh={onRecarregar}
              tintColor={Cores.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.topoListaUsinas}>
              <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>
                Usinas disponíveis ({usinas.length})
              </Text>
              <Text style={[Tipografia.corpoSm, styles.subtituloEscolha]}>
                Toque em uma usina para abrir automaticamente as leituras de hoje.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.itemUsinaCard}>
              <Cartao onPress={() => onSelecionarUsina(item.id)}>
                <View style={styles.usinaLinha}>
                  <IconeTile icone="solar-power" tamanho={48} />
                  <View style={styles.usinaDetalhes}>
                    <View style={styles.usinaTopoCard}>
                      <Text style={[Tipografia.tituloCard, styles.usinaNome]} numberOfLines={1}>
                        {item.apelido}
                      </Text>
                      <PilulaStatus texto="Usina" tom="primary" />
                    </View>
                    <Text style={[Tipografia.meta, styles.usinaMeta]}>
                      UC {item.uc} · {item.empresaNome}
                    </Text>
                    {item.logradouro ? (
                      <Text style={[Tipografia.meta, styles.usinaEndereco]} numberOfLines={1}>
                        {item.logradouro}
                      </Text>
                    ) : null}
                    <Text style={[Tipografia.meta, styles.usinaMedidoresContador]}>
                      {item.totalMedidores === 1 ? '1 medidor' : `${item.totalMedidores} medidores`}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={Cores.onSurfaceVariant} />
                </View>
              </Cartao>
            </View>
          )}
        />
      </View>
    );
  }

  // Visualização Detalhada da Usina no Dia Selecionado
  const renderCabecalhoDetalhe = () => (
    <View style={styles.topoConteudo}>
      {/* Card da Usina com opção de Trocar Usina se houver mais de uma */}
      {usinaSelecionada ? (
        <Cartao nivel="baixo">
          <View style={styles.usinaCardLinha}>
            <IconeTile icone="solar-power" tamanho={48} />
            <View style={styles.usinaCardTextos}>
              <View style={styles.usinaCardTituloLinha}>
                <Text style={[Tipografia.tituloCard, styles.usinaApelido]} numberOfLines={1}>
                  {usinaSelecionada.apelido}
                </Text>
                {usinas.length > 1 && onDesmarcarUsina ? (
                  <Pressable
                    onPress={onDesmarcarUsina}
                    accessibilityRole="button"
                    accessibilityLabel="Trocar usina"
                    style={styles.botaoTrocarUsina}
                  >
                    <MaterialIcons name="swap-horiz" size={16} color={Cores.primary} />
                    <Text style={styles.botaoTrocarUsinaTexto}>Trocar</Text>
                  </Pressable>
                ) : (
                  <PilulaStatus texto="Usina" tom="primary" />
                )}
              </View>
              <Text style={[Tipografia.meta, styles.usinaMeta]}>
                UC {usinaSelecionada.uc} · {usinaSelecionada.empresaNome}
              </Text>
              {usinaSelecionada.logradouro ? (
                <Text style={[Tipografia.meta, styles.usinaEndereco]} numberOfLines={1}>
                  {usinaSelecionada.logradouro}
                </Text>
              ) : null}
            </View>
          </View>
        </Cartao>
      ) : null}

      {/* Navegador de Data & Botão de Calendário Mensal */}
      <View style={styles.navegadorData}>
        <Pressable
          onPress={onDiaAnterior}
          hitSlop={Espaco.sm}
          accessibilityRole="button"
          accessibilityLabel="Dia anterior"
          style={styles.botaoNavegacaoData}
        >
          <MaterialIcons name="chevron-left" size={28} color={Cores.primary} />
        </Pressable>

        <Pressable
          onPress={abrirCalendario}
          accessibilityRole="button"
          accessibilityLabel="Abrir calendário mensal"
          style={styles.dataCentral}
        >
          <MaterialIcons name="calendar-month" size={20} color={Cores.primary} style={styles.iconeCalendario} />
          <Text style={[Tipografia.tituloCard, styles.dataTexto]}>{dataLocalFormatada}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={Cores.onSurfaceVariant} />
        </Pressable>

        <Pressable
          onPress={onDiaSeguinte}
          hitSlop={Espaco.sm}
          accessibilityRole="button"
          accessibilityLabel="Dia seguinte"
          style={styles.botaoNavegacaoData}
        >
          <MaterialIcons name="chevron-right" size={28} color={Cores.primary} />
        </Pressable>
      </View>

      {/* Métricas e Resumo do Dia */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={[Tipografia.rotulo, styles.kpiLabel]}>Medidores lidos</Text>
          <Text style={[Tipografia.titulo, styles.kpiValor]}>
            {resumo.medidoresComLeitura}
            <Text style={styles.kpiTotal}> / {resumo.totalMedidores}</Text>
          </Text>
        </View>

        <View style={[styles.kpiCard, resumo.totalSubstituicoes > 0 && styles.kpiCardDestaque]}>
          <Text style={[Tipografia.rotulo, styles.kpiLabel]}>Substituições</Text>
          <Text
            style={[
              Tipografia.titulo,
              styles.kpiValor,
              resumo.totalSubstituicoes > 0 && styles.kpiValorAmbar,
            ]}
          >
            {resumo.totalSubstituicoes}
          </Text>
        </View>

        <View style={[styles.kpiCard, resumo.totalAlertas > 0 && styles.kpiCardAlerta]}>
          <Text style={[Tipografia.rotulo, styles.kpiLabel]}>Alertas</Text>
          <Text
            style={[
              Tipografia.titulo,
              styles.kpiValor,
              resumo.totalAlertas > 0 && styles.kpiValorErro,
            ]}
          >
            {resumo.totalAlertas}
          </Text>
        </View>
      </View>

      <View style={styles.divisoriaSecao}>
        <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>
          Medidores da usina ({medidores.length})
        </Text>
      </View>
    </View>
  );

  const renderItemMedidor = ({ item }: { item: MedidorDiaDTO }) => {
    const expandido = !!expandidos[item.padraoId];

    return (
      <View style={styles.itemMedidor}>
        <Cartao>
          {/* Cabeçalho do Medidor */}
          <View style={styles.medidorCabecalho}>
            <View style={styles.medidorIdentificacao}>
              <IconeTile icone="speed" tamanho={40} />
              <View style={styles.medidorInfo}>
                <Text style={[Tipografia.tituloCard, styles.medidorNumero]}>
                  Padrão {item.numero}
                </Text>
                <Text style={[Tipografia.meta, styles.medidorSubtexto]}>
                  {item.teveLeitura ? 'Leitura realizada no dia' : 'Pendente de leitura'}
                </Text>
              </View>
            </View>

            {item.teveLeitura && item.leituraVigente ? (
              <PilulaStatusLeitura status={item.leituraVigente.status} />
            ) : (
              <PilulaStatus texto="Sem leitura" tom="neutro" />
            )}
          </View>

          {/* Dados da Leitura Vigente */}
          {item.teveLeitura && item.leituraVigente ? (
            <View style={styles.blocoLeituraVigente}>
              <View style={styles.valoresGrid}>
                <View style={styles.caixaValor}>
                  <Text style={[Tipografia.rotulo, styles.valorRotulo]}>Consumo (003)</Text>
                  <Text style={[Tipografia.tituloCard, styles.valorConsumo]}>
                    {formatarKwh(item.leituraVigente.valorConsumo)}
                  </Text>
                </View>

                {item.leituraVigente.valorInjecao !== null ? (
                  <View style={styles.caixaValor}>
                    <Text style={[Tipografia.rotulo, styles.valorRotulo]}>Injeção (103)</Text>
                    <Text style={[Tipografia.tituloCard, styles.valorInjecao]}>
                      {formatarKwh(item.leituraVigente.valorInjecao)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.rodapeLeitura}>
                <View style={styles.rodapeAutorLinha}>
                  <MaterialIcons name="schedule" size={14} color={Cores.onSurfaceVariant} />
                  <Text style={[Tipografia.meta, styles.rodapeTexto]}>
                    Medido às {item.leituraVigente.horaFormatada} por {item.leituraVigente.autorNome}
                  </Text>
                </View>

                <View style={styles.badgesLinha}>
                  {item.leituraVigente.temLocalizacao ? (
                    <View style={styles.tagHardware}>
                      <MaterialIcons name="gps-fixed" size={12} color={Cores.sucesso} />
                      <Text style={[Tipografia.meta, styles.tagTexto]}>GPS OK</Text>
                    </View>
                  ) : (
                    <View style={styles.tagHardware}>
                      <MaterialIcons name="gps-off" size={12} color={Cores.onSurfaceVariant} />
                      <Text style={[Tipografia.meta, styles.tagTexto]}>Sem GPS</Text>
                    </View>
                  )}

                  <Pressable
                    style={styles.tagHardware}
                    onPress={() => onVerFoto?.(item.leituraVigente!.id)}
                    disabled={!onVerFoto}
                    accessibilityRole="button"
                    accessibilityLabel="Ver o comprovante da leitura"
                    testID={`ver-foto-${item.leituraVigente.id}`}
                  >
                    <MaterialIcons name="photo-camera" size={12} color={Cores.primary} />
                    <Text style={[Tipografia.meta, styles.tagTexto]}>Ver foto</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.semLeituraBloco}>
              <Text style={[Tipografia.corpoSm, styles.semLeituraTexto]}>
                Nenhuma leitura registrada para este medidor na data selecionada.
              </Text>
              {item.referenciaHistorico ? (
                <Text style={[Tipografia.meta, styles.referenciaHistoricaTexto]}>
                  Última leitura conhecida: {formatarKwh(item.referenciaHistorico.valorConsumo)} (em{' '}
                  {item.referenciaHistorico.dataLocal.split('-').reverse().join('/')})
                </Text>
              ) : null}
            </View>
          )}

          {/* ALERTA: Leitura Fora do Padrão do Histórico */}
          {item.alertaForaPadrao ? (
            <View style={styles.containerAlertaHistorico}>
              <View style={styles.alertaTopoLinha}>
                <MaterialIcons name="warning-amber" size={18} color={Cores.primary} />
                <Text style={[Tipografia.rotulo, styles.alertaTitulo]}>
                  Leitura fora do padrão do histórico
                </Text>
              </View>
              <Text style={[Tipografia.corpoSm, styles.alertaDescricao]}>
                {item.alertaForaPadrao}
              </Text>
            </View>
          ) : null}

          {/* Seção Expansível de Substituições */}
          {item.temSubstituicao ? (
            <View style={styles.secaoSubstituicao}>
              <Pressable
                onPress={() => alternarExpansao(item.padraoId)}
                accessibilityRole="button"
                accessibilityLabel={`Ver histórico de substituição do padrão ${item.numero}`}
                style={styles.botaoExpandirSubstituicao}
              >
                <View style={styles.expandirTextoLinha}>
                  <MaterialIcons name="swap-horiz" size={18} color={Cores.primary} />
                  <Text style={[Tipografia.botaoSm, styles.expandirRotulo]}>
                    {item.substituicoes.length === 1
                      ? '1 substituição registrada no dia'
                      : `${item.substituicoes.length} substituições registradas no dia`}
                  </Text>
                </View>
                <MaterialIcons
                  name={expandido ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={Cores.onSurfaceVariant}
                />
              </Pressable>

              {expandido ? (
                <View style={styles.historicoSubstituicoesConteudo}>
                  <Text style={[Tipografia.rotulo, styles.historicoSubstituicaoHeader]}>
                    Medições anteriores substituídas:
                  </Text>

                  {item.substituicoes.map((sub, idx) => (
                    <View key={sub.id} style={styles.cardSubstituida}>
                      <View style={styles.substituidaTopo}>
                        <View style={styles.substituidaOrdem}>
                          <Text style={[Tipografia.meta, styles.substituidaOrdemTexto]}>
                            Tentativa #{idx + 1}
                          </Text>
                        </View>
                        <PilulaStatusLeitura status={sub.status} />
                      </View>

                      <View style={styles.valoresGridSub}>
                        <View style={styles.caixaValorSub}>
                          <Text style={[Tipografia.rotulo, styles.valorRotuloSub]}>Consumo</Text>
                          <Text style={[Tipografia.corpoSm, styles.valorSubTexto]}>
                            {formatarKwh(sub.valorConsumo)}
                          </Text>
                        </View>
                        {sub.valorInjecao !== null ? (
                          <View style={styles.caixaValorSub}>
                            <Text style={[Tipografia.rotulo, styles.valorRotuloSub]}>Injeção</Text>
                            <Text style={[Tipografia.corpoSm, styles.valorSubTexto]}>
                              {formatarKwh(sub.valorInjecao)}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={[Tipografia.meta, styles.substituidaHorario]}>
                        Medido às {sub.horaFormatada} por {sub.autorNome}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </Cartao>
      </View>
    );
  };

  const voltarAcao = () => {
    if (usinas.length > 1 && onDesmarcarUsina) {
      onDesmarcarUsina();
    } else {
      onVoltar();
    }
  };

  return (
    <View style={styles.raiz}>
      <CabecalhoTela
        titulo="Leituras da usina"
        subtitulo={usinaSelecionada ? usinaSelecionada.apelido : 'Acompanhamento diário'}
        onVoltar={voltarAcao}
        acao={
          <Pressable
            onPress={onRecarregar}
            hitSlop={Espaco.sm}
            accessibilityRole="button"
            accessibilityLabel="Recarregar"
          >
            <MaterialIcons name="refresh" size={22} color={Cores.onSurface} />
          </Pressable>
        }
      />

      {erro ? (
        <View style={styles.blocoErro}>
          <Cartao nivel="baixo">
            <Text style={styles.erroTexto}>{erro}</Text>
          </Cartao>
        </View>
      ) : null}

      {carregando && usinas.length === 0 ? (
        <View style={styles.carregandoContainer}>
          <ActivityIndicator color={Cores.primary} size="large" />
          <Text style={[Tipografia.corpoSm, styles.carregandoTexto]}>
            Carregando leituras da usina…
          </Text>
        </View>
      ) : usinas.length === 0 ? (
        <View style={styles.vazioContainer}>
          <EstadoVazio
            icone="solar-power"
            titulo="Nenhuma usina encontrada"
            descricao="Não há usinas solares cadastradas disponíveis para o seu perfil."
            acao={{ titulo: 'Atualizar', onPress: onRecarregar }}
          />
        </View>
      ) : (
        <FlatList
          data={medidores}
          keyExtractor={(m) => m.padraoId}
          ListHeaderComponent={renderCabecalhoDetalhe}
          renderItem={renderItemMedidor}
          contentContainerStyle={[styles.conteudoLista, { paddingBottom: bottom + Espaco.xxxl }]}
          refreshControl={
            <RefreshControl
              refreshing={carregando}
              onRefresh={onRecarregar}
              tintColor={Cores.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.vazioMedidores}>
              <Text style={[Tipografia.corpoSm, styles.vazioMedidoresTexto]}>
                Esta usina ainda não possui medidores (padrões) cadastrados.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal do Calendário Mensal com Indicador de Dias com Leituras */}
      <Modal
        visible={modalCalendarioAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCalendarioAberto(false)}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalConteudo}>
            {/* Cabeçalho do Calendário */}
            <View style={styles.modalCabecalho}>
              <Text style={[Tipografia.tituloCard, styles.modalTitulo]}>
                {NOMES_MESES[mesCalendario - 1]} {anoCalendario}
              </Text>

              <View style={styles.modalMesBotoes}>
                <Pressable
                  onPress={mesAnterior}
                  hitSlop={Espaco.sm}
                  accessibilityRole="button"
                  accessibilityLabel="Mês anterior"
                  style={styles.modalBotaoMes}
                >
                  <MaterialIcons name="chevron-left" size={24} color={Cores.primary} />
                </Pressable>
                <Pressable
                  onPress={mesSeguinte}
                  hitSlop={Espaco.sm}
                  accessibilityRole="button"
                  accessibilityLabel="Próximo mês"
                  style={styles.modalBotaoMes}
                >
                  <MaterialIcons name="chevron-right" size={24} color={Cores.primary} />
                </Pressable>
              </View>
            </View>

            {/* Dias da Semana (D, S, T, Q, Q, S, S) */}
            <View style={styles.calendarioSemanaLinha}>
              {DIAS_DA_SEMANA.map((diaSemana) => (
                <Text key={diaSemana} style={[Tipografia.rotulo, styles.calendarioSemanaTexto]}>
                  {diaSemana}
                </Text>
              ))}
            </View>

            {/* Grade de Dias */}
            <View style={styles.calendarioGrade}>
              {gradeDias.vaziosIniciais.map((idx) => (
                <View key={`vazio-${idx}`} style={styles.calendarioCelulaVazia} />
              ))}

              {gradeDias.dias.map((diaNum) => {
                const diaStr = String(diaNum).padStart(2, '0');
                const mesStr = String(mesCalendario).padStart(2, '0');
                const dataIsoItem = `${anoCalendario}-${mesStr}-${diaStr}`;
                const ehSelecionado = dataLocal === dataIsoItem;
                const teveLeitura = diasComLeitura.includes(dataIsoItem);

                return (
                  <Pressable
                    key={`dia-${diaNum}`}
                    onPress={() => selecionarDiaDoCalendario(diaNum)}
                    accessibilityRole="button"
                    accessibilityLabel={`Dia ${diaNum}${teveLeitura ? ' com leituras' : ''}`}
                    style={[
                      styles.calendarioCelulaDia,
                      ehSelecionado && styles.calendarioCelulaSelecionada,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarioDiaTexto,
                        ehSelecionado && styles.calendarioDiaTextoSelecionado,
                      ]}
                    >
                      {diaNum}
                    </Text>

                    {/* Marcador visual: dia com leitura realizada */}
                    {teveLeitura ? (
                      <View
                        style={[
                          styles.marcadorLeituraPonto,
                          ehSelecionado && styles.marcadorLeituraPontoSelecionado,
                        ]}
                      />
                    ) : (
                      <View style={styles.marcadorEspacador} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Legenda do Calendário */}
            <View style={styles.calendarioLegenda}>
              <View style={styles.legendaItem}>
                <View style={styles.legendaPonto} />
                <Text style={[Tipografia.meta, styles.legendaTexto]}>Dia com leitura</Text>
              </View>
              <View style={styles.legendaItem}>
                <View style={styles.legendaItemSelecionadoCirculo} />
                <Text style={[Tipografia.meta, styles.legendaTexto]}>Data selecionada</Text>
              </View>
            </View>

            {/* Rodapé do Modal */}
            <View style={styles.modalRodape}>
              <Pressable
                onPress={() => setModalCalendarioAberto(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar calendário"
                style={styles.modalBotaoFechar}
              >
                <Text style={[Tipografia.botaoSm, styles.modalBotaoFecharTexto]}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: Cores.surface,
  },
  conteudoLista: {
    paddingHorizontal: Espaco.lg,
    paddingTop: Espaco.md,
  },
  topoListaUsinas: {
    marginBottom: Espaco.md,
  },
  subtituloEscolha: {
    color: Cores.onSurfaceVariant,
    marginTop: Espaco.xs,
  },
  itemUsinaCard: {
    marginBottom: Espaco.md,
  },
  usinaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
  },
  usinaDetalhes: {
    flex: 1,
  },
  usinaTopoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.sm,
  },
  usinaNome: {
    color: Cores.onSurface,
    flex: 1,
  },
  usinaMeta: {
    color: Cores.onSurfaceVariant,
    marginTop: 2,
  },
  usinaEndereco: {
    color: Cores.onSurfaceVariant,
    opacity: 0.8,
    marginTop: 2,
  },
  usinaMedidoresContador: {
    color: Cores.primary,
    marginTop: Espaco.xs,
    fontWeight: '700',
  },
  topoConteudo: {
    gap: Espaco.md,
    marginBottom: Espaco.md,
  },
  usinaCardLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.md,
  },
  usinaCardTextos: {
    flex: 1,
  },
  usinaCardTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.sm,
  },
  usinaApelido: {
    color: Cores.onSurface,
    flex: 1,
  },
  botaoTrocarUsina: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Espaco.sm,
    paddingVertical: 4,
    borderRadius: Raio.pilula,
    backgroundColor: Overlay.primaryFraco,
    borderWidth: 1,
    borderColor: Overlay.primaryBorda,
  },
  botaoTrocarUsinaTexto: {
    color: Cores.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  navegadorData: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Cores.surfaceContainerLow,
    borderRadius: Raio.md,
    paddingHorizontal: Espaco.sm,
    paddingVertical: Espaco.xs,
    borderWidth: 1,
    borderColor: Overlay.borda,
  },
  botaoNavegacaoData: {
    padding: Espaco.xs,
  },
  dataCentral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    paddingHorizontal: Espaco.sm,
    paddingVertical: 6,
    borderRadius: Raio.sm,
    backgroundColor: Cores.surfaceContainer,
  },
  iconeCalendario: {
    marginRight: 2,
  },
  dataTexto: {
    color: Cores.onSurface,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: Espaco.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Cores.surfaceContainer,
    borderRadius: Raio.md,
    padding: Espaco.md,
    borderWidth: 1,
    borderColor: Overlay.borda,
  },
  kpiCardDestaque: {
    borderColor: Overlay.primaryBorda,
  },
  kpiCardAlerta: {
    borderColor: Overlay.errorBorda,
  },
  kpiLabel: {
    color: Cores.onSurfaceVariant,
  },
  kpiValor: {
    color: Cores.onSurface,
    marginTop: Espaco.xs,
  },
  kpiTotal: {
    fontSize: 13,
    color: Cores.onSurfaceVariant,
    fontWeight: '400',
  },
  kpiValorAmbar: {
    color: Cores.primary,
  },
  kpiValorErro: {
    color: Cores.error,
  },
  divisoriaSecao: {
    marginTop: Espaco.sm,
  },
  secaoTitulo: {
    color: Cores.onSurfaceVariant,
  },
  itemMedidor: {
    marginBottom: Espaco.md,
  },
  medidorCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medidorIdentificacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
    flex: 1,
  },
  medidorInfo: {
    flex: 1,
  },
  medidorNumero: {
    color: Cores.onSurface,
  },
  medidorSubtexto: {
    color: Cores.onSurfaceVariant,
    marginTop: 2,
  },
  blocoLeituraVigente: {
    marginTop: Espaco.md,
    paddingTop: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  valoresGrid: {
    flexDirection: 'row',
    gap: Espaco.md,
    marginBottom: Espaco.sm,
  },
  caixaValor: {
    flex: 1,
    backgroundColor: Cores.surfaceContainerHigh,
    borderRadius: Raio.sm,
    padding: Espaco.sm,
  },
  valorRotulo: {
    color: Cores.onSurfaceVariant,
    fontSize: 9,
  },
  valorConsumo: {
    color: Cores.primary,
    marginTop: 2,
  },
  valorInjecao: {
    color: Cores.sucesso,
    marginTop: 2,
  },
  rodapeLeitura: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Espaco.xs,
    marginTop: Espaco.xs,
  },
  rodapeAutorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rodapeTexto: {
    color: Cores.onSurfaceVariant,
  },
  badgesLinha: {
    flexDirection: 'row',
    gap: Espaco.xs,
  },
  tagHardware: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Cores.surfaceContainerHigh,
    paddingHorizontal: Espaco.xs,
    paddingVertical: 2,
    borderRadius: Raio.sm,
  },
  tagTexto: {
    color: Cores.onSurfaceVariant,
    fontSize: 10,
  },
  semLeituraBloco: {
    marginTop: Espaco.md,
    paddingVertical: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  semLeituraTexto: {
    color: Cores.onSurfaceVariant,
    fontStyle: 'italic',
  },
  referenciaHistoricaTexto: {
    color: Cores.onSurfaceVariant,
    opacity: 0.8,
    marginTop: Espaco.xs,
  },
  containerAlertaHistorico: {
    marginTop: Espaco.sm,
    backgroundColor: Overlay.errorFraco,
    borderWidth: 1,
    borderColor: Overlay.errorBorda,
    borderRadius: Raio.md,
    padding: Espaco.md,
  },
  alertaTopoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    marginBottom: 4,
  },
  alertaTitulo: {
    color: Cores.error,
    fontWeight: '900',
  },
  alertaDescricao: {
    color: Cores.onSurface,
    lineHeight: 18,
  },
  secaoSubstituicao: {
    marginTop: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
    paddingTop: Espaco.xs,
  },
  botaoExpandirSubstituicao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Espaco.xs,
  },
  expandirTextoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
  },
  expandirRotulo: {
    color: Cores.primary,
  },
  historicoSubstituicoesConteudo: {
    marginTop: Espaco.xs,
    backgroundColor: Cores.surfaceContainerLow,
    borderRadius: Raio.sm,
    padding: Espaco.sm,
    gap: Espaco.sm,
  },
  historicoSubstituicaoHeader: {
    color: Cores.onSurfaceVariant,
    marginBottom: 2,
  },
  cardSubstituida: {
    backgroundColor: Cores.surfaceContainer,
    borderRadius: Raio.sm,
    padding: Espaco.sm,
    borderWidth: 1,
    borderColor: Overlay.borda,
  },
  substituidaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Espaco.xs,
  },
  substituidaOrdem: {},
  substituidaOrdemTexto: {
    color: Cores.onSurfaceVariant,
    fontWeight: '700',
  },
  valoresGridSub: {
    flexDirection: 'row',
    gap: Espaco.md,
    marginBottom: Espaco.xs,
  },
  caixaValorSub: {
    flex: 1,
  },
  valorRotuloSub: {
    color: Cores.onSurfaceVariant,
    fontSize: 9,
  },
  valorSubTexto: {
    color: Cores.onSurface,
  },
  substituidaHorario: {
    color: Cores.onSurfaceVariant,
    fontSize: 11,
  },
  blocoErro: {
    paddingHorizontal: Espaco.lg,
    paddingTop: Espaco.md,
  },
  erroTexto: {
    color: Cores.error,
  },
  carregandoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.md,
  },
  carregandoTexto: {
    color: Cores.onSurfaceVariant,
  },
  vazioContainer: {
    flex: 1,
    padding: Espaco.xl,
    justifyContent: 'center',
  },
  vazioMedidores: {
    paddingVertical: Espaco.xxl,
    alignItems: 'center',
  },
  vazioMedidoresTexto: {
    color: Cores.onSurfaceVariant,
    fontStyle: 'italic',
  },
  // Modal de Calendário
  modalFundo: {
    flex: 1,
    backgroundColor: Overlay.modal,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Espaco.lg,
  },
  modalConteudo: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Cores.surfaceContainer,
    borderRadius: Raio.lg,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Overlay.bordaForte,
  },
  modalCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Espaco.md,
  },
  modalTitulo: {
    color: Cores.onSurface,
  },
  modalMesBotoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
  },
  modalBotaoMes: {
    padding: 4,
    borderRadius: Raio.sm,
    backgroundColor: Cores.surfaceContainerHigh,
  },
  calendarioSemanaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Espaco.sm,
  },
  calendarioSemanaTexto: {
    width: 36,
    textAlign: 'center',
    color: Cores.onSurfaceVariant,
    fontSize: 10,
  },
  calendarioGrade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarioCelulaVazia: {
    width: `${100 / 7}%`,
    height: 40,
  },
  calendarioCelulaDia: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Raio.sm,
  },
  calendarioCelulaSelecionada: {
    backgroundColor: Cores.primary,
  },
  calendarioDiaTexto: {
    color: Cores.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  calendarioDiaTextoSelecionado: {
    color: Cores.surface,
    fontWeight: '900',
  },
  marcadorLeituraPonto: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Cores.primary,
    marginTop: 2,
  },
  marcadorLeituraPontoSelecionado: {
    backgroundColor: Cores.surface,
  },
  marcadorEspacador: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  calendarioLegenda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: Espaco.md,
    paddingTop: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendaPonto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Cores.primary,
  },
  legendaItemSelecionadoCirculo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Cores.primary,
  },
  legendaTexto: {
    color: Cores.onSurfaceVariant,
    fontSize: 11,
  },
  modalRodape: {
    marginTop: Espaco.md,
    alignItems: 'center',
  },
  modalBotaoFechar: {
    paddingVertical: Espaco.sm,
    paddingHorizontal: Espaco.xl,
    backgroundColor: Cores.surfaceContainerHigh,
    borderRadius: Raio.pilula,
  },
  modalBotaoFecharTexto: {
    color: Cores.onSurface,
  },
});
