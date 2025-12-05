import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useBluetooth } from '../contexts/BluetoothContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserGamificationData, getLevelNameAndReward } from '../services/gamification';
import { getSeenPosts, saveSeenPosts } from '../utils/storage';
import { fetchPostsPaginated } from '../services/firebase/posts';

const { width } = Dimensions.get('window');

export const MainSelectionScreen = () => {
  const scrollViewRef = useRef(null);
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const {
    isConnected,
    isConnecting,
    deviceInfo,
    batteryLevel,
    connectionStrength,
    disconnectFromDevice,
    speedMode,
    isLocked,
    SPEED_MODES,
  } = useBluetooth();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-50));
  const [gamification, setGamification] = useState({ xp: 0, level: 1, badges: [] });
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [connectBlinkAnim] = useState(new Animated.Value(1));
  const [showAllNews, setShowAllNews] = useState(false);
  const levelInfo = useMemo(() => getLevelNameAndReward(gamification.level || 1), [gamification.level]);

  // Função para limitar o nome do usuário a 2 palavras
  const getShortName = (fullName) => {
    if (!fullName) return 'Usuário';
    const words = fullName.trim().split(' ');
    return words.slice(0, 2).join(' ');
  };

  const triggerConnectBlink = useCallback(() => {
    // Pisca o botão de conectar algumas vezes
    Animated.loop(
      Animated.sequence([
        Animated.timing(connectBlinkAnim, { toValue: 0.4, duration: 180, useNativeDriver: true }),
        Animated.timing(connectBlinkAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();
  }, [connectBlinkAnim]);

  useEffect(() => {
    // Animação de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Atualiza gamification sempre que a tela ganha foco
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        getUserGamificationData(user.id).then(setGamification);
      }
    }, [user?.id])
  );

  // Função para verificar se há novos posts não vistos
  const checkNewPosts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { posts } = await fetchPostsPaginated({ pageSize: 10 });
      const seen = await getSeenPosts(user.id);
      const unseen = posts.filter(p => !seen.includes(p.id));
      setHasNewPosts(unseen.length > 0);
    } catch (e) {
      setHasNewPosts(false);
    }
  }, [user?.id]);

  // Atualiza badge ao focar ou trocar usuário
  useFocusEffect(
    React.useCallback(() => {
      checkNewPosts();
    }, [user?.id])
  );

  // Ao entrar na tela de comunidade, marca todos os posts atuais como vistos
  const handleCommunityPress = useCallback(async () => {
    navigation.navigate('SocialScreen');
    try {
      const { posts } = await fetchPostsPaginated({ pageSize: 10 });
      const ids = posts.map(p => p.id);
      await saveSeenPosts(user.id, ids);
      setHasNewPosts(false);
    } catch { }
  }, [navigation, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      user?.id ? getUserGamificationData(user.id).then(d => d && setGamification(d)).catch(() => { }) : Promise.resolve(),
      checkNewPosts(),
    ]);
    setRefreshing(false);
  }, [user?.id, checkNewPosts]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Confirmar Logout',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Desconectar Bluetooth antes de deslogar, se conectado
              await logout();
            } catch (error) {
              console.error('Erro ao deslogar:', error);
              Alert.alert('Erro', 'Não foi possível fazer logout');
            }
          },
        },
      ]
    );
  }, [logout]);

  const handleQuickConnect = useCallback(async () => {
    if (isConnected) {
      // Se já conectado, pergunta se quer desconectar (usando a função do contexto)
      Alert.alert(
        'Desconectar',
        `Deseja desconectar a cadeira de rodas${deviceInfo?.name ? ' (' + deviceInfo.name + ')' : ''}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desconectar',
            style: 'destructive',
            onPress: disconnectFromDevice, // Usa a função de desconectar do contexto
          },
        ]
      );
    } else if (isConnecting) {
      Alert.alert('Aguarde', 'Já está conectando à cadeira de rodas...');
    } else {
      // Se não conectado, navega para a tela de conexão
      navigation.navigate('ConnectionScreen');
    }
  }, [isConnected, isConnecting, deviceInfo, disconnectFromDevice, navigation]);

  const getTimeGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const getConnectionIcon = () => {
    if (isConnecting) return 'bluetooth';
    if (!isConnected) return 'bluetooth-outline';
    return connectionStrength === 'strong' ? 'bluetooth' : 'bluetooth-outline';
  };

  const getConnectionColor = () => {
    if (isConnecting) return '#FF9800';
    if (!isConnected) return '#F44336';
    return connectionStrength === 'strong' ? '#4CAF50' : '#FF9800';
  };

  const getBatteryIcon = () => {
    if (batteryLevel > 80) return 'battery-full-outline';
    if (batteryLevel > 50) return 'battery-half-outline';
    if (batteryLevel > 20) return 'battery-dead-outline';
    return 'battery-dead-outline'; // Ícone para bateria baixa/desconectado
  };

  const getBatteryColor = () => {
    if (batteryLevel > 50) return '#4CAF50';
    if (batteryLevel > 20) return '#FF9800';
    return '#F44336';
  };

  const getLevelColor = (level) => {
    if (level >= 10) return '#8e24aa'; // Roxo
    if (level >= 7) return '#1976d2'; // Azul
    if (level >= 5) return '#FFD700'; // Ouro
    if (level >= 3) return '#B0BEC5'; // Prata
    return '#CD7F32'; // Bronze
  };

  const quickActions = useMemo(() => [
    {
      id: 'control',
      title: 'Controle',
      icon: 'game-controller-outline',
      onPress: () => {
        // Criando uma cópia serializada do deviceInfo, convertendo Date para string
        const serializedDeviceInfo = deviceInfo ? {
          ...deviceInfo,
          lastConnected: deviceInfo.lastConnected ? deviceInfo.lastConnected.toISOString() : null
        } : null;

        navigation.navigate('ControlScreen', { deviceInfo: serializedDeviceInfo });
      },
      disabled: !isConnected,
      gradient: ['#1976d2', '#2196f3'],
    },
    {
      id: 'map',
      title: 'Mapa',
      icon: 'map-outline',
      onPress: () => navigation.navigate('MapScreen'),
      gradient: ['#1976d2', '#2196f3'],
    },
    {
      id: 'community',
      title: 'Comunidade',
      icon: 'chatbubble-ellipses-outline',
      onPress: handleCommunityPress,
      gradient: ['#1976d2', '#2196f3'],
    },
    {
      id: 'locations',
      title: 'Locais',
      icon: 'location-outline',
      onPress: () => navigation.navigate('LocationsListScreen'),
      gradient: ['#1976d2', '#2196f3'],
    },
  ], [navigation, handleCommunityPress, deviceInfo, isConnected]);

  const newsItems = useMemo(() => [
    {
      id: '1',
      text: 'Use o modo Indoor em ambientes fechados para maior autonomia',
      type: 'tip',
      time: 'Agora'
    },
    {
      id: '2',
      text: 'Mantenha a bateria acima de 20% para evitar desligamentos',
      type: 'tip',
      time: 'Importante'
    },
    {
      id: '3',
      text: 'Modo Outdoor oferece mais potência para terrenos irregulares',
      type: 'feature',
      time: 'Dica'
    },
    {
      id: '4',
      text: 'Pressione e segure o joystick para travar/destravar a cadeira',
      type: 'tip',
      time: 'Útil'
    },
    {
      id: '5',
      text: 'Verifique o sinal de conexão antes de usar em áreas abertas',
      type: 'tip',
      time: 'Segurança'
    },
  ], []);

  const getNewsIcon = (type) => {
    switch (type) {
      case 'update': return 'download-outline';
      case 'tip': return 'bulb-outline';
      case 'feature': return 'star-outline';
      default: return 'information-circle-outline';
    }
  };

  const renderQuickAction = (action) => (
    <Pressable
      key={action.id}
      style={[
        styles.quickActionButton,
        action.disabled && styles.quickActionDisabled
      ]}
      onPress={() => {
        if (!action.disabled) {
          action.onPress();
        } else if (action.id === 'control' && !isConnected) {
          // Rola para a seção de conexão e pisca o botão
          scrollViewRef.current?.scrollTo({ y: 400, animated: true });
          triggerConnectBlink();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={action.title}
    >
      <LinearGradient
        colors={action.disabled ? ['#e0e0e0', '#bdbdbd'] : action.gradient}
        style={styles.quickActionGradient}
      >
        <Ionicons
          name={action.icon}
          size={28}
          color={action.disabled ? '#9e9e9e' : '#fff'}
        />
        <Text style={[
          styles.quickActionText,
          action.disabled && styles.quickActionTextDisabled
        ]}>
          {action.title}
        </Text>
        {/* Badge de novos posts */}
        {action.id === 'community' && hasNewPosts && (
          <View style={styles.newPostsBadge}>
            <Ionicons name="ellipse" size={14} color="#E53935" />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header com gradiente */}
      <LinearGradient
        colors={['#1976d2', '#2196f3']}
        style={styles.headerGradient}
      >
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.profileSection}>
            <Pressable
              onPress={() => navigation.navigate('UserProfileScreen')}
              style={styles.profileImageContainer}
            >
              <View>
                {user?.photoURL ? (
                  <Image source={{ uri: user.photoURL }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="person" size={30} color="#1976d2" />
                  </View>
                )}
                {/* Badge de nível na foto */}
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: getLevelColor(gamification.level),
                  borderWidth: 2,
                  borderColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3,
                }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{gamification.level}</Text>
                </View>
              </View>
            </Pressable>
            <View style={styles.greetingContainer}>
              <Text style={styles.timeGreeting}>{getTimeGreeting()},</Text>
              <Text style={styles.userName}>{getShortName(user?.name)}!</Text>
              <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 15, marginTop: 2 }}>
                {levelInfo.name} - {gamification.xp} XP
              </Text>
            </View>
            {/* Ícone de notificação à direita */}
            <Pressable
              onPress={handleLogout}
              style={{ marginLeft: 'auto', padding: 8 }}
              accessibilityLabel="Sair"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={28} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Ações Rápidas - AGORA ACIMA DO CARD DA CADEIRA */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map(renderQuickAction)}
        </View>
      </View>

      {/* Status da Cadeira - Card Moderno (MENOR) */}
      <View style={[
        styles.statusCard,
        !isConnected && styles.statusCardDisconnected
      ]}>
        <View style={styles.statusHeader}>
          <View style={styles.statusTitleContainer}>
            <View style={[
              styles.connectionIndicator,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
            ]} />
            <Text style={styles.statusTitle}>Cadeira de Rodas</Text>
          </View>
          {/* Botão Quick Connect (ícone bluetooth) - Agora também usado para desconectar */}
          <Pressable onPress={handleQuickConnect} style={styles.quickConnectButton}>
            <Ionicons
              name={getConnectionIcon()}
              size={16}
              color={getConnectionColor()}
            />
            {isConnecting && (
              <Text style={[styles.connectingText, { fontSize: 12 }]}>Conectando...</Text>
            )}
          </Pressable>
        </View>

        {isConnected ? (
          <View style={styles.connectedInfo}>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons
                  name={getBatteryIcon()}
                  size={18}
                  color={getBatteryColor()}
                />
                <Text style={styles.infoLabel}>Bateria</Text>
                <Text style={[styles.infoValue, { color: getBatteryColor() }]}>
                  {Math.round(batteryLevel)}%
                </Text>
              </View>

              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Ionicons
                  name={SPEED_MODES[speedMode]?.icon || 'speedometer-outline'}
                  size={22}
                  color={SPEED_MODES[speedMode]?.themeColors[0] || '#1976d2'}
                />
                <Text style={styles.infoLabel}>Modo</Text>
                <Text style={styles.infoValue}>{SPEED_MODES[speedMode]?.label || 'N/A'}</Text>
              </View>

              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Ionicons
                  name={
                    connectionStrength === 'strong' ? 'wifi' :
                      connectionStrength === 'medium' ? 'wifi-outline' :
                        'wifi-outline'
                  }
                  size={22}
                  color={
                    connectionStrength === 'strong' ? '#22c55e' :
                      connectionStrength === 'medium' ? '#FF9800' :
                        '#ef4444'
                  }
                />
                <Text style={styles.infoLabel}>Sinal</Text>
                <Text style={[
                  styles.infoValue,
                  {
                    color: connectionStrength === 'strong' ? '#22c55e' :
                      connectionStrength === 'medium' ? '#FF9800' :
                        '#ef4444'
                  }
                ]}>
                  {connectionStrength === 'strong' ? 'Forte' :
                    connectionStrength === 'medium' ? 'Médio' :
                      'Fraco'}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.connectButton}
              onPress={() => navigation.navigate('ConnectionScreen')}
            >
              <LinearGradient
                colors={['#1976d2', '#2196f3']}
                style={styles.connectButtonGradient}
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <Text style={styles.connectButtonText}>Configurar Conexão</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.disconnectedInfo}>
            {/* Mostrar ícone de buscando se estiver conectando */}
            {isConnecting ? (
              <Ionicons name="bluetooth" size={36} color="#FF9800" />
            ) : (
              <Ionicons name="bluetooth-outline" size={48} color="#adb5bd" />
            )}
            <Text style={styles.disconnectedText}>
              {isConnecting ? 'Conectando...' : 'Cadeira não conectada'}
            </Text>
            <Text style={styles.disconnectedSubtext}>
              {isConnecting ? 'Aguarde a conexão ser estabelecida' : 'Toque no botão abaixo para conectar'}
            </Text>
            {/* Botão Conectar Cadeira aparece quando desconectado */}
            {!isConnecting && (
              <Pressable
                style={styles.connectButton}
                onPress={() => navigation.navigate('ConnectionScreen')}
              >
                <Animated.View style={[styles.connectButtonAnimated, { opacity: connectBlinkAnim, transform: [{ scale: connectBlinkAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.98, 1] }) }] }]}>
                  <LinearGradient
                    colors={['#1976d2', '#2196f3']}
                    style={styles.connectButtonGradient}
                  >
                    <Ionicons name="bluetooth-outline" size={16} color="#fff" />
                    <Text style={styles.connectButtonText}>Conectar Cadeira</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Notícias e Dicas */}
      <View style={styles.newsContainer}>
        <View style={styles.newsTitleContainer}>
          <Ionicons name="newspaper-outline" size={20} color="#333" />
          <Text style={styles.sectionTitle}>Notícias & Dicas</Text>
        </View>

        {(showAllNews ? newsItems : newsItems.slice(0, 2)).map((item) => (
          <View key={item.id} style={styles.newsItem}>
            <Ionicons
              name={getNewsIcon(item.type)}
              size={20}
              color="#1976d2"
            />
            <View style={styles.newsContent}>
              <Text style={styles.newsText}>{item.text}</Text>
              <Text style={styles.newsTime}>{item.time}</Text>
            </View>
          </View>
        ))}

        {/* Botão Ver Mais */}
        {newsItems.length > 2 && (
          <Pressable
            style={styles.seeMoreButton}
            onPress={() => setShowAllNews(!showAllNews)}
          >
            <Text style={styles.seeMoreText}>
              {showAllNews ? 'Ver menos' : `Ver mais (${newsItems.length - 2})`}
            </Text>
            <Ionicons
              name={showAllNews ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#1976d2"
            />
          </Pressable>
        )}
      </View>


    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerGradient: {
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    marginRight: 15,
  },
  profileImage: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  greetingContainer: {
    flex: 1,
  },
  timeGreeting: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  logoutButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statusCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  statusCardDisconnected: {
    backgroundColor: '#f8f9fa',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quickConnectButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF9800',
  },
  connectedInfo: {
    alignItems: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#343a40',
  },
  infoDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#e9ecef',
  },
  connectButton: {
    marginTop: 20,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  connectButtonGradient: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disconnectedInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  disconnectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
    marginTop: 16,
  },
  disconnectedSubtext: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginLeft: 5,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: (width - 60) / 2,
    marginBottom: 15,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionDisabled: {
    opacity: 0.6,
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  quickActionTextDisabled: {
    color: '#9e9e9e',
  },
  newsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  newsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  newsItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  newsContent: {
    flex: 1,
    marginLeft: 12,
  },
  newsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  newsTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#d0e7ff',
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginRight: 6,
  },
  activityContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  newPostsBadge: {
    position: 'absolute',
    top: 10,
    right: 18,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
});