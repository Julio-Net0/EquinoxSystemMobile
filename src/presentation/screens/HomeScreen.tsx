import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cores, Espaco, Overlay, Tipografia } from '@/constants/theme';
import { PerfilEnum, rotuloDoPerfil } from '@/domain/enums/PerfilEnum';
import { EnderecoCatalogoDTO } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { AcaoCard } from '@/presentation/components/AcaoCard';
import { Cartao } from '@/presentation/components/Cartao';
import { IconeTile } from '@/presentation/components/IconeTile';
import { EstadoVazio } from '@/presentation/components/EstadoVazio';
import { PilulaStatus } from '@/presentation/components/PilulaStatus';

export interface HomeScreenProps {
  nome: string;
  perfil: PerfilEnum;
  enderecos: EnderecoCatalogoDTO[];
  avisosNaoLidos: number;
  carregando: boolean;
  erro: string | null;
  onRecarregar(): void;
  onNovaLeitura(): void;
  onAvisos(): void;
  onAutorizacoes(): void;
  onUsuarios(): void;
  onEstrutura(): void;
}

const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? nome;

/**
 * Hub do app, portada de example/Equinox.MOBILE/src/pages/home.ts.
 *
 * A metade de baixo muda por perfil, como no original: administrador vê os
 * atalhos de administração, técnico vê os endereços a que tem acesso.
 */
