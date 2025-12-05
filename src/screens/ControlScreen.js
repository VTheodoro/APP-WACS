import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  useDerivedValue,
  interpolate,
  Extrapolate,
  useSharedValue as useRNSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// Removido Bluetooth; usaremos apenas serial via HTTP
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { sendToArduino } from '../services/arduinoHttp';
import { useBluetooth } from '../contexts/BluetoothContext';

const JOYSTICK_SIZE = 340;
const STICK_SIZE = 120;
const MAX_DISTANCE = (JOYSTICK_SIZE - STICK_SIZE) / 2;

export const ControlScreen = () => {
  // Estados principais - Usados para a UI do React, sincronizados com shared values quando necessário
  const { speedMode, setSpeedMode, isLocked, setIsLocked, SPEED_MODES } = useBluetooth();
  const [isEmergency, setIsEmergency] = useState(false);
  const currentSpeed = useSharedValue(0);
  const [isPressingLock, setIsPressingLock] = useState(false);
  const { width } = useWindowDimensions();
  const joystickScale = Math.max(0.8, Math.min(1.1, width / 420));

  // Refs - Usados para valores persistentes que não causam re-renderização
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const joystickRef = useRef(null);
  const longPressTimer = useRef(null);
  const speedUpdateTimer = useRef(null);
  const sessionStartTime = useRef(Date.now()); // Adicionado ref para o tempo de início da sessão

  // Shared values - Sincronizados com os estados regulares quando sua mudança precisa ser lida no worklet
  const isLockedShared = useSharedValue(false);
  const speedModeShared = useSharedValue('manual');
  const maxSpeedShared = useSharedValue(10);

  // Derived value para calcular a velocidade em tempo real e atualizar o shared value
  useDerivedValue(() => {
    const distance = Math.sqrt(translateX.value ** 2 + translateY.value ** 2);
    const normalizedDistance = distance / MAX_DISTANCE;
    currentSpeed.value = normalizedDistance * maxSpeedShared.value;
  });

  // Estado de exibição para maxSpeed, sincronizado para mostrar na UI regular
  const [displayMaxSpeed, setDisplayMaxSpeed] = useState(10);

  // Estado para exibir a velocidade do gauge sem acessar .value no render
  const [displaySpeed, setDisplaySpeed] = useState('0.0');
  useDerivedValue(() => {
    runOnJS(setDisplaySpeed)(currentSpeed.value.toFixed(1));
  }, [currentSpeed]);

  // Importar informações do contexto Bluetooth
  const {
    batteryLevel,
    connectionStrength,
    systemTemperature,
    deviceInfo: contextDeviceInfo,
  } = useBluetooth();

  // Estados de conexão (mantidos para compatibilidade com o código existente)
  const isConnected = true;
  const isConnecting = false;
  const deviceInfo = contextDeviceInfo || { name: 'Kit WACS (Simulado)' };

  const navigation = useNavigation();
  const route = useRoute();
  const mockMode = route.params?.mockMode === true;
  const mockDeviceName = 'WACS Falcon-1';

  // Nenhuma conexão extra necessária para o envio simples via HTTP

  // Configuração para redirecionar para a tela inicial ao tentar voltar
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Previne a ação padrão de voltar apenas se não for uma navegação programática
      if (e.data.action.type !== 'NAVIGATE') {
        e.preventDefault();

        // Navega para a tela inicial em vez da tela anterior
        navigation.navigate('MainSelection');
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Sincroniza shared values com estados regulares do React
  useEffect(() => {
    isLockedShared.value = isLocked;
  }, [isLocked]);

  useEffect(() => {
    speedModeShared.value = speedMode;
    const speedLimits = {
      'eco': 6, // Indoor: limite reduzido
      'sport': 12, // Outdoor: limite maior
      'manual': 20 // Manual: velocidade máxima
    };
    maxSpeedShared.value = speedLimits[speedMode];
    runOnJS(setDisplayMaxSpeed)(speedLimits[speedMode]); // Sincroniza estado regular para exibição
  }, [speedMode, speedModeShared, maxSpeedShared]); // Adicionado shared values como dependência

  // Derived value para calcular o percentual da velocidade para o gauge
  const speedPercentage = useDerivedValue(() => {
    // Garante que a divisão não seja por zero e lida com valores negativos (embora improvável para velocidade)
    const maxSpd = maxSpeedShared.value > 0 ? maxSpeedShared.value : 1;
    const percentage = (currentSpeed.value / maxSpd) * 100;
    return interpolate(percentage, [0, 100], [0, 100], Extrapolate.CLAMP);
  });

  // Animated style para o preenchimento do gauge
  const speedGaugeFillStyle = useAnimatedStyle(() => {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (speedPercentage.value / 100) * circumference;
    const themeColor = SPEED_MODES[speedModeShared.value]?.themeColors[0] || '#1976d2';

    return {
      strokeDashoffset,
      borderColor: themeColor,
    };
  });

  // Estados sincronizados com shared values para uso no JSX
  const [isLockedSharedState, setIsLockedSharedState] = useState(false);
  useDerivedValue(() => {
    runOnJS(setIsLockedSharedState)(isLockedShared.value);
  }, [isLockedShared]);

  const [scrollLocked, setScrollLocked] = useState(false);
  // Animação para overlay de scroll travado
  const scrollLockAnim = useRNSharedValue(0);
  useEffect(() => {
    scrollLockAnim.value = withTiming(scrollLocked ? 1 : 0, { duration: 350 });
  }, [scrollLocked]);
  const scrollLockOverlayStyle = useAnimatedStyle(() => ({
    opacity: scrollLockAnim.value,
    transform: [{ translateY: interpolate(scrollLockAnim.value, [0, 1], [40, 0]) }],
    pointerEvents: scrollLockAnim.value > 0.1 ? 'auto' : 'none',
  }));

  // --- JOYSTICK: ENVIO DE COMANDOS --- //
  // Armazena último comando enviado para evitar repetição
  const lastJoystickCommand = useRef('S');
  const lastSentPower = useRef(0);

  const handleGestureEvent = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      if (!(isConnected || mockMode) || isLockedSharedState || isEmergency) {
        return;
      }
      ctx.offsetX = translateX.value;
      ctx.offsetY = translateY.value;
      // Travar scroll automaticamente ao iniciar joystick
      if (!scrollLocked) runOnJS(setScrollLocked)(true);
      // Não enviar comandos no início do joystick
    },
    onActive: (event, ctx) => {
      if (!(isConnected || mockMode) || isLockedSharedState || isEmergency) {
        return;
      }
      const newTranslateX = event.translationX + ctx.offsetX;
      const newTranslateY = event.translationY + ctx.offsetY;
      const distance = Math.sqrt(newTranslateX * newTranslateX + newTranslateY * newTranslateY);
      if (distance <= MAX_DISTANCE) {
        translateX.value = newTranslateX;
        translateY.value = newTranslateY;
      } else {
        const angle = Math.atan2(newTranslateY, newTranslateX);
        translateX.value = Math.cos(angle) * MAX_DISTANCE;
        translateY.value = Math.sin(angle) * MAX_DISTANCE;
      }
      const normalizedX = translateX.value / MAX_DISTANCE;
      const normalizedY = translateY.value / MAX_DISTANCE;
      // Não enviar comandos de direção ou potência por enquanto
      // Mantemos apenas a atualização visual do joystick/velocidade local
    },
    onEnd: () => {
      if (!(isConnected || mockMode) || isLockedSharedState || isEmergency) {
        return;
      }
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      // Destrava o scroll ao soltar o joystick
      runOnJS(setScrollLocked)(false);
      currentSpeed.value = 0;
      // Não enviar comandos de parada/direção pela finalização do joystick
      lastJoystickCommand.current = 'S';
      lastSentPower.current = 0;
      // Não enviar comandos ao finalizar o joystick
    },
  });

  const stickAnimatedStyle = useAnimatedStyle(() => {
    const themeColor = SPEED_MODES[speedModeShared.value]?.themeColors[0] || '#1976d2';
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      backgroundColor: isLockedSharedState ? '#bdbdbd' : themeColor,
      opacity: 1,
    };
  });

  // Função auxiliar para formatar tempo (não precisa ser memoizada ou workletizada para este uso)
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para calcular autonomia estimada baseada na bateria e modo
  const calculateEstimatedAutonomy = (batteryPercent, mode) => {
    if (batteryPercent <= 0) return '0h 0m';

    // Autonomia base em minutos para 100% de bateria
    const baseAutonomyMinutes = {
      'eco': 240,    // 4 horas no modo Indoor (mais econômico)
      'sport': 120,  // 2 horas no modo Outdoor (mais potente)
      'manual': 180  // 3 horas no modo Manual (médio)
    };

    const totalMinutes = Math.floor((batteryPercent / 100) * baseAutonomyMinutes[mode]);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  };

  const handleSpeedModeChange = (mode) => {
    // Usar estados regulares do React para lógica UI/vibração
    if (!(isConnected || mockMode) || isLocked || isEmergency) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSpeedMode(mode);
    // maxSpeedShared.value é atualizado no useEffect quando speedMode muda
  };

  const handleLockToggle = () => {
    // Usar estados regulares do React para lógica UI/vibração
    if (!(isConnected || mockMode) || isEmergency) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const newState = !isLocked;
    setIsLocked(newState); // Atualiza o estado regular do React, que sincroniza o shared value via useEffect
    Haptics.impactAsync(newState ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);

    if (newState) {
      // Resetar joystick e velocidade no worklet
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      currentSpeed.value = 0; // Reseta o shared value
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Desconectar Cadeira',
      'Tem certeza que deseja desconectar a cadeira?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar', style: 'destructive', onPress: () => {
            navigation.navigate('MainSelection');
          }
        }
      ]
    );
  };

  const renderSpeedGauge = () => {
    const circumference = 2 * Math.PI * 45;
    const strokeDasharray = circumference;
    return (
      <View style={styles.speedGaugeContainer}>
        <View style={styles.speedGauge}>
          <View style={styles.speedGaugeBackground} />
          <Animated.View style={[
            styles.speedGaugeFill,
            speedGaugeFillStyle,
            {
              strokeDasharray: circumference,
            }
          ]} />
          <View style={styles.speedGaugeText}>
            <Text style={styles.speedGaugeValue}>{displaySpeed}</Text>
            <Text style={styles.speedGaugeUnit}>km/h</Text>
          </View>
        </View>
      </View>
    );
  };

  // Definir cores dinâmicas conforme estado de bloqueio/freio
  const isBlocked = isLocked || isEmergency;
  const themeColors = SPEED_MODES[speedMode]?.themeColors || ['#1976d2', '#2196f3'];
  const headerColors = isBlocked ? ['#bdbdbd', '#9e9e9e'] : themeColors;
  const joystickBgColor = isBlocked ? '#f3f4f6' : '#fff';
  const mainContentBg = isBlocked ? '#f3f4f6' : '#fff';

  // Feedback háptico ao travar/destravar scroll
  useEffect(() => {
    if (scrollLocked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [scrollLocked]);

  // Feedback ao entrar/sair do modo de emergência
  useEffect(() => {
    if (isEmergency) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Trava a cadeira automaticamente
      setIsLocked(true);
    }
  }, [isEmergency]);

  // --- VELOCIDADE: ENVIO DE COMANDO --- //
  useEffect(() => {
    // Sempre que displayMaxSpeed mudar, envia comando de velocidade
    if (!isLocked && !isEmergency) {
      const v = Math.round((displayMaxSpeed / 10) * 255); // 0-10 para 0-255
      sendToArduino(`V${v}`);
    }
  }, [displayMaxSpeed, isLocked, isEmergency]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={headerColors}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Controle da Cadeira
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {SPEED_MODES[speedMode]?.label || 'Manual'} • {displayMaxSpeed} km/h
            </Text>
          </View>

          <View style={styles.headerIconsContainer}>
            {isEmergency && (
              <Ionicons
                name="alert-circle"
                size={24}
                color="#FFD700" // Amarelo para destaque
                style={styles.headerIcon}
              />
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollViewContent} scrollEnabled={!scrollLocked}>
        <View style={styles.mainContentArea}>
          {/* Removed Arduino server controls (WebSocket UI) - reverted to original behavior */}
          {/* Fundo dinâmico para área principal */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: mainContentBg, zIndex: -1, borderRadius: 20 }} pointerEvents="none" />
          {/* Joystick Area */}
          <View style={[styles.joystickArea, { backgroundColor: joystickBgColor }]}>
            {/* Botão de Emergência */}
            <Pressable
              onPress={() => {
                if (!isEmergency) {
                  Alert.alert(
                    'Ativar Emergência',
                    'Isso irá travar a cadeira imediatamente e iniciar o contato com o seu contato de emergência. Deseja continuar?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Ativar', style: 'destructive', onPress: () => setIsEmergency(true) }
                    ]
                  );
                }
              }}
              style={[
                styles.emergencyButton,
                isEmergency && styles.emergencyButtonActive
              ]}
              accessibilityLabel={isEmergency ? 'Emergência ativa' : 'Ativar emergência'}
              accessibilityHint={isEmergency ? 'Contato de emergência em andamento' : 'Trava a cadeira e inicia contato com seu contato de emergência'}
            >
              <Ionicons
                name={isEmergency ? 'alert' : 'alert-circle'}
                size={28}
                color={isEmergency ? '#fff' : '#b91c1b'}
              />
            </Pressable>
            {isEmergency && (
              <View style={{ marginTop: 8, backgroundColor: '#fee2e2', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                <Text style={{ color: '#991b1b', fontWeight: 'bold', fontSize: 14 }}>
                  Modo de emergência ativado
                </Text>
              </View>
            )}

            {/* Joystick */}
            <View style={[styles.joystickContainer, { transform: [{ scale: joystickScale }] }]}>
              <View style={styles.joystickBase}>
                <Pressable
                  onLongPress={handleLockToggle}
                  delayLongPress={500}
                  style={styles.pressableStickArea}
                  onPressIn={() => setIsPressingLock(true)}
                  onPressOut={() => setIsPressingLock(false)}
                >
                  <PanGestureHandler
                    onGestureEvent={handleGestureEvent}
                    enabled={!isLockedSharedState && !isEmergency}
                  >
                    <Animated.View style={[styles.joystickStick, stickAnimatedStyle]}>
                      {isPressingLock && (
                        <Text style={styles.lockStatusText}>
                          {isLocked ? '🔒' : '🔓'}
                        </Text>
                      )}
                    </Animated.View>
                  </PanGestureHandler>
                </Pressable>
              </View>
              <Text style={styles.joystickInstruction}>
                Mantenha pressionado para {isLocked ? 'destravar' : 'travar'}
              </Text>
            </View>

            {/* Speed Gauge */}
            {renderSpeedGauge()}


          </View>

          {/* Speed Modes */}
          <View style={styles.speedModesContainer}>
            <Text style={styles.sectionTitle}>Modos de Velocidade</Text>
            <View style={styles.speedModesGrid}>
              {Object.entries(SPEED_MODES).map(([key, mode]) => (
                <Pressable
                  key={key}
                  onPress={() => handleSpeedModeChange(key)}
                  disabled={isLocked || isEmergency}
                  style={({ pressed }) => [
                    styles.speedModeButton,
                    speedMode === key && [styles.speedModeButtonSelected, { borderColor: themeColors[0], backgroundColor: themeColors[0] + '1A' }],
                    (isLocked || isEmergency) && styles.speedModeButtonDisabled,
                    pressed && { backgroundColor: themeColors[0] + '33' }
                  ]}
                >
                  <View style={styles.speedModeContent}>
                    <Ionicons
                      name={mode.icon}
                      size={24}
                      color={speedMode === key ? themeColors[0] : '#6b7280'}
                    />
                    <View style={styles.speedModeTextContainer}>
                      <Text style={[
                        styles.speedModeLabel,
                        speedMode === key && [styles.speedModeLabelSelected, { color: themeColors[0] }]
                      ]} numberOfLines={1} ellipsizeMode="tail">
                        {mode.label}
                      </Text>
                      <Text style={styles.speedModeDescription} numberOfLines={1} ellipsizeMode="tail">
                        {mode.desc}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.speedModeCheckContainer}>
                    <Ionicons name="checkmark-circle" size={20} color={speedMode === key ? themeColors[0] : 'transparent'} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* System Information */}
          <View style={styles.systemInfoContainer}>
            <Text style={styles.sectionTitle}>Informações do Sistema</Text>

            {/* Battery and Autonomy */}
            <View style={styles.systemInfoGrid}>
              <View style={styles.systemInfoCard}>
                <View style={styles.systemInfoHeader}>
                  <Ionicons name="battery-charging" size={20} color="#22c55e" />
                  <Text style={styles.systemInfoLabel}>Bateria</Text>
                </View>
                <Text style={styles.systemInfoValue}>{Math.round(batteryLevel)}%</Text>
                <View style={styles.batteryBar}>
                  <View
                    style={[
                      styles.batteryBarFill,
                      {
                        width: `${Math.round(batteryLevel)}%`,
                        backgroundColor: batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#ef4444'
                      }
                    ]}
                  />
                </View>
              </View>

              <View style={styles.systemInfoCard}>
                <View style={styles.systemInfoHeader}>
                  <Ionicons name="time-outline" size={20} color="#3b82f6" />
                  <Text style={styles.systemInfoLabel}>Autonomia</Text>
                </View>
                <Text style={styles.systemInfoValue}>
                  {calculateEstimatedAutonomy(batteryLevel, speedMode)}
                </Text>
                <Text style={styles.systemInfoSubtext}>Estimativa restante</Text>
              </View>
            </View>

            {/* Temperature and Signal */}
            <View style={styles.systemInfoGrid}>
              <View style={styles.systemInfoCard}>
                <View style={styles.systemInfoHeader}>
                  <Ionicons name="thermometer-outline" size={20} color="#f59e0b" />
                  <Text style={styles.systemInfoLabel}>Temperatura</Text>
                </View>
                <Text style={styles.systemInfoValue}>
                  {typeof systemTemperature === 'number' ? systemTemperature.toFixed(1) : '—'}°C
                </Text>
                <Text style={styles.systemInfoSubtext}>
                  {systemTemperature > 45 ? 'Alta' : systemTemperature > 35 ? 'Normal' : 'Baixa'}
                </Text>
              </View>

              <View style={styles.systemInfoCard}>
                <View style={styles.systemInfoHeader}>
                  <Ionicons
                    name={
                      connectionStrength === 'strong' ? 'wifi' :
                        connectionStrength === 'medium' ? 'wifi-outline' :
                          'wifi-outline'
                    }
                    size={20}
                    color={
                      connectionStrength === 'strong' ? '#22c55e' :
                        connectionStrength === 'medium' ? '#f59e0b' :
                          '#ef4444'
                    }
                  />
                  <Text style={styles.systemInfoLabel}>Sinal</Text>
                </View>
                <Text style={styles.systemInfoValue}>
                  {connectionStrength === 'strong' ? 'Forte' :
                    connectionStrength === 'medium' ? 'Médio' :
                      'Fraco'}
                </Text>
                <Text style={styles.systemInfoSubtext}>
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </Text>
              </View>
            </View>

            {/* Device Info */}
            {deviceInfo && (
              <View style={styles.deviceInfoCard}>
                <View style={styles.deviceInfoHeader}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#6b7280" />
                  <Text style={styles.deviceInfoLabel}>Dispositivo Conectado</Text>
                </View>
                <Text style={styles.deviceInfoName}>{deviceInfo.name || 'Kit WACS'}</Text>
              </View>
            )}
          </View>

        </View>
      </ScrollView >

      {/* Overlay animado indicando scroll travado */}
      < Animated.View pointerEvents="none" style={[styles.scrollLockOverlay, scrollLockOverlayStyle]} >
        <View style={styles.scrollLockOverlayContent}>
          <Ionicons name="lock-closed" size={38} color="#1976d2" style={{ marginBottom: 8 }} />
          <Text style={styles.scrollLockOverlayText}>Scroll travado</Text>
        </View>
      </Animated.View >

      {/* Overlay de Emergência */}
      {
        isEmergency && (
          <View style={styles.emergencyOverlay} accessibilityViewIsModal={true}>
            <View style={styles.emergencyOverlayContent}>
              <Ionicons name="alert" size={42} color="#ef4444" style={{ marginBottom: 8 }} />
              <Text style={styles.emergencyTitle}>Modo de Emergência</Text>
              <Text style={styles.emergencyMessage}>Contactando seu contato de emergência...</Text>
              <ActivityIndicator size="small" color="#ef4444" style={{ marginVertical: 12 }} />
              <Pressable
                style={styles.emergencyCancelButton}
                onPress={() => setIsEmergency(false)}
                accessibilityLabel="Cancelar emergência"
                accessibilityHint="Cancela o modo de emergência e destrava a interface"
              >
                <Text style={styles.emergencyCancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        )
      }

      {/* Botão flutuante para travar/destravar o scroll */}
      <Pressable
        style={[styles.fabLockScroll, scrollLocked && styles.fabLockScrollActive]}
        onPress={() => setScrollLocked((prev) => !prev)}
        accessibilityLabel={scrollLocked ? 'Destravar scroll' : 'Travar scroll'}
        disabled={isEmergency}
      >
        <Ionicons
          name={scrollLocked ? 'lock-closed' : 'lock-open'}
          size={28}
          color={scrollLocked ? '#fff' : '#1976d2'}
        />
      </Pressable>
    </GestureHandlerRootView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1976d2',
    borderBottomRightRadius: 25,
    borderBottomLeftRadius: 25,
    zIndex: 1,
    elevation: 4, // Sombra no Android
    shadowColor: '#000', // Sombra no iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  speedModeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
  },
  speedModeBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 16,
  },
  headerIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    opacity: 0.9,
  },
  mainContentArea: {
    gap: 16,
  },
  disconnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  disconnectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
  },
  connectButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  joystickArea: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emergencyButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  emergencyButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  emergencyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 20,
  },
  emergencyOverlayContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 420,
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
    textAlign: 'center',
  },
  emergencyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  emergencyCancelButton: {
    marginTop: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyCancelText: {
    color: '#b91c1b',
    fontWeight: '700',
    fontSize: 14,
  },
  joystickContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  joystickBase: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pressableStickArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickStick: {
    width: STICK_SIZE,
    height: STICK_SIZE,
    borderRadius: STICK_SIZE / 2,
    backgroundColor: '#42a5f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  lockStatusText: {
    fontSize: 24,
  },
  joystickInstruction: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  speedGaugeContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  speedGauge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  speedGaugeBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#e5e7eb',
  },
  speedGaugeFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 8,
    transform: [{ rotate: '-90deg' }],
  },
  speedGaugeText: {
    alignItems: 'center',
  },
  speedGaugeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  speedGaugeUnit: {
    fontSize: 12,
    color: '#6b7280',
  },
  speedModesContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  speedModesGrid: {
    gap: 12,
  },
  speedModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 68,
    width: '100%',
  },
  speedModeButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  speedModeButtonDisabled: {
    opacity: 0.5,
  },
  speedModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedModeIcon: {
    fontSize: 24,
    width: 28,
    lineHeight: 24,
    textAlign: 'center',
  },
  speedModeTextContainer: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  speedModeCheckContainer: {
    width: 24,
    alignItems: 'flex-end',
  },
  speedModeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
    includeFontPadding: false,
  },
  speedModeLabelSelected: {
    color: '#3b82f6',
    lineHeight: 20,
    includeFontPadding: false,
  },
  speedModeDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
    includeFontPadding: false,
  },
  fabLockScroll: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#1976d2',
    zIndex: 10,
  },
  fabLockScrollActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  scrollLockOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    alignItems: 'flex-start',
    zIndex: 10,
  },
  scrollLockOverlayContent: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 6,
  },
  scrollLockOverlayText: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 180,
  },
  // System Information Styles
  systemInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  systemInfoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  systemInfoCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  systemInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  systemInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  systemInfoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  systemInfoSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  batteryBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  batteryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  deviceInfoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  deviceInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  deviceInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  deviceInfoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});