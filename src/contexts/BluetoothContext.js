import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert, Platform, PermissionsAndroid, Linking } from 'react-native';
import Constants from 'expo-constants';

const BluetoothContext = createContext(null);

export const SPEED_MODES = {
  eco: { label: 'Indoor', icon: '🏠', desc: 'Locais fechados' },
  sport: { label: 'Outdoor', icon: '🌤️', desc: 'Locais abertos' },
  manual: { label: 'Manual', icon: '🎚️', desc: 'Ajuste manual' },
};

// Em ambientes onde o módulo nativo não está disponível (Expo Go/web),
// a importação direta pode falhar. Fazemos require dinâmico e fallback.
const forceMock = Constants.expoConfig?.extra?.USE_BLUETOOTH_MOCK === true ||
                  Constants.expoConfig?.extra?.USE_BLUETOOTH_MOCK === 'true';

function createMockBleManager() {
  return {
    state: async () => 'PoweredOff',
    onStateChange: (cb) => ({ remove: () => {} }),
    startDeviceScan: () => {},
    stopDeviceScan: () => {},
    connectToDevice: async () => ({
      discoverAllServicesAndCharacteristics: async () => {},
      writeCharacteristicWithResponseForService: async () => {},
      cancelConnection: async () => {},
    }),
    destroy: () => {},
  };
}

let bleManager;
try {
  if (!forceMock) {
    // eslint-disable-next-line global-require
    const { BleManager } = require('react-native-ble-plx');
    bleManager = new BleManager();
  }
} catch (e) {
  bleManager = null;
}
if (!bleManager) {
  bleManager = createMockBleManager();
}

export const BluetoothProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [connectionStrength, setConnectionStrength] = useState('none');
  const [estimatedAutonomy, setEstimatedAutonomy] = useState('--');
  const [systemTemperature, setSystemTemperature] = useState(36.5);
  const [bleDevices, setBleDevices] = useState([]);
  const [bleSubscription, setBleSubscription] = useState(null);
  const [bleConnectedDevice, setBleConnectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothState, setBluetoothState] = useState('Unknown');
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [lastCommand, setLastCommand] = useState('');
  const [speedMode, setSpeedMode] = useState('eco'); // 'eco', 'sport', 'manual'
  const [isLocked, setIsLocked] = useState(false);

  // Monitorar estado do Bluetooth
  useEffect(() => {
    bleManager.state().then(setBluetoothState).catch(() => setBluetoothState('Unknown'));
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
    }, true);
    return () => subscription?.remove?.();
  }, []);

  // Simulação periódica de status quando mock está ativo
  useEffect(() => {
    if (!forceMock) return undefined;
    let mounted = true;
    // Valores iniciais mock
    if (mounted) {
      setBatteryLevel(prev => (prev > 0 ? prev : 84));
      setConnectionStrength('strong');
      setEstimatedAutonomy('3h 10m');
      setSystemTemperature(36.8);
    }
    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.max(15, Math.min(100, prev + (Math.random() * 2 - 0.8))));
      setConnectionStrength(prev => (prev === 'strong' ? 'medium' : prev === 'medium' ? 'strong' : 'strong'));
      setEstimatedAutonomy(() => {
        const hours = 2 + Math.floor(Math.random() * 2); // 2-3h
        const minutes = 10 + Math.floor(Math.random() * 40);
        return `${hours}h ${minutes}m`;
      });
      setSystemTemperature(prev => {
        const drift = (Math.random() * 0.6) - 0.3; // -0.3 a +0.3
        const next = Math.max(32.5, Math.min(48.0, prev + drift));
        return Math.round(next * 10) / 10;
      });
    }, 3000);
    return () => { clearInterval(interval); mounted = false; };
  }, [forceMock]);

  // Checar permissão de localização
  const checkLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      setLocationPermission(granted ? 'granted' : 'denied');
      return granted;
    }
    setLocationPermission('granted');
    return true;
  };

  useEffect(() => {
    checkLocationPermission();
  }, []);

  // Função para abrir configurações do sistema
  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };
  const openAppSettings = () => {
    Linking.openSettings();
  };

  // --- FUNÇÕES REAIS (BLE) --- //
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const allGranted = Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
      setLocationPermission(granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
      if (!allGranted) {
        Alert.alert(
          'Permissão Necessária',
          'O app precisa de permissão para acessar o Bluetooth e a localização. Vá em Configurações e permita o acesso.',
          [
            { text: 'Abrir Configurações', onPress: openAppSettings },
            { text: 'Cancelar', style: 'cancel' },
          ]
        );
        throw new Error('Permissões negadas');
      }
    }
  };

  const scanForDevices = async () => {
    if (forceMock) {
      setIsScanning(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockDevices = [
            {
              id: 'wacs-kit-001',
              name: 'Kit de Automação - WACS (Simulado)',
              rssi: -60,
              paired: true,
            },
          ];
          setBleDevices(mockDevices);
          setIsScanning(false);
          resolve(mockDevices);
        }, 1500);
      });
    }

    await requestPermissions();
    if (bluetoothState !== 'PoweredOn') {
      Alert.alert(
        'Bluetooth Desligado',
        'Por favor, ative o Bluetooth do seu dispositivo para buscar dispositivos.',
        [
          { text: 'Abrir Configurações', onPress: openBluetoothSettings },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return [];
    }
    if (locationPermission !== 'granted') {
      Alert.alert(
        'Permissão de Localização',
        'O app precisa de permissão de localização para buscar dispositivos Bluetooth. Vá em Configurações e permita o acesso.',
        [
          { text: 'Abrir Configurações', onPress: openAppSettings },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return [];
    }
    setIsScanning(true);
    setBleDevices([]);
    return new Promise((resolve, reject) => {
      const found = {};
      const subscription = bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          setIsScanning(false);
          bleManager.stopDeviceScan();
          reject(error);
          return;
        }
        // Adiciona qualquer dispositivo, mesmo sem nome
        if (device) {
          found[device.id] = {
            id: device.id,
            name: device.name || device.localName || device.id || 'Dispositivo Bluetooth',
            rssi: device.rssi || -60,
            paired: false,
          };
        }
      });
      setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsScanning(false);
        setBleDevices(Object.values(found));
        resolve(Object.values(found));
      }, 5000);
      setBleSubscription(subscription);
    });
  };

  const connectToDevice = async (device) => {
    setIsConnecting(true);
    try {
      const connectedDevice = await bleManager.connectToDevice(device.id);
      await connectedDevice.discoverAllServicesAndCharacteristics();
      setIsConnected(true);
      setDeviceInfo(device);
      setBleConnectedDevice(connectedDevice);
      setBatteryLevel(75); // Opcional: ler característica real se disponível
      setConnectionStrength('strong');
      setEstimatedAutonomy('2h 30m');
      Alert.alert('Sucesso', `Conectado a ${device.name || device.id}!`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível conectar ao dispositivo.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromDevice = async () => {
    if (bleConnectedDevice) {
      try {
        await bleConnectedDevice.cancelConnection();
      } catch {}
    }
    setIsConnected(false);
    setDeviceInfo(null);
    setBleConnectedDevice(null);
    setBatteryLevel(0);
    setConnectionStrength('none');
    setEstimatedAutonomy('--');
    Alert.alert('Desconectado', 'O dispositivo foi desconectado.');
  };

  // --- ENVIO DE COMANDOS BLUETOOTH (HC-06) --- //
  // Adapte o UUID do serviço/característica conforme seu módulo BLE, se necessário
  const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // Envia comando string para o dispositivo conectado
  const sendCommand = async (command) => {
    if (!bleConnectedDevice) return false;
    try {
      await bleConnectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        Buffer.from(command + '\n').toString('base64')
      );
      setLastCommand(command);
      return true;
    } catch (e) {
      console.error('Erro ao enviar comando Bluetooth:', e);
      return false;
    }
  };

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (bleSubscription) bleSubscription.remove();
      if (bleManager) bleManager.destroy();
    };
  }, []);

  return (
    <BluetoothContext.Provider
      value={{
        isConnected,
        isConnecting,
        deviceInfo,
        batteryLevel,
        connectionStrength,
        estimatedAutonomy,
        systemTemperature,
        connectToDevice,
        disconnectFromDevice,
        scanForDevices,
        isScanning,
        devices: bleDevices,
        bluetoothState,
        locationPermission,
        openBluetoothSettings,
        openAppSettings,
        sendCommand,
        lastCommand,
        speedMode,
        setSpeedMode,
        isLocked,
        setIsLocked,
        SPEED_MODES,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (context === undefined) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
}; 