# Catálogo & Especificação de Custom Hooks — Equinox Mobile

## 1. Visão Geral & Papel Arquitetural

No projeto **Equinox Mobile**, a camada de apresentação (*Presentation Layer*) segue rigorosamente os princípios de **Clean Architecture** e **Desacoplamento de UI**. 

As telas (componentes Expo Router) **não devem**:
- Executar regras de negócio diretamente;
- Chamar diretamente repositórios SQLite ou APIs do Supabase;
- Lidar com detalhes de baixo nível de APIs do sistema operacional (câmera, GPS, Keystore/Keychain).

> **Fluxo Arquitetural:** `Tela (UI / JSX)` ⇄ `Custom Hook (Controller)` ⇄ `Caso de Uso / Adaptador de Hardware`

```
src/presentation/hooks/
├── context/         # Hooks consumidores de Contextos Globais de Estado
│   ├── useAuth.ts
│   ├── useConnectionState.ts
│   └── useSync.ts
├── usecases/        # Hooks orquestradores de Casos de Uso (Application Layer)
│   ├── useLeitura.ts
│   ├── useUsinas.ts
│   ├── useCadastrarUsina.ts
│   └── useEmpresa.ts
├── hardware/        # Hooks de abstração de Hardware e Sensores Nativos
│   ├── useCameraHardware.ts
│   ├── useGPS.ts
│   └── useSecureStore.ts
└── utils/           # Hooks utilitários de interface e formulários
    ├── useZodForm.ts
    └── useDebounce.ts
```

---

## 2. Catálogo Detalhado de Custom Hooks

### 2.1. Hooks de Contexto & Estado Global (`context/`)

#### `useAuth()`
Consome o `AuthContext` e orquestra a sessão do usuário, integrando autenticação remota (Supabase Auth) com desbloqueio offline seguro (Cold Start via PIN local).

* **Interface TypeScript:**
```typescript
export interface UseAuthReturn {
  usuario: Usuario | null;
  perfil: 'SuperAdmin' | 'Admin' | 'Tecnico' | null;
  empresaId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginOnline: (credenciais: LoginDTO) => Promise<void>;
  desbloquearComPin: (pin: string) => Promise<boolean>;
  definirPinLocal: (novoPin: string) => Promise<void>;
  logout: () => Promise<void>;
}
```
* **Comportamento:**
  - Se online: autentica via Supabase Auth e grava credenciais no cofre `expo-secure-store`.
  - Se offline (em campo): valida o PIN de 6 dígitos contra a Keystore/Keychain do dispositivo, liberando o acesso ao SQLite local.

---

#### `useConnectionState()` (Atende ao RNF06)
Consome o `ConnectionContext` e monitora o estado de conectividade do dispositivo via `@react-native-community/netinfo`.

* **Interface TypeScript:**
```typescript
export interface UseConnectionStateReturn {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  isInternetReachable: boolean | null;
  statusLabel: 'Online' | 'Offline' | 'Conectando';
}
```
* **Comportamento:**
  - Alimenta o indicador visual permanente no cabeçalho do app.
  - Notifica o `SyncManager` assim que a conexão transita de `offline` para `online`.

---

#### `useSync()` (Atende ao RF09, RF10, RNF06)
Interface reativa com a fila transacional `action_queue` do SQLite e o serviço em background `SyncManager`.

* **Interface TypeScript:**
```typescript
export interface UseSyncReturn {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTimestamp: Date | null;
  lastError: string | null;
  triggerSync: () => Promise<void>;
}
```
* **Comportamento:**
  - Observa alterações na tabela `action_queue`.
  - Expõe o badge numérico de pendências no topo da tela.
  - Permite disparo manual de sincronização puxando o *Pull-to-Refresh*.

---

### 2.2. Hooks Controladores de Casos de Uso (`usecases/`)

#### `useLeitura()` (Atende ao RF06, RF08, RF09)
Controlador da tela de Nova Leitura de Medidor.

* **Interface TypeScript:**
```typescript
export interface RegistrarLeituraInput {
  usinaId: string;
  valorKwh: number;
  fotoLocalUri: string;
  coordenadas?: { latitude: number; longitude: number };
}

export interface UseLeituraReturn {
  isSubmitting: boolean;
  error: string | null;
  isSuccess: boolean;
  registrarLeitura: (input: RegistrarLeituraInput) => Promise<boolean>;
  reset: () => void;
}
```
* **Comportamento:**
  - Invoca a classe `RegistrarLeituraUseCase` passando os dados validados.
  - Salva a entidade `Leitura` no SQLite local.
  - Registra a ação `INSERT_LEITURA` na `action_queue`.
  - Retorna feedback em menos de 100ms para o técnico.

---

#### `useUsinas(filtro?)` (Atende ao RF05, RF07)
Consulta e filtragem reativa de usinas cacheadas localmente no SQLite.

* **Interface TypeScript:**
```typescript
export interface FiltroUsinas {
  buscaTexto?: string;
  status?: 'Ativa' | 'Em Comissionamento' | 'Inativa';
}

export interface UseUsinasReturn {
  usinas: Usina[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```
* **Comportamento:**
  - Invoca `ConsultarUsinasUseCase` consultando diretamente o banco local indexado.
  - Suporta filtragem por código UC, nome da usina e status operacional.

---

#### `useCadastrarUsina()` (Atende ao RF07)
Controlador para cadastro emergencial de novas usinas em campo sem internet.

* **Interface TypeScript:**
```typescript
export interface CadastrarUsinaInput {
  nome: string;
  codigoUC: string;
  capacidadeKwh: number;
  coordenadas: { latitude: number; longitude: number };
}

export interface UseCadastrarUsinaReturn {
  isSaving: boolean;
  error: string | null;
  cadastrarUsina: (input: CadastrarUsinaInput) => Promise<boolean>;
}
```
* **Comportamento:**
  - Cria a usina localmente com status `Em Comissionamento` e UUIDv4 no domínio.
  - Registra a ação `INSERT_USINA` na `action_queue` para homologação posterior pelo Administrador na nuvem.

---

### 2.3. Hooks de Sensores & Hardware SO (`hardware/`)

#### `useCameraHardware()` (Atende ao RF08, ADR 3.1)
Interface amigável para gerenciamento de permissões, captura e compressão de fotos de medidores.

* **Interface TypeScript:**
```typescript
export interface UseCameraHardwareReturn {
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
  capturarEComprimirFoto: () => Promise<{ uri: string; sizeBytes: number } | null>;
  openSettingsFallback: () => void;
}
```
* **Comportamento:**
  - Aciona o `expo-camera` para captura bruta.
  - Envia a foto imediatamente ao `expo-image-manipulator` reduzindo a resolução para máx. 1080p e qualidade JPEG 75% (~300KB).
  - Se a permissão for negada, disponibiliza `openSettingsFallback` via `Linking.openSettings()`.

---

#### `useGPS()` (Atende ao ADR 5.4 — GPS Consultivo)
Coleta coordenadas georreferenciadas instantâneas via `expo-location` para a auditoria de Prova de Presença.

* **Interface TypeScript:**
```typescript
export interface UseGPSReturn {
  coordenadas: { latitude: number; longitude: number } | null;
  isLoading: boolean;
  hasSatelliteSignal: boolean;
  obterCoordenadas: () => Promise<{ latitude: number; longitude: number } | null>;
}
```
* **Comportamento:**
  - Política Consultiva: Se o satélite demorar ou falhar (ex: galpão metálico), exibe alerta consultivo na UI, mas **não bloqueia** o salvamento da medição.

---

#### `useSecureStore(key: string)` (Atende ao ADR 3.2)
Acesso seguro ao cofre de chaves criptografado do sistema operacional.

* **Interface TypeScript:**
```typescript
export interface UseSecureStoreReturn<T> {
  value: T | null;
  isLoading: boolean;
  setValue: (value: T) => Promise<void>;
  removeValue: () => Promise<void>;
}
```

---

### 2.4. Hooks Utilitários (`utils/`)

#### `useZodForm(schema)`
Integração padronizada entre `react-hook-form` e `zodResolver`.

* **Interface TypeScript:**
```typescript
export function useZodForm<T extends z.ZodType<any, any>>(schema: T, defaultValues?: any) {
  return useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });
}
```

#### `useDebounce<T>(value: T, delay: number): T`
Evita disparos excessivos de queries no SQLite durante a digitação na busca de usinas.

---

## 3. Diretrizes de Testabilidade (TDD)

Todos os Custom Hooks devem ser cobertos por testes unitários automatizados usando `renderHook` e `act` de `@testing-library/react-native`:

1. **Testes Isolados de Use Cases:** Os Casos de Uso e Adaptadores de Hardware injetados nos hooks são simulados via *fakes* e *mocks* do Jest.
2. **Ciclo de Estados:** Validação de transição de estados (`isLoading -> isSuccess` ou `isLoading -> error`).
3. **Persistência e Efeitos:** Garantir que o hook invoca os métodos corretos dos Casos de Uso sem acoplamento a JSX ou elementos nativos.