export function HomeScreen({
  nome,
  perfil,
  enderecos,
  avisosNaoLidos,
  carregando,
  erro,
  onRecarregar,
  onNovaLeitura,
  onAvisos,
  onAutorizacoes,
  onUsuarios,
  onEstrutura,
}: HomeScreenProps) {
  const { top } = useSafeAreaInsets();
  const ehAdministrador = perfil === PerfilEnum.ADMIN || perfil === PerfilEnum.SUPER_ADMIN;
  const totalPadroes = enderecos.reduce((soma, e) => soma + e.padroes.length, 0);

  return (
    <ScrollView
      style={styles.raiz}
      contentContainerStyle={[styles.conteudo, { paddingTop: top + Espaco.xl }]}
      refreshControl={
        <RefreshControl
          refreshing={carregando}
          onRefresh={onRecarregar}
          tintColor={Cores.primary}
        />
      }
    >
      <View style={styles.saudacao}>
        <Text style={[Tipografia.corpoSm, styles.bemVindo]}>Bem-vindo,</Text>
        <Text style={[Tipografia.display, styles.nome]} numberOfLines={1}>
          {primeiroNome(nome)}
        </Text>
        <View style={styles.regua} />
        <Text style={[Tipografia.rotulo, styles.perfil]}>{rotuloDoPerfil(perfil)}</Text>
      </View>

      <AcaoCard
        icone="document-scanner"
        titulo="Leitura de padrão"
        subtitulo="Registre a leitura do seu medidor"
        destaque
        onPress={onNovaLeitura}
      />

      {erro ? (
        <Cartao nivel="baixo">
          <Text style={styles.erro}>{erro}</Text>
        </Cartao>
      ) : null}

      {ehAdministrador ? (
        <View style={styles.secao}>
          <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>Administração</Text>

          <AcaoCard
            icone="notifications"
            titulo="Notificações"
            subtitulo="Leituras atrasadas, substituições e avisos"
            badge={avisosNaoLidos}
            onPress={onAvisos}
          />
          <AcaoCard
            icone="group-add"
            titulo="Aprovar cadastros"
            subtitulo="Autorize novos usuários e vincule endereços"
            onPress={onAutorizacoes}
          />
          <AcaoCard
            icone="manage-accounts"
            titulo="Gerenciar usuários"
            subtitulo="Edite perfil, status e vínculos"
            onPress={onUsuarios}
          />
          <AcaoCard
            icone="domain"
            titulo="Gerenciar estrutura"
            subtitulo="Empresas, endereços e padrões"
            onPress={onEstrutura}
          />
        </View>
      ) : null}

      <View style={styles.secao}>
        <Text style={[Tipografia.rotulo, styles.secaoTitulo]}>
          {ehAdministrador ? 'Meus endereços' : 'Minha empresa'}
        </Text>

        {carregando && enderecos.length === 0 ? (
          <ActivityIndicator color={Cores.primary} style={styles.carregando} />
        ) : enderecos.length === 0 ? (
          <EstadoVazio
            icone="location-off"
            titulo="Nenhum endereço vinculado"
            descricao="Procure um administrador para vincular os endereços da sua conta."
          />
        ) : (
          <>
            <Text style={[Tipografia.meta, styles.resumo]}>
              {enderecos.length === 1 ? '1 endereço' : `${enderecos.length} endereços`}
              {' · '}
              {totalPadroes === 1 ? '1 padrão' : `${totalPadroes} padrões`}
            </Text>

            {enderecos.map((endereco) => (
              <Cartao key={endereco.enderecoId}>
                <View style={styles.enderecoLinha}>
                  <IconeTile
                    icone={endereco.ehUsina ? 'solar-power' : 'location-on'}
                    tamanho={44}
                  />

                  <View style={styles.enderecoTextos}>
                    <View style={styles.enderecoCabecalho}>
                      <Text style={[Tipografia.tituloCard, styles.enderecoApelido]} numberOfLines={1}>
                        {endereco.apelido}
                      </Text>
                      {endereco.ehUsina ? <PilulaStatus texto="Usina" tom="primary" /> : null}
                    </View>

                    <Text style={[Tipografia.meta, styles.enderecoMeta]}>UC {endereco.uc}</Text>

                    {endereco.logradouro ? (
                      <Text style={[Tipografia.meta, styles.enderecoMeta]} numberOfLines={1}>
                        {endereco.logradouro}
                      </Text>
                    ) : null}

                    {endereco.padroes.length > 0 ? (
                      <Text style={[Tipografia.meta, styles.enderecoMeta]} numberOfLines={1}>
                        Padrões: {endereco.padroes.map((p) => p.numero).join(', ')}
                      </Text>
                    ) : (
                      <Text style={[Tipografia.meta, styles.semPadrao]}>
                        Sem padrão cadastrado
                      </Text>
                    )}

                    {!endereco.temGeocerca ? (
                      <View style={styles.avisoGeocerca}>
                        <MaterialIcons name="gps-off" size={13} color={Cores.onSurfaceVariant} />
                        <Text style={[Tipografia.meta, styles.enderecoMeta]}>
                          Sem coordenada cadastrada
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Cartao>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.surface },
  conteudo: {
    paddingHorizontal: Espaco.xl,
    paddingBottom: Espaco.xxxl,
    gap: Espaco.xxl,
  },
  saudacao: { gap: Espaco.xs },
  bemVindo: { color: Cores.onSurfaceVariant },
  nome: { color: Cores.primary },
  regua: {
    width: 64,
    height: 4,
    backgroundColor: Cores.primary,
    borderRadius: 2,
    marginVertical: Espaco.xs,
  },
  perfil: { color: Cores.onSurfaceVariant },
  secao: { gap: Espaco.md },
  secaoTitulo: { color: Cores.onSurfaceVariant, opacity: 0.7 },
  resumo: { color: Cores.onSurfaceVariant, marginBottom: -Espaco.xs },
  carregando: { marginVertical: Espaco.xxl },
  erro: { ...Tipografia.corpoSm, color: Cores.error },
  enderecoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.md },
  enderecoTextos: { flex: 1, gap: 2 },
  enderecoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.sm },
  enderecoApelido: { color: Cores.onSurface, flexShrink: 1 },
  enderecoMeta: { color: Cores.onSurfaceVariant },
  semPadrao: { ...Tipografia.meta, color: Cores.error },
  avisoGeocerca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: Overlay.borda,
  },
});
