import React, { useEffect, useRef, useState, useContext, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert, Dimensions, TextInput, FlatList, ScrollView, Image, StatusBar, Vibration, Animated } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLocations } from '../services/firebase/locations';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../components/common/AppHeader';
import SearchBar from '../components/SearchBar';
import CustomMarker from '../components/mapas/CustomMarker.js';
import AccessibleMarker from '../components/mapas/AccessibleMarker';
import AccessibilityIcons from '../components/mapas/AccessibilityIcons.js';
import LivePanel from '../components/mapas/LivePanel.js';
import AccessibleLocationDetailPanel from '../components/mapas/AccessibleLocationDetailPanel.js';
import { calculateDistance, decodePolyline, getManeuverIcon } from '../utils/mapUtils';
import MapSearchPanel from '../components/mapas/MapSearchPanel.js';
import { Share } from 'react-native';
import { fetchReviewsForLocation } from '../services/firebase/locations';
import { AuthContext } from '../contexts/AuthContext';
import UserMarker from '../components/mapas/UserMarker';
import useRoutePlanner from '../hooks/useRoutePlanner';
import RoutePlannerModal from '../components/mapas/RoutePlannerModal';
import useMapLogic from '../components/mapas/useMapLogic';
import MapViewContainer from '../components/mapas/MapViewContainer';
import RouteConfirmationPanel from '../components/mapas/RouteConfirmationPanel';
import FloatingButtons from '../components/mapas/FloatingButtons';
import { useNavigationContext } from '../context/NavigationContext';
import InstructionPanel from '../components/mapas/InstructionPanel';
import BottomNavigationPanel from '../components/mapas/BottomNavigationPanel';
import MapLocationPopup from '../components/mapas/MapLocationPopup';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig.extra.GOOGLE_MAPS_API_KEY;
const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#1976d2',
  gradientStart: '#1976d2',
  gradientEnd: '#2196f3',
  background: '#f8fafc',
  surface: '#fff',
  text: '#333',
  textSecondary: '#666',
  border: '#e0e0e0',
  accent: '#43e97b',
};

const MapScreen = () => {
  const logic = useMapLogic();
  const nav = useNavigationContext();
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [is3DNavigation, setIs3DNavigation] = useState(false);
  const [heading, setHeading] = useState(0); // TODO: integrar com bússola
  const [arrivedModalVisible, setArrivedModalVisible] = useState(false);
  const arrivedAnim = useState(new Animated.Value(0))[0];
  const [showAccessibleDetails, setShowAccessibleDetails] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // loading global
  const [loadingRoute, setLoadingRoute] = useState(false); // loading traçar rota

  // MOCK: Obstáculos e elevação para demonstração
  const mockObstacles = [
    { latitude: -23.001, longitude: -47.001, type: 'step', severity: 'critical', description: 'Degrau de 12cm' },
    { latitude: -23.002, longitude: -47.002, type: 'hole', severity: 'moderate', description: 'Buraco na calçada' },
    { latitude: -23.003, longitude: -47.003, type: 'ramp', severity: 'good', description: 'Rampa suave' },
  ];
  const mockElevationSegments = [
    { start: { latitude: -23.000, longitude: -47.000 }, end: { latitude: -23.001, longitude: -47.001 }, gradePercent: 2, status: 'good' },
    { start: { latitude: -23.001, longitude: -47.001 }, end: { latitude: -23.002, longitude: -47.002 }, gradePercent: 7, status: 'moderate' },
    { start: { latitude: -23.002, longitude: -47.002 }, end: { latitude: -23.003, longitude: -47.003 }, gradePercent: 12, status: 'critical' },
  ];

  // useEffect para loading global inicial
  useEffect(() => {
    if (!logic.showLoading) {
      setTimeout(() => setIsLoading(false), 300); // delay para UX
    } else {
      setIsLoading(true);
    }
  }, [logic.showLoading]);

  // useEffect para abrir o modal de rota quando routeData for atualizado
  useEffect(() => {
    if (nav.routeData) {
      setShowRouteModal(true);
      setLoadingRoute(false); // encerra loading de rota

    }
  }, [nav.routeData]);

  // Função memoizada para traçar rota
  const handleSelectDestination = useCallback(async (destination) => {

    if (!logic.location || !destination) {

      return;
    }
    setLoadingRoute(true);
    await nav.requestRoute(logic.location, destination, GOOGLE_MAPS_API_KEY);

    // setShowRouteModal(true); // agora controlado por useEffect

  }, [logic.location, nav, GOOGLE_MAPS_API_KEY]);

  // Função memoizada para centralizar no usuário
  const handleCenterOnUser = useCallback(() => {
    logic.centerOnUser();
  }, [logic]);

  // Ao iniciar navegação
  const handleStartNavigation = () => {
    nav.startNavigation();
    setShowRouteModal(false);
    logic.setSelectedLocation(null);
    logic.setShowSearchHistory(false);
    logic.setSearchResults([]);
    logic.setDestination(null);
    logic.setSimpleRouteCoords([]);
    logic.setShowRouteConfirm(false);
    logic.setPendingDestination(null);
  };

  // Ao cancelar navegação
  const handleCancelNavigation = () => {
    nav.clearAllNavigation();
    setShowRouteModal(false);
    logic.setSelectedLocation(null);
    logic.setShowSearchHistory(false);
    logic.setSearchResults([]);
    logic.setDestination(null);
    logic.setSimpleRouteCoords([]);
    logic.setShowRouteConfirm(false);
    logic.setPendingDestination(null);
  };

  // Ao traçar rota por toque longo, limpar tudo antes
  const handleLongPress = (e) => {
    handleCancelNavigation();
    logic.handleLongPress(e);
  };

  // Ao iniciar navegação, NÃO ativar modo 3D (remover setIs3DNavigation)
  useEffect(() => {
    setIs3DNavigation(false); // Sempre manter 2D
  }, [nav.isNavigating]);

  // Detectar chegada ao destino
  useEffect(() => {
    if (
      nav.isNavigating &&
      nav.currentStepIndex >= nav.routeData?.steps?.length - 1 &&
      nav.routeData?.steps?.length > 0
    ) {
      setArrivedModalVisible(true);
      Animated.spring(arrivedAnim, { toValue: 1, useNativeDriver: true }).start();
      Vibration.vibrate(300);
    } else {
      setArrivedModalVisible(false);
      arrivedAnim.setValue(0);
    }
  }, [nav.isNavigating, nav.currentStepIndex, nav.routeData?.steps?.length]);

  useEffect(() => {
    setShowAccessibleDetails(false);
    setShowDetailsPanel(false);

  }, [logic.selectedLocation]);

  const memoizedOnLongPress = useCallback(handleLongPress, [logic, nav]);

  if (isLoading || loadingRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 18, fontSize: 18, color: COLORS.primary, fontWeight: 'bold' }}>
          {loadingRoute ? 'Traçando rota...' : 'Carregando mapa...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <AppHeader
        title="Mapa"
        onBack={() => logic.navigation.goBack()}
        gradientColors={[COLORS.gradientStart, COLORS.gradientEnd]}
        style={{ elevation: 10 }}
        rightComponent={
          <TouchableOpacity onPress={() => logic.navigation.navigate('MapSettings')} style={{ padding: 6 }}>
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        }
      />
      {/* Barra de pesquisa só aparece se NÃO estiver navegando */}
      {!nav.isNavigating ? (
      <View style={{ position: 'absolute', top: 70, width: '92%', alignSelf: 'center', zIndex: 99 }}>
        <SearchBar
            value={logic.searchText}
          onChangeText={text => {
              logic.setSearchText(text);
            if (text.length > 1) {
                logic.searchPlaces();
            } else if (text.length === 0) {
                logic.setShowSearchHistory(true);
            }
          }}
          placeholder="Pesquisar local..."
          onFocus={() => {
              logic.setShowSearchHistory(true);
              logic.setIsSearchFocused(true);
            }}
            onBlur={() => logic.setIsSearchFocused(false)}
          />
      </View>
      ) : (
        nav.routeData && nav.routeData.steps && nav.routeData.steps.length > 0 && (
          <View style={{ position: 'absolute', top: 70, width: '96%', alignSelf: 'center', zIndex: 99 }}>
            <InstructionPanel
              distance={nav.routeData.steps[nav.currentStepIndex]?.distance || ''}
              maneuver={nav.routeData.steps[nav.currentStepIndex]?.maneuver || 'straight'}
              street={nav.routeData.steps[nav.currentStepIndex]?.instruction || ''}
              nextInstruction={nav.routeData.steps[nav.currentStepIndex + 1]?.instruction || ''}
              steps={nav.routeData.steps}
            />
          </View>
        )
      )}
      {/* Painel de busca/autocomplete */}
      <MapSearchPanel
        searchText={logic.searchText}
        setSearchText={logic.setSearchText}
        searchResults={logic.searchResults}
        setSearchResults={logic.setSearchResults}
        isSearching={logic.isSearching}
        autoCompleteLoading={logic.autoCompleteLoading}
        showSearchHistory={logic.showSearchHistory}
        setShowSearchHistory={logic.setShowSearchHistory}
        searchHistory={logic.searchHistory}
        clearSearchHistory={logic.clearSearchHistory}
        nearbyPlaces={logic.nearbyPlaces}
        selectPlace={place => {
          logic.setDestination(place.location);
          handleSelectDestination(place.location);
        }}
        selectHistoryItem={item => {
          logic.setDestination(item.location);
          handleSelectDestination(item.location);
        }}
        searchPlaces={logic.searchPlaces}
        searchInputRef={logic.searchInputRef}
        isSearchFocused={logic.isSearchFocused}
        setIsSearchFocused={logic.setIsSearchFocused}
      />
      {/* Mapa e overlays */}
      <MapViewContainer
        mapRef={logic.mapRef}
        location={logic.location}
        destination={logic.destination}
        destinationContext={nav.routeData?.destination}
        accessibleLocations={logic.accessibleLocations}
        selectedLocation={logic.selectedLocation}
        setSelectedLocation={logic.setSelectedLocation}
        routeCoords={nav.routeData?.polyline || []}
        navigationSteps={nav.routeData?.steps || []}
        currentStepIndex={nav.currentStepIndex}
        isNavigating={nav.isNavigating}
        simpleRouteCoords={!nav.isNavigating ? logic.simpleRouteCoords : []}
        mapInitialRegion={logic.mapInitialRegion}
        onLongPress={memoizedOnLongPress}
        mapReady={logic.mapReady}
        setMapReady={logic.setMapReady}
        user={logic.user}
        obstacles={mockObstacles}
        elevationSegments={mockElevationSegments}
        is3DNavigation={false}
        heading={0}
      />
      {/* Botões flutuantes */}
      <FloatingButtons
        onCenter={handleCenterOnUser}
        onAdd={() => logic.navigation && logic.navigation.navigate('Locais', { addModalVisible: true })}
      />
      {/* Painel de confirmação de rota temporária */}
      <RouteConfirmationPanel
        visible={logic.showRouteConfirm}
        onCancel={logic.handleCancelSimpleRoute}
        onConfirm={() => handleSelectDestination(logic.pendingDestination)}
      />
      {/* Painel de detalhes do local acessível OU popup de ponto aleatório */}
      {logic.selectedLocation && (
        showDetailsPanel ? (
          <AccessibleLocationDetailPanel
            location={logic.selectedLocation}
            onClose={() => setShowDetailsPanel(false)}
            onViewDetails={() => {
              setShowDetailsPanel(false);
              logic.navigation.navigate('LocationDetail', { locationId: logic.selectedLocation.id });
            }}
            userLocation={logic.location}
            loadingRoute={false}
            routeInfo={nav.routeData?.info || {}}
            onShare={logic.handleShare}
            isFavorite={logic.isFavorite}
            onToggleFavorite={() => logic.setIsFavorite(fav => !fav)}
            reviews={logic.selectedLocationReviews}
            onStartRoute={() => {

              setShowDetailsPanel(false);
              const loc = logic.selectedLocation;
              let lat = loc.latitude, lng = loc.longitude;
              if (loc.location && typeof loc.location === 'object') {
                lat = loc.location.latitude;
                lng = loc.location.longitude;
              }
              if (typeof lat === 'number' && typeof lng === 'number') {
                handleSelectDestination({ latitude: lat, longitude: lng });
              } else {

              }
            }}
          />
        ) : (
          <MapLocationPopup
            visible={!!logic.selectedLocation && !showDetailsPanel}
            location={logic.selectedLocation}
            onClose={() => logic.setSelectedLocation(null)}
            onShare={() => logic.handleShare(logic.selectedLocation)}
            onRoute={() => {

              setShowDetailsPanel(true);
            }}
            onDetails={() => setShowDetailsPanel(true)}
          />
        )
      )}
      {/* Modal de detalhes da rota */}
      {nav.navigationError && (
        <View style={{ position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center', zIndex: 9999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 2, borderColor: '#ff4444', elevation: 8 }}>
            <Text style={{ color: '#ff4444', fontWeight: 'bold', fontSize: 17 }}>Erro ao traçar rota: {nav.navigationError}</Text>
          </View>
        </View>
      )}
      <RoutePlannerModal
        visible={showRouteModal && !!nav.routeData}
        onClose={() => {
          setShowRouteModal(false);

        }}
        onStart={handleStartNavigation}
        onShare={logic.handleShareRoute}
        info={nav.routeData?.info || {}}
        steps={nav.routeData?.steps || []}
        loading={false}
        error={nav.navigationError}
        routeCoords={nav.routeData?.polyline || []}
        origin={nav.routeData?.origin}
        destination={nav.routeData?.destination}
      />
      {/* Painel de navegação profissional */}
      {nav.isNavigating && nav.routeData && nav.routeData.steps && nav.routeData.steps.length > 0 && (
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 18,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.13,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          zIndex: 999,
          flexDirection: 'column',
          alignItems: 'stretch',
          borderWidth: 3,
          borderColor: (() => {
            // Cor da borda conforme status do segmento atual
            const seg = mockElevationSegments[nav.currentStepIndex] || {};
            if (seg.status === 'critical') return '#FF5252';
            if (seg.status === 'moderate') return '#FFD600';
            if (seg.status === 'good') return '#43e97b';
            return '#1976d2';
          })(),
        }}>
          {/* ALERTAS DE OBSTÁCULOS/INCLINAÇÃO */}
          {(() => {
            const step = nav.routeData.steps[nav.currentStepIndex];
            // Obstáculo próximo?
            const obs = mockObstacles.find(o => Math.abs(o.latitude - step.endLocation.lat) < 0.0005 && Math.abs(o.longitude - step.endLocation.lng) < 0.0005);
            const seg = mockElevationSegments[nav.currentStepIndex];
            let alertMsg = '';
            let alertIcon = null;
            if (obs) {
              if (obs.type === 'step') { alertMsg = `Atenção: Degrau à frente (${obs.description})`; alertIcon = 'remove-outline'; }
              if (obs.type === 'hole') { alertMsg = `Atenção: Buraco à frente (${obs.description})`; alertIcon = 'ellipse-outline'; }
              if (obs.type === 'ramp') { alertMsg = `Rampa acessível à frente (${obs.description})`; alertIcon = 'trending-up-outline'; }
            } else if (seg && seg.status === 'critical') {
              alertMsg = `Subida íngreme (${seg.gradePercent}%) nos próximos metros`;
              alertIcon = 'trending-up-outline';
            } else if (seg && seg.status === 'moderate') {
              alertMsg = `Inclinação moderada (${seg.gradePercent}%)`;
              alertIcon = 'trending-up-outline';
            }
            if (alertMsg) {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#FFD600' }}>
                  <Ionicons name={alertIcon} size={26} color={seg && seg.status === 'critical' ? '#FF5252' : '#FFD600'} style={{ marginRight: 8 }} />
                  <Text style={{ color: seg && seg.status === 'critical' ? '#FF5252' : '#FFD600', fontWeight: 'bold', fontSize: 16 }}>{alertMsg}</Text>
          </View>
              );
            }
            return null;
          })()}
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 }}>
            {nav.routeData.steps[nav.currentStepIndex]?.instruction}
            {/* Ícone de acessibilidade ao lado da instrução */}
            {(() => {
              const seg = mockElevationSegments[nav.currentStepIndex] || {};
              if (seg.status === 'critical') return <Ionicons name="alert-circle" size={22} color="#FF5252" style={{ marginLeft: 8 }} />;
              if (seg.status === 'moderate') return <Ionicons name="alert" size={22} color="#FFD600" style={{ marginLeft: 8 }} />;
              if (seg.status === 'good') return <Ionicons name="checkmark-circle" size={22} color="#43e97b" style={{ marginLeft: 8 }} />;
              return null;
            })()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 18 }}>
            <Text style={{ color: COLORS.primary, fontSize: 15 }}>Distância: <Text style={{ fontWeight: 'bold' }}>{nav.routeData.steps[nav.currentStepIndex]?.distance}</Text></Text>
            <Text style={{ color: COLORS.primary, fontSize: 15, marginLeft: 18 }}>Tempo: <Text style={{ fontWeight: 'bold' }}>{nav.routeData.steps[nav.currentStepIndex]?.duration}</Text></Text>
            {/* ETA (horário de chegada) */}
            {(() => {
              // Extrair duração total da rota (em minutos)
              const info = nav.routeData.info || {};
              let eta = '';
              if (info.duration) {
                // Ex: "12 min" ou "1 h 5 min"
                let min = 0;
                const match = info.duration.match(/(\d+)\s*h\s*(\d+)?\s*min?/);
                if (match) {
                  min += parseInt(match[1] || '0') * 60;
                  min += parseInt(match[2] || '0');
                } else {
                  const onlyMin = info.duration.match(/(\d+)\s*min/);
                  if (onlyMin) min += parseInt(onlyMin[1]);
                }
                const now = new Date();
                now.setMinutes(now.getMinutes() + min);
                eta = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
              return eta ? (
                <Text style={{ color: COLORS.primary, fontSize: 15, marginLeft: 18 }}>Chegada: <Text style={{ fontWeight: 'bold' }}>{eta}</Text></Text>
              ) : null;
            })()}
          </View>
          {/* Mini gráfico de elevação (sparkline) */}
          <View style={{ height: 36, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            {mockElevationSegments.map((seg, idx) => (
              <View key={idx} style={{ width: 16, height: Math.max(8, seg.gradePercent * 2), backgroundColor: seg.status === 'critical' ? '#FF5252' : seg.status === 'moderate' ? '#FFD600' : '#43e97b', borderRadius: 4, marginRight: 2 }} />
            ))}
            </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff4444', borderRadius: 10, padding: 12, justifyContent: 'center' }}
              onPress={handleCancelNavigation}
              accessibilityLabel="Cancelar navegação"
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
              onPress={handleCenterOnUser}
              accessibilityLabel="Centralizar no usuário"
            >
              <Ionicons name="location-sharp" size={28} color="#fff" accessibilityLabel="Centralizar no usuário" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Painel inferior Waze-like */}
      {nav.isNavigating && nav.routeData && nav.routeData.info && (
        <BottomNavigationPanel
          eta={(() => {
            const info = nav.routeData.info;
            let eta = '';
            if (info.duration) {
              let min = 0;
              const match = info.duration.match(/(\d+)\s*h\s*(\d+)?\s*min?/);
              if (match) {
                min += parseInt(match[1] || '0') * 60;
                min += parseInt(match[2] || '0');
              } else {
                const onlyMin = info.duration.match(/(\d+)\s*min/);
                if (onlyMin) min += parseInt(onlyMin[1]);
              }
              const now = new Date();
              now.setMinutes(now.getMinutes() + min);
              eta = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return eta;
          })()}
          duration={nav.routeData.info.duration}
          distance={nav.routeData.info.distance}
          progress={nav.currentStepIndex / (nav.routeData.steps.length - 1)}
          alerts={mockObstacles.map(o => ({ type: o.type, description: o.description }))}
          onStop={handleCancelNavigation}
          onRoutes={() => setShowRouteModal(true)}
          onShare={logic.handleShareRoute}
        />
      )}
      {/* Modal/banner de chegada ao destino */}
      {arrivedModalVisible && (
        <Animated.View style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999,
          opacity: arrivedAnim,
          transform: [{ scale: arrivedAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center', elevation: 8, shadowColor: '#43e97b', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, borderWidth: 2, borderColor: '#43e97b' }}>
            <Ionicons name="flag" size={54} color="#43e97b" style={{ marginBottom: 10 }} />
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#43e97b', marginBottom: 8 }}>Você chegou ao seu destino!</Text>
            <TouchableOpacity onPress={() => { nav.clearAllNavigation(); setArrivedModalVisible(false); }} style={{ backgroundColor: '#43e97b', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 28, marginTop: 10 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 17 }}>Encerrar Navegação</Text>
          </TouchableOpacity>
        </View>
        </Animated.View>
      )}
    </View>
  );
};

const mapCustomStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e0f7fa' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#00796b' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#b9f6ca' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#388e3c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#cfd8dc' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#b0bec5' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#90a4ae' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b3e5fc' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0288d1' }] }
];

const styles = StyleSheet.create({
  map: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    margin: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    width: '90%',
    alignSelf: 'center',
    zIndex: 99,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
    paddingVertical: 6,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchResultsList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: height * 0.4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultIcon: {
    marginRight: 10,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  resultAddress: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  resultDistance: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  clearHistoryText: {
    fontSize: 13,
    color: '#007bff',
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  searchLoadingText: {
    marginLeft: 10,
    color: '#666',
  },
  centerButton: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  addFab: {
    position: 'absolute',
    right: 24,
    bottom: 110, // Deixa acima do botão de centralizar
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43e97b',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 99,
    overflow: 'visible',
  },
  fabInnerAdd: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43e97b',
  },
  fabInnerCenter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00b0ff',
  },
  fabIcon: {
    fontSize: 40,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  navigationPanel: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 5,
  },
  routeText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  maneuverIcon: {
    marginRight: 10,
    width: 30,
    textAlign: 'center',
  },
  stepInstruction: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 8,
    flex: 1,
    justifyContent: 'center',
  },
  tipPanel: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  tipText: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    fontSize: 16,
    fontWeight: '500',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  resultsListContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: height * 0.4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { MapScreen };
export default MapScreen;