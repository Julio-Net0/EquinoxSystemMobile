// Os matchers do @testing-library/react-native 14 são registrados automaticamente.
// Mocks dos módulos nativos do Expo. O app roda 100% local, então câmera, GPS,
// arquivos e cripto são substituídos por dublês determinísticos.

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  CameraType: { back: 'back', front: 'front' },
  useCameraPermissions: () => [{ granted: true, status: 'granted', canAskAgain: true }, jest.fn(), jest.fn()],
  Camera: {
    getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: -19.9191, longitude: -43.9386, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: 1_767_225_600_000,
  })),
}));

jest.mock('expo-image-manipulator', () => {
  const saveAsync = jest.fn(async () => ({ uri: 'file:///cache/medidor-comprimido.jpg', width: 1080, height: 1440 }));
  const renderAsync = jest.fn(async () => ({ width: 1080, height: 1440, saveAsync }));
  const contexto: Record<string, unknown> = {};
  contexto.resize = jest.fn(() => contexto);
  contexto.rotate = jest.fn(() => contexto);
  contexto.crop = jest.fn(() => contexto);
  contexto.renderAsync = renderAsync;
  return {
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
    FlipType: { Vertical: 'vertical', Horizontal: 'horizontal' },
    ImageManipulator: { manipulate: jest.fn(() => contexto) },
    useImageManipulator: jest.fn(() => contexto),
  };
});

jest.mock('expo-file-system', () => {
  class FileDuble {
    uri: string;
    size = 250_000;
    exists = true;
    constructor(...segmentos: unknown[]) {
      this.uri = segmentos.map((s) => (typeof s === 'string' ? s : (s as { uri: string }).uri)).join('/');
    }
    create() {}
    move() {}
    copy() {}
    delete() {}
  }
  class DirectoryDuble extends FileDuble {}
  return {
    Paths: { document: 'file:///documents', cache: 'file:///cache', bundle: 'file:///bundle' },
    File: FileDuble,
    Directory: DirectoryDuble,
  };
});

jest.mock('expo-secure-store', () => {
  const cofre = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
    WHEN_UNLOCKED: 'whenUnlocked',
    isAvailableAsync: jest.fn(async () => true),
    setItemAsync: jest.fn(async (k: string, v: string) => void cofre.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => cofre.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void cofre.delete(k)),
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256', SHA512: 'SHA-512' },
  // Dublê determinístico: hash estável para a mesma entrada, sem custo de iteração.
  digestStringAsync: jest.fn(async (_algoritmo: string, dados: string) => {
    let acumulado = 0;
    for (let i = 0; i < dados.length; i += 1) acumulado = (acumulado * 31 + dados.charCodeAt(i)) >>> 0;
    return acumulado.toString(16).padStart(64, '0');
  }),
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(7)),
  getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(n).fill(7)),
  randomUUID: jest.fn(() => '11111111-2222-4333-8444-555555555555'),
}));
