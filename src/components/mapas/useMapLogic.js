import { useState, useEffect, useRef, useContext } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { fetchLocations, fetchReviewsForLocation } from '../../services/firebase/locations';
import { calculateDistance, decodePolyline } from '../../utils/mapUtils';
import { AuthContext } from '../../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import useRoutePlanner from '../../hooks/useRoutePlanner';
import { useNavigationContext } from '../../context/NavigationContext';
// import * as Share from 'expo-share'; // TODO: Descomentar quando expo-share puder ser instalado

const GOOGLE_MAPS_APIKEY = Constants.expoConfig.extra.GOOGLE_MAPS_API_KEY;

export default function useMapLogic() {
  // Estados principais extraídos de MapScreen.js
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [info, setInfo] = useState({ distance: '', duration: '', instruction: '' });
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [accessibleLocations, setAccessibleLocations] = useState([]);
  const [loadingAccessible, setLoadingAccessible] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedLocationReviews, setSelectedLocationReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [mapInitialRegion, setMapInitialRegion] = useState({
    latitude: -24.495277,
    longitude: -47.846528,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [showLoading, setShowLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [didAnimateToLocal, setDidAnimateToLocal] = useState(false);
  const [simpleRouteCoords, setSimpleRouteCoords] = useState([]);
  const [showRouteConfirm, setShowRouteConfirm] = useState(false);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);
  const [userLocationAtRequest, setUserLocationAtRequest] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false);

  const mapRef = useRef(null);
  const locationWatcher = useRef(null);
  const navigationInterval = useRef(null);
  const searchInputRef = useRef(null);

  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useContext(AuthContext);
  const nav = useNavigationContext();

  // Novo sistema de rotas
  const {
    requestRoute,
    routeCoords: routeCoordsPlanner,
    steps,
    info: infoPlanner,
    loading: loadingRoutePlanner,
    error: routeErrorPlanner,
    resetRoute,
  } = useRoutePlanner();

  // Função utilitária para extrair latitude/longitude de qualquer formato de local
  function extractLatLng(item) {
    if (!item) return { latitude: null, longitude: null };
    if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      return { latitude: item.latitude, longitude: item.longitude };
    }
    if (item.location && typeof item.location === 'object') {
      if (typeof item.location.latitude === 'number' && typeof item.location.longitude === 'number') {
        return { latitude: item.location.latitude, longitude: item.location.longitude };
      }
      if (Array.isArray(item.location) && item.location.length === 2) {
        return { latitude: Number(item.location[0]), longitude: Number(item.location[1]) };
      }
    }
    if (typeof item.location === 'string') {
      const match = item.location.match(/([\d.-]+)[^\d-]*([NSLOEW])?,?\s*([\d.-]+)[^\d-]*([NSLOEW])?/i);
      if (match) {
        let lat = parseFloat(match[1]);
        let lng = parseFloat(match[3]);
        if (match[2] && /S|O|W/i.test(match[2])) lat = -Math.abs(lat);
        if (match[4] && /S|O|W/i.test(match[4])) lng = -Math.abs(lng);
        return { latitude: lat, longitude: lng };
      }
    }
    return { latitude: null, longitude: null };
  }

  // Buscar locais acessíveis do Firestore ao montar
  useEffect(() => {
    async function loadAccessibleLocations() {
      setLoadingAccessible(true);
      try {
        const data = await fetchLocations();
        setAccessibleLocations(data);
      } catch (e) {
        setAccessibleLocations([]);
      }
      setLoadingAccessible(false);
    }
    loadAccessibleLocations();
  }, []);

  // Carregar histórico de pesquisa
  useEffect(() => {
    loadSearchHistory();
    if (location) {
      fetchNearbyPlaces();
    }
    // eslint-disable-next-line
  }, [location]);

  // Carregar histórico de pesquisa do AsyncStorage
  const loadSearchHistory = async () => {
    try {
      const historyJson = await AsyncStorage.getItem('mapSearchHistory');
      if (historyJson) {
        const history = JSON.parse(historyJson);
        setSearchHistory(history);
      }
    } catch (error) {
      // erro silencioso
    }
  };

  // Salvar no histórico de pesquisa
  const saveToSearchHistory = async (place) => {
    try {
      const exists = searchHistory.some(item => item.id === place.id);
      if (exists) return;
      const updatedHistory = [place, ...searchHistory].slice(0, 10);
      setSearchHistory(updatedHistory);
      await AsyncStorage.setItem('mapSearchHistory', JSON.stringify(updatedHistory));
    } catch (error) { }
  };

  // Limpar histórico de pesquisa
  const clearSearchHistory = async () => {
    try {
      await AsyncStorage.removeItem('mapSearchHistory');
      setSearchHistory([]);
    } catch (error) { }
  };

  // Buscar locais próximos
  const fetchNearbyPlaces = async () => {
    if (!location) return;
    setIsLoadingNearby(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=1500&type=establishment&key=${GOOGLE_MAPS_APIKEY}&language=pt-BR`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const places = data.results.map(place => ({
          id: place.place_id,
          name: place.name,
          address: place.vicinity,
          location: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng
          },
          rating: place.rating || 0,
          distance: calculateDistance(
            location.latitude,
            location.longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          )
        })).sort((a, b) => a.distance - b.distance);
        setNearbyPlaces(places.slice(0, 5));
      }
    } catch (error) { }
    setIsLoadingNearby(false);
  };

  // Solicitar permissão e iniciar localização em tempo real
  useEffect(() => {
    let lastUpdate = 0;
    let lastCoords = null;
    let watchdog;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão para acessar a localização foi negada');
        // Fallback: define uma região padrão para não travar loading
        if (!mapInitialRegion) {
          setMapInitialRegion({
            latitude: -24.495277,
            longitude: -47.846528,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          });
          setShowLoading(false);
        }
        return;
      }
      // Watchdog: se em 5s não tivermos região, defina padrão e siga
      watchdog = setTimeout(() => {
        if (!location) {
          // Mantém a região inicial da ETEC se não conseguir localização
          setShowLoading(false);
        }
      }, 5000);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
      lastCoords = loc.coords;
      if (nav && nav.updateUserLocation) nav.updateUserLocation(loc.coords);
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 2000 },
        (loc) => {
          const now = Date.now();
          const coords = loc.coords;
          // Filtrar saltos grandes
          if (lastCoords && (Math.abs(coords.latitude - lastCoords.latitude) > 0.001 || Math.abs(coords.longitude - lastCoords.longitude) > 0.001)) {
            // salto > ~100m, ignorar
            return;
          }
          if (now - lastUpdate > 1200) { // debounce para suavizar
            setLocation(coords);
            lastCoords = coords;
            lastUpdate = now;
            if (nav && nav.updateUserLocation) nav.updateUserLocation(coords);
          }
        }
      );
    })();
    return () => {
      if (locationWatcher.current) locationWatcher.current.remove();
      if (watchdog) clearTimeout(watchdog);
    };
  }, []);

  // Limpar recursos quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (navigationInterval.current) {
        clearInterval(navigationInterval.current);
      }
    };
  }, []);

  // Traçar rota ao definir destino
  useEffect(() => {
    if (location && destination) {
      if (
        typeof location.latitude !== 'number' ||
        typeof location.longitude !== 'number' ||
        typeof destination.latitude !== 'number' ||
        typeof destination.longitude !== 'number' ||
        isNaN(location.latitude) ||
        isNaN(location.longitude) ||
        isNaN(destination.latitude) ||
        isNaN(destination.longitude)
      ) {
        setRouteCoords([]);
        setInfo({ distance: '', duration: '', instruction: 'Coordenadas inválidas.' });
        return;
      }
      getRoute(location, destination);
    } else {
      setRouteCoords([]);
      setInfo({ distance: '', duration: '', instruction: '' });
    }
  }, [destination, location]);

  // Função para buscar locais pelo texto de pesquisa
  const searchPlaces = async () => {
    if (!searchText || searchText.trim().length < 2 || !location) return;
    setIsSearching(true);
    setAutoCompleteLoading(true);
    setShowSearchHistory(false);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchText)}&location=${location.latitude},${location.longitude}&radius=50000&key=${GOOGLE_MAPS_APIKEY}&language=pt-BR`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const places = data.results.map(place => ({
          id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          location: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng
          },
          rating: place.rating || 0,
          distance: calculateDistance(
            location.latitude,
            location.longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          )
        }));
        const sortedPlaces = places.sort((a, b) => a.distance - b.distance);
        setSearchResults(sortedPlaces);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    }
    setIsSearching(false);
    setAutoCompleteLoading(false);
  };

  // Função para buscar rota na Google Directions API
  const getRoute = async (origin, dest) => {
    setLoadingRoute(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&key=${GOOGLE_MAPS_APIKEY}&language=pt-BR`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error_message) {
        // erro silencioso
      }
      if (data.routes && data.routes.length > 0) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(points);
        const leg = data.routes[0].legs[0];
        setInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          instruction: leg.steps[0]?.html_instructions.replace(/<[^>]+>/g, '') || '',
        });
        const steps = leg.steps.map(step => ({
          distance: step.distance.text,
          duration: step.duration.text,
          instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
          startLocation: step.start_location,
          endLocation: step.end_location,
          maneuver: step.maneuver || '',
          polyline: decodePolyline(step.polyline.points)
        }));
        setNavigationSteps(steps);
        setCurrentStepIndex(0);
      } else {
        setRouteCoords([]);
        setInfo({ distance: '', duration: '', instruction: data.status || 'Rota não encontrada' });
        setNavigationSteps([]);
      }
    } catch (e) {
      setErrorMsg('Erro ao buscar rota');
    }
    setLoadingRoute(false);
  };

  // Centralizar no usuário
  const centerOnUser = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  // Atualizar handleLongPress para desenhar rota simples e exibir confirmação
  const handleLongPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!location) return;
    setSimpleRouteCoords([
      { latitude: location.latitude, longitude: location.longitude },
      { latitude, longitude }
    ]);
    setPendingDestination({ latitude, longitude });
    setShowRouteConfirm(true);
  };

  // Função para confirmar e abrir modal de detalhes
  const handleConfirmSimpleRoute = async () => {
    if (location && pendingDestination) {
      setUserLocationAtRequest({ ...location });
      // Buscar endereço via reverse geocoding
      let address = '';
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_APIKEY;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pendingDestination.latitude},${pendingDestination.longitude}&key=${apiKey}&language=pt-BR`;
        const response = await fetch(url);
        const data = await response.json();
        address = data.results?.[0]?.formatted_address || '';
      } catch { }
      setSelectedLocation({
        id: `random_${pendingDestination.latitude}_${pendingDestination.longitude}`,
        latitude: pendingDestination.latitude,
        longitude: pendingDestination.longitude,
        name: 'Ponto selecionado',
        address,
        isAccessible: false,
      });
    }
    setShowRouteConfirm(false);
  };

  // Selecionar local da lista de resultados
  const selectPlace = (place) => {
    setDestination(place.location);
    setSearchResults([]);
    setSearchText(place.name);
    setShowSearchHistory(false);
    saveToSearchHistory(place);
  };

  // Selecionar um item do histórico
  const selectHistoryItem = (item) => {
    setDestination(item.location);
    setSearchText(item.name);
    setShowSearchHistory(false);
  };

  // Iniciar navegação
  const startNavigation = (steps) => {
    if (!steps || steps.length === 0) return;
    setIsNavigating(true);
    setCurrentStepIndex(0);
    if (navigationInterval.current) {
      clearInterval(navigationInterval.current);
    }
    navigationInterval.current = setInterval(() => {
      if (!location || !steps[currentStepIndex]) return;
      const nextStep = steps[currentStepIndex];
      const distanceToNextStep = calculateDistance(
        location.latitude,
        location.longitude,
        nextStep.endLocation.lat,
        nextStep.endLocation.lng
      );
      if (currentStepIndex >= steps.length - 1 && distanceToNextStep < 20) {
        stopNavigation();
        return;
      }
      if (distanceToNextStep < 20) {
        setCurrentStepIndex(prevIndex => {
          const newIndex = prevIndex + 1;
          if (newIndex < steps.length) {
            return newIndex;
          }
          return prevIndex;
        });
      }
    }, 5000);
  };

  // Parar navegação
  const stopNavigation = () => {
    if (navigationInterval.current) {
      clearInterval(navigationInterval.current);
      navigationInterval.current = null;
    }
    setIsNavigating(false);
  };

  // Cancelar navegação
  const cancelNavigation = () => {
    stopNavigation();
    setDestination(null);
    setRouteCoords([]);
    setInfo({ distance: '', duration: '', instruction: '' });
    setSearchText('');
    setSearchResults([]);
    setNavigationSteps([]);
    setCurrentStepIndex(0);
  };

  // Focar na barra de pesquisa
  const focusSearchBar = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      setShowSearchHistory(true);
    }
  };

  // Compartilhar local
  const handleShare = async () => {
    if (!selectedLocation) return;
    try {
      // await Share.share({
      //   message: `Confira este local acessível no WACS: ${selectedLocation.name}. Endereço: ${selectedLocation.address}`,
      //   title: `WACS: ${selectedLocation.name}`
      // });
    } catch (error) { }
  };

  // Compartilhar rota
  const handleShareRoute = async () => {
    if (!pendingDestination) return;
    try {
      // await Share.share({
      //   message: `Veja a rota até o destino: https://www.google.com/maps/dir/?api=1&destination=${pendingDestination.latitude},${pendingDestination.longitude}`,
      //   title: 'Rota WACS',
      // });
    } catch { }
  };

  // Carregar reviews ao selecionar local
  useEffect(() => {
    if (selectedLocation) {
      setLoadingReviews(true);
      fetchReviewsForLocation(selectedLocation.id)
        .then(revs => setSelectedLocationReviews(revs))
        .catch(() => setSelectedLocationReviews([]))
        .finally(() => setLoadingReviews(false));
    }
  }, [selectedLocation]);

  // Atualizar initialRegion ao receber params ou localização do usuário
  useEffect(() => {
    if (route.params && route.params.centerOn === 'location' && route.params.latitude && route.params.longitude) {
      setMapInitialRegion({
        latitude: route.params.latitude,
        longitude: route.params.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else if (location) {
      setMapInitialRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [route.params, location]);

  // Splash de carregamento inicial
  useEffect(() => {
    if (mapInitialRegion) {
      setTimeout(() => setShowLoading(false), 900);
    }
  }, [mapInitialRegion]);

  // Exibir modal de detalhes do local após 2-3 segundos ao abrir o mapa com locationId
  useEffect(() => {
    if (!showLoading && route.params && route.params.locationId && accessibleLocations.length > 0) {
      const loc = accessibleLocations.find(l => l.id === route.params.locationId);
      if (loc) {
        setTimeout(() => setSelectedLocation(loc), 2200);
      }
    }
  }, [showLoading, route.params, accessibleLocations]);

  // Novo: animação de transição do usuário para o local selecionado, só após o mapa estar pronto
  useEffect(() => {
    if (
      !didAnimateToLocal &&
      mapReady &&
      showLoading === false &&
      route.params &&
      route.params.centerOn === 'location' &&
      route.params.latitude &&
      route.params.longitude &&
      location
    ) {
      setDidAnimateToLocal(true);
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 800);
      }
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: route.params.latitude,
            longitude: route.params.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1200);
        }
      }, 1000);
    }
  }, [mapReady, showLoading, route.params, location]);

  // Resetar didAnimateToLocal ao abrir a tela novamente
  useEffect(() => { setDidAnimateToLocal(false); }, [route.key]);

  // Quando o usuário seleciona um destino (toque longo ou via detalhes), abrir modal e buscar rota
  useEffect(() => {
    if (
      pendingDestination &&
      userLocationAtRequest &&
      typeof pendingDestination.latitude === 'number' &&
      typeof pendingDestination.longitude === 'number' &&
      typeof userLocationAtRequest.latitude === 'number' &&
      typeof userLocationAtRequest.longitude === 'number'
    ) {
      requestRoute(userLocationAtRequest, pendingDestination);
      setRouteModalVisible(true);
    }
  }, [pendingDestination, userLocationAtRequest]);

  // Ao fechar o modal, resetar rota
  const handleCloseRouteModal = () => {
    setRouteModalVisible(false);
    setPendingDestination(null);
    setUserLocationAtRequest(null);
    resetRoute();
  };

  // Corrigir handleStartNavigation para iniciar navegação corretamente
  const handleStartNavigation = () => {
    setRouteModalVisible(false);
    if (steps && steps.length > 0) {
      startNavigation(steps);
    }
  };

  // Função para iniciar rota a partir do painel de detalhes
  const handleStartRoute = () => {
    if (!selectedLocation) return;
    const { latitude, longitude } = extractLatLng(selectedLocation);
    if (location) setUserLocationAtRequest({ ...location });
    setPendingDestination({ latitude, longitude });
  };

  return {
    // Estados
    location, setLocation,
    destination, setDestination,
    routeCoords, setRouteCoords,
    info, setInfo,
    loadingRoute, setLoadingRoute,
    errorMsg, setErrorMsg,
    searchText, setSearchText,
    searchResults, setSearchResults,
    isSearching, setIsSearching,
    searchHistory, setSearchHistory,
    showSearchHistory, setShowSearchHistory,
    nearbyPlaces, setNearbyPlaces,
    isLoadingNearby, setIsLoadingNearby,
    navigationSteps, setNavigationSteps,
    currentStepIndex, setCurrentStepIndex,
    isNavigating, setIsNavigating,
    accessibleLocations, setAccessibleLocations,
    loadingAccessible, setLoadingAccessible,
    selectedLocation, setSelectedLocation,
    selectedLocationReviews, setSelectedLocationReviews,
    loadingReviews, setLoadingReviews,
    isFavorite, setIsFavorite,
    mapInitialRegion, setMapInitialRegion,
    showLoading, setShowLoading,
    mapReady, setMapReady,
    didAnimateToLocal, setDidAnimateToLocal,
    simpleRouteCoords, setSimpleRouteCoords,
    showRouteConfirm, setShowRouteConfirm,
    routeModalVisible, setRouteModalVisible,
    pendingDestination, setPendingDestination,
    userLocationAtRequest, setUserLocationAtRequest,
    isSearchFocused, setIsSearchFocused,
    autoCompleteLoading, setAutoCompleteLoading,
    mapRef, locationWatcher, navigationInterval, searchInputRef,
    navigation, route, user, nav,
    // Funções
    requestRoute, steps, infoPlanner, loadingRoutePlanner, routeErrorPlanner, resetRoute,
    extractLatLng,
    loadSearchHistory,
    saveToSearchHistory,
    clearSearchHistory,
    fetchNearbyPlaces,
    searchPlaces,
    getRoute,
    centerOnUser,
    handleLongPress,
    handleConfirmSimpleRoute,
    selectPlace,
    selectHistoryItem,
    startNavigation,
    stopNavigation,
    cancelNavigation,
    focusSearchBar,
    handleShare,
    handleShareRoute,
    handleCloseRouteModal,
    handleStartNavigation,
    handleStartRoute,
  };
} 