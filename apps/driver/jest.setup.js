// Mock oficial do AsyncStorage para os testes (não há módulo nativo no Jest).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
