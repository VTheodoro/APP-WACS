import React, { useState, useEffect } from 'react';
import { useBluetooth } from '../contexts/BluetoothContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Vibration
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { connectToArduino } from '../services/arduinoService';
import * as Haptics from 'expo-haptics';

export const ConnectionScreen = () => {
  const {
    connectToDevice,
    disconnectFromDevice,
    isConnected,
    isConnecting: isConnectingGlobally,
    deviceInfo: connectedDevice,
    scanForDevices,
    devices: bleDevices,
    isScanning,
  } = useBluetooth();
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const handleVibrate = (type = 'light') => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle[type === 'light' ? 'Light' : 'Medium']);
    } else {
      Vibration.vibrate(type === 'light' ? 50 : 100);
    }
  };

  const handleScan = async () => {
    if (isScanning) return;
    handleVibrate('light');
    const foundDevices = await scanForDevices();
    setDevices(foundDevices);
  };

  const onRefresh = () => {
    if (!isScanning) {
      handleScan();
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch(deviceType) {
      case 'wacs-kit':
        return 'chip';
      default:
        return 'bluetooth';
    }
  };

  const getSignalStrength = (rssi) => {
    if (rssi >= -50) return { level: 'excelente', icon: 'wifi-strength-4' };
    if (rssi >= -70) return { level: 'bom', icon: 'wifi-strength-3' };
    if (rssi >= -80) return { level: 'médio', icon: 'wifi-strength-2' };
    return { level: 'fraco', icon: 'wifi-strength-1' };
  };

  const handleConnect = async (device) => {
    await connectToDevice(device);
    navigation.goBack();
  };

  const renderDevice = (device) => {
    const signal = getSignalStrength(device.rssi);
    const isSelected = selectedDevice?.id === device.id;
    const isConnecting = isConnectingGlobally && connectedDevice?.id === device.id;
    const isConnected = isConnected && connectedDevice?.id === device.id;
    
    return (
      <Pressable 
        key={device.id} 
        style={({ pressed }) => [
          styles.deviceCard,
          isSelected && styles.deviceCardSelected,
          pressed && styles.deviceCardPressed
        ]}
        onPress={() => {
          handleVibrate('light');
          setSelectedDevice(device);
        }}
      >
        <View style={styles.deviceInfo}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceIconContainer}>
              <MaterialCommunityIcons 
                name={getDeviceIcon(device.type)} 
                size={28} 
                color={isConnected ? '#4CAF50' : '#1E88E5'} 
              />
              {isConnected && (
                <View style={styles.connectedBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.deviceInfoText}>
              <Text style={styles.deviceName} numberOfLines={1} ellipsizeMode="tail">
                {device.name}
              </Text>
              <View style={styles.deviceMeta}>
                <MaterialIcons name="usb" size={14} color="#718096" />
                <Text style={styles.devicePort}>{device.port}</Text>
                <View style={styles.dotSeparator} />
                <MaterialCommunityIcons 
                  name={signal.icon} 
                  size={16} 
                  color={
                    signal.level === 'excelente' ? '#4CAF50' : 
                    signal.level === 'bom' ? '#8BC34A' : 
                    signal.level === 'médio' ? '#FFC107' : '#F44336'
                  } 
                />
                <Text style={styles.signalText}>{signal.level}</Text>
              </View>
              {device.lastConnected && (
                <View style={styles.lastConnectedContainer}>
                  <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                  <Text style={styles.lastConnectedText}>
                    Conectado recentemente
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.deviceActions}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                isConnected ? styles.disconnectButton : styles.connectButton,
                (pressed || isConnecting) && styles.actionButtonPressed
              ]}
              onPress={() => isConnected ? handleDisconnect(device) : handleConnect(device)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons 
                    name={isConnected ? 'close-circle' : 'bluetooth'}
                    size={16} 
                    color="#ffffff" 
                    style={styles.buttonIcon} 
                  />
                  <Text style={styles.actionButtonText}>
                    {isConnected ? 'Desconectar' : 'Conectar'}
                  </Text>
                </>
              )}
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.infoButton,
                pressed && styles.infoButtonPressed
              ]}
              onPress={() => showDeviceInfo(device)}
            >
              <Ionicons name="information-circle" size={16} color="#1E88E5" />
              <Text style={[styles.actionButtonText, { color: '#1E88E5' }]}>
                Detalhes
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };
  
  const handleDisconnect = (device) => {
    handleVibrate('light');
    disconnectFromDevice();
  };
  
  const showDeviceInfo = (device) => {
    handleVibrate('light');
    Alert.alert(
      'Informações do Dispositivo',
      `Nome: ${device.name}\n` +
      `Porta: ${device.port}\n` +
      `Tipo: ${device.type || 'WACS Kit'}\n` +
      `Status: ${isConnected && connectedDevice?.id === device.id ? 'Conectado' : 'Desconectado'}\n\n` +
      'Este é um dispositivo de automação WACS para controle de acessibilidade.'
    );
  };

  const renderContent = () => {
    return (
      <View style={{ flex: 1 }}>
        {/* Aviso de Simulação */}
        <View style={styles.disclaimerContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#00529B" />
          <Text style={styles.disclaimerText}>
            Esta é uma simulação. A busca e conexão de dispositivos são apenas para demonstração.
          </Text>
        </View>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#1E88E5']}
              tintColor="#1E88E5"
            />
          }
        >
          {isScanning && devices.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E88E5" />
              <Text style={styles.loadingText}>Procurando dispositivos...</Text>
              <Text style={styles.loadingSubtext}>Isso pode levar alguns segundos</Text>
            </View>
          ) : devices.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Dispositivos Encontrados</Text>
                <Text style={styles.deviceCount}>{devices.length} dispositivo{devices.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.devicesList}>
                {devices.map(renderDevice)}
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="bluetooth" size={64} color="#E5E7EB" />
                <View style={styles.emptyIconOverlay}>
                  <Ionicons name="search" size={24} color="#9CA3AF" />
                </View>
              </View>
              <Text style={styles.emptyText}>Nenhum dispositivo encontrado</Text>
              <Text style={styles.emptySubtext}>
                Certifique-se de que sua cadeira está ligada, próxima e no modo de pareamento
              </Text>
              
              <Pressable
                style={({ pressed }) => [
                  styles.scanAgainButton,
                  pressed && styles.scanAgainButtonPressed
                ]}
                onPress={handleScan}
                disabled={isScanning}
              >
                <Ionicons 
                  name="refresh" 
                  size={20} 
                  color="#1E88E5" 
                  style={styles.scanAgainIcon} 
                />
                <Text style={styles.scanAgainText}>
                  {isScanning ? 'Buscando...' : 'Buscar Novamente'}
                </Text>
              </Pressable>
            </View>
          )}
          
          {devices.length > 0 && (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {isScanning 
                  ? 'Buscando por mais dispositivos...' 
                  : 'Arraste para baixo para atualizar a lista'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E88E5', '#1976D2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable 
            onPress={() => {
              handleVibrate('light');
              navigation.goBack();
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed
            ]}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          
          <View style={styles.headerTitleContainer}>
            <Ionicons name="bluetooth" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.headerTitle}>Conectar Dispositivo</Text>
          </View>
          
          {/* Espaço vazio para manter o alinhamento */}
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>
      
      {renderContent()}
      
      {devices.length > 0 && (
        <View style={styles.fabContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed
            ]}
            onPress={handleScan}
            disabled={isScanning}
          >
            <Ionicons 
              name={isScanning ? 'refresh' : 'refresh-outline'} 
              size={24} 
              color="#ffffff" 
            />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef7ff',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  disclaimerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#00529B',
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 24,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
  backButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.95 }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    minWidth: 100,
  },
  scanIcon: {
    marginRight: 6,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  scanButtonDisabled: {
    opacity: 0.7,
  },
  scanButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  emptyIconOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#f8f9fa',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 26,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(30, 136, 229, 0.2)',
  },
  scanAgainButtonPressed: {
    backgroundColor: 'rgba(30, 136, 229, 0.15)',
  },
  scanAgainIcon: {
    marginRight: 8,
  },
  scanAgainText: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
  },
  deviceCount: {
    fontSize: 14,
    color: '#9CA3AF',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  devicesList: {
    paddingHorizontal: 16,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  deviceCardSelected: {
    borderColor: '#1E88E5',
    backgroundColor: '#f5f9ff',
    shadowColor: '#1E88E5',
    shadowOpacity: 0.1,
  },
  deviceCardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deviceIconContainer: {
    position: 'relative',
    backgroundColor: '#f0f7ff',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#4CAF50',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  deviceInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  devicePort: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 4,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginHorizontal: 8,
  },
  lastConnectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lastConnectedText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 120,
  },
  connectButton: {
    backgroundColor: '#1E88E5',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  infoButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
    minWidth: 100,
  },
  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  infoButtonPressed: {
    backgroundColor: '#f9fafb',
  },
  buttonIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  signalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  signalText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#166534',
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#1E88E5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  connectButtonPressed: {
    backgroundColor: '#1976D2',
    transform: [{ scale: 0.98 }],
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  scanButtonPressed: {
    backgroundColor: '#1565C0',
    transform: [{ scale: 0.98 }],
  },
  scanButtonDisabled: {
    backgroundColor: '#90CAF9',
    opacity: 0.8,
  },
  scanButtonGradient: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  scanningIcon: {
    transform: [{ rotate: '45deg' }],
  },
  bluetoothWarning: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  bluetoothWarningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  openSettingsButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
  },
  openSettingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
    marginLeft: 12,
  },
  connectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 12,
  },
});