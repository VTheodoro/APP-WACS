import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StatusBar,
  Alert,
  Platform,
  BackHandler,
  Modal,
  TouchableWithoutFeedback,
  ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchLocations } from '../services/firebase/locations';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, storage, auth } from '../services/firebase/config';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Colors } from '../theme/Colors';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../components/common/AppHeader';

export default function LocationsListScreen() {
  // State management
  const [locations, setLocations] = useState([]);
  const [displayedLocations, setDisplayedLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [placeTypeFilter, setPlaceTypeFilter] = useState('all');
  const [accessibilityFilters, setAccessibilityFilters] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [typeFilterModalVisible, setTypeFilterModalVisible] = useState(false);
  const [tempTypeFilter, setTempTypeFilter] = useState(placeTypeFilter);
  const [sortBy, setSortBy] = useState('rating'); // 'rating', 'recent'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { theme } = useTheme();
  const navigation = useNavigation();

  // Adicionar tipos principais para filtro
  const MAIN_PLACE_TYPES = [
    { key: 'all', label: 'Todos', icon: <Ionicons name="apps" size={18} color="#1976d2" /> },
    { key: 'restaurant', label: 'Restaurante', icon: <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#1976d2" /> },
    { key: 'school', label: 'Escola', icon: <Ionicons name="school-outline" size={18} color="#1976d2" /> },
    { key: 'hospital', label: 'Hospital', icon: <MaterialCommunityIcons name="hospital-building" size={18} color="#1976d2" /> },
    { key: 'store', label: 'Loja', icon: <FontAwesome5 name="store" size={18} color="#1976d2" /> },
    { key: 'hotel', label: 'Hotel', icon: <FontAwesome5 name="hotel" size={18} color="#1976d2" /> },
    { key: 'park', label: 'Parque', icon: <MaterialCommunityIcons name="tree" size={18} color="#1976d2" /> },
    { key: 'other', label: 'Outros', icon: <Ionicons name="ellipsis-horizontal" size={18} color="#1976d2" /> },
  ];

  const PLACE_TYPE_ICONS = {
    restaurant: <MaterialCommunityIcons name="silverware-fork-knife" size={16} color="#1976d2" />,
    school: <Ionicons name="school-outline" size={16} color="#1976d2" />,
    hospital: <MaterialCommunityIcons name="hospital-building" size={16} color="#1976d2" />,
    store: <FontAwesome5 name="store" size={16} color="#1976d2" />,
    hotel: <FontAwesome5 name="hotel" size={16} color="#1976d2" />,
    gym: <MaterialCommunityIcons name="dumbbell" size={16} color="#1976d2" />,
    station: <MaterialCommunityIcons name="train" size={16} color="#1976d2" />,
    park: <MaterialCommunityIcons name="tree" size={16} color="#1976d2" />,
    church: <MaterialCommunityIcons name="church" size={16} color="#1976d2" />,
    pharmacy: <MaterialCommunityIcons name="pharmacy" size={16} color="#1976d2" />,
    supermarket: <MaterialCommunityIcons name="cart" size={16} color="#1976d2" />,
    shopping_mall: <MaterialCommunityIcons name="shopping" size={16} color="#1976d2" />,
    bank: <FontAwesome5 name="university" size={16} color="#1976d2" />,
    post_office: <MaterialCommunityIcons name="email" size={16} color="#1976d2" />,
    pet_store: <MaterialCommunityIcons name="dog" size={16} color="#1976d2" />,
    bar: <MaterialCommunityIcons name="glass-cocktail" size={16} color="#1976d2" />,
    bakery: <MaterialCommunityIcons name="bread-slice" size={16} color="#1976d2" />,
    gas_station: <MaterialCommunityIcons name="gas-station" size={16} color="#1976d2" />,
    clinic: <MaterialCommunityIcons name="stethoscope" size={16} color="#1976d2" />,
    theater: <MaterialCommunityIcons name="theater" size={16} color="#1976d2" />,
    cinema: <MaterialCommunityIcons name="movie" size={16} color="#1976d2" />,
    custom: <Ionicons name="create-outline" size={16} color="#1976d2" />,
    other: <Ionicons name="ellipsis-horizontal" size={16} color="#1976d2" />,
  };

  const PLACE_TYPE_LABELS = {
    restaurant: 'Restaurante',
    school: 'Escola',
    hospital: 'Hospital',
    store: 'Loja',
    hotel: 'Hotel',
    gym: 'Academia',
    station: 'Estação',
    park: 'Parque',
    church: 'Igreja',
    pharmacy: 'Farmácia',
    supermarket: 'Supermercado',
    shopping_mall: 'Shopping',
    bank: 'Banco',
    post_office: 'Correios',
    pet_store: 'Petshop',
    bar: 'Bar',
    bakery: 'Padaria',
    gas_station: 'Posto de Gasolina',
    clinic: 'Clínica',
    theater: 'Teatro',
    cinema: 'Cinema',
    custom: '',
    other: 'Outros',
  };

  // Adicione as opções de acessibilidade para filtro
  const ACCESSIBILITY_FILTERS = [
    { key: 'ramp', label: 'Rampas', icon: <MaterialCommunityIcons name="stairs" size={16} color="#1976d2" /> },
    { key: 'bathroom', label: 'Banheiro adaptado', icon: <MaterialCommunityIcons name="toilet" size={16} color="#1976d2" /> },
    { key: 'elevator', label: 'Elevador', icon: <MaterialCommunityIcons name="elevator" size={16} color="#1976d2" /> },
    { key: 'reserved_parking', label: 'Vagas reservadas', icon: <MaterialCommunityIcons name="parking" size={16} color="#1976d2" /> },
    { key: 'braille', label: 'Braille', icon: <MaterialCommunityIcons name="braille" size={16} color="#1976d2" /> },
    { key: 'guide_dog', label: 'Cão-guia', icon: <MaterialCommunityIcons name="dog-service" size={16} color="#1976d2" /> },
    { key: 'sign_language', label: 'Libras', icon: <MaterialCommunityIcons name="hand-peace" size={16} color="#1976d2" /> },
  ];

  // Função auxiliar para mapear features para nome/ícone
  const FEATURE_MAP = {
    'wheelchair': { icon: <Ionicons name="walk-outline" size={20} color="#1976d2" />, label: 'Cadeirante' },
    'blind': { icon: <Ionicons name="eye-off-outline" size={20} color="#1976d2" />, label: 'Def. Visual' },
    'deaf': { icon: <Ionicons name="ear-outline" size={20} color="#1976d2" />, label: 'Def. Auditiva' },
    'elevator': { icon: <MaterialCommunityIcons name="elevator" size={20} color="#1976d2" />, label: 'Elevador' },
    'parking': { icon: <MaterialCommunityIcons name="parking" size={20} color="#1976d2" />, label: 'Estacionamento' },
    'restroom': { icon: <MaterialCommunityIcons name="toilet" size={20} color="#1976d2" />, label: 'Banheiro Adapt.' },
    'ramp': { icon: <MaterialCommunityIcons name="stairs" size={20} color="#1976d2" />, label: 'Rampa' },
    'braille': { icon: <MaterialCommunityIcons name="braille" size={20} color="#1976d2" />, label: 'Braille' },
    'guide_dog': { icon: <MaterialCommunityIcons name="dog-service" size={20} color="#1976d2" />, label: 'Cão-guia' },
    'sign_language': { icon: <MaterialCommunityIcons name="hand-peace" size={20} color="#1976d2" />, label: 'Libras' },
    // fallback
  };

  // Gerar lista dinâmica de features presentes nos locais
  const featureCounts = React.useMemo(() => {
    const counts = {};
    locations.forEach(loc => {
      (loc.accessibilityFeatures || []).forEach(f => {
        counts[f] = (counts[f] || 0) + 1;
      });
    });
    return counts;
  }, [locations]);

  const dynamicFeatures = Object.keys(featureCounts).map(f => ({
    key: f,
    label: FEATURE_MAP[f]?.label || f,
    icon: FEATURE_MAP[f]?.icon || <Ionicons name="help-circle-outline" size={20} color="#1976d2" />,
    count: featureCounts[f],
  }));

  // Gerar lista dinâmica de tipos presentes nos locais
  const typeCounts = React.useMemo(() => {
    const counts = {};
    locations.forEach(loc => {
      if (loc.placeType) {
        counts[loc.placeType] = (counts[loc.placeType] || 0) + 1;
      }
    });
    return counts;
  }, [locations]);

  const dynamicTypes = Object.keys(typeCounts).map(type => ({
    key: type,
    label: PLACE_TYPE_LABELS[type] || type,
    icon: PLACE_TYPE_ICONS[type] || PLACE_TYPE_ICONS['other'],
    count: typeCounts[type],
  }));


  // Load locations with enhanced error handling
  const loadLocations = useCallback(async () => {
    if (!refreshing) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchLocations();
      setLocations(data);
    } catch (err) {
      console.error('Error loading locations:', err);
      setError('Erro ao carregar locais. Verifique sua conexão.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);



  // Atualize o filtro de exibição e ordenação
  useEffect(() => {
    let filtered = [...locations];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(loc =>
        (loc.name && loc.name.toLowerCase().includes(q)) ||
        (loc.address && loc.address.toLowerCase().includes(q))
      );
    }
    if (placeTypeFilter !== 'all') {
      filtered = filtered.filter(loc => loc.placeType === placeTypeFilter);
    }
    if (accessibilityFilters.length > 0) {
      filtered = filtered.filter(loc =>
        accessibilityFilters.every(f => loc.accessibilityFeatures?.includes(f))
      );
    }
    // Ordenação
    if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
    }
    setDisplayedLocations(filtered);
  }, [locations, searchQuery, placeTypeFilter, accessibilityFilters, sortBy]);

  // Effects
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Handle back button in selection mode
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  // Header component
  const headerActions = [
    {
      icon: 'filter',
      label: 'Filtro',
      onPress: () => setViewMode(viewMode === 'grid' ? 'list' : 'grid'),
    },
    {
      icon: 'swap-vertical',
      label: 'Ordenar',
      onPress: () => setViewMode(viewMode === 'grid' ? 'list' : 'grid'),
    },
    {
      icon: viewMode === 'grid' ? 'list' : 'grid',
      label: viewMode === 'grid' ? 'Lista' : 'Grade',
      onPress: () => setViewMode(viewMode === 'grid' ? 'list' : 'grid'),
    },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLocations();
  }, [loadLocations]);

  // Adicionar função auxiliar para renderizar cada local
  function getLocationCardStyle(viewMode, rating) {
    const borderColor = rating >= 4.5 ? '#4CAF50' : // Verde para excelente
      rating >= 3.5 ? '#FF9800' : // Laranja para bom
        rating >= 2 ? '#FFC107' : // Amarelo para médio
          rating > 0 ? '#F44336' : // Vermelho para ruim
            '#9E9E9E'; // Cinza para sem avaliação

    return [
      viewMode === 'grid' ? styles.gridCard : styles.listCard,
      {
        backgroundColor: '#fff',
        borderColor: borderColor,
        borderWidth: 2,
        borderRadius: 16,
      }
    ];
  }

  // Função para cor do ícone de acessibilidade
  function getFeatureRatingColor(rating) {
    if (typeof rating !== 'number' || isNaN(rating) || rating === 0) return '#b0b0b0'; // cinza
    if (rating >= 4.5) return '#4CAF50'; // verde
    if (rating >= 3.5) return '#FF9800'; // laranja
    if (rating >= 2) return '#FFC107'; // amarelo
    return '#F44336'; // vermelho
  }


  function renderLocation({ item }) {
    const getLocationEmoji = (rating) => {
      if (!rating) return { emoji: '🆕' };
      if (rating >= 4.5) return { emoji: '😃' }; // Excelente
      if (rating >= 3.5) return { emoji: '🙂' }; // Bom
      if (rating >= 2) return { emoji: '😐' }; // Regular
      return { emoji: '😞' }; // Precisa melhorar
    };

    const { emoji } = getLocationEmoji(item.rating);


    return (
      <TouchableOpacity
        style={getLocationCardStyle(viewMode, item.rating)}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('LocationDetail', { locationId: item.id })}
      >
        <View style={viewMode === 'grid' ? styles.gridImageContainer : styles.listImageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[
                viewMode === 'grid' ? styles.gridImage : styles.listImage,
                { borderTopLeftRadius: 22, borderTopRightRadius: viewMode === 'grid' ? 22 : 0, borderBottomLeftRadius: viewMode === 'grid' ? 0 : 22 }
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { borderTopLeftRadius: 22, borderTopRightRadius: viewMode === 'grid' ? 22 : 0, borderBottomLeftRadius: viewMode === 'grid' ? 0 : 22 }]}>
              <Ionicons name="image" size={36} color="#AAA" />
              <Text style={styles.placeholderText}>Sem imagem</Text>
            </View>
          )}

          {/* Badge de status apenas com emoji */}
          <View style={styles.emojiRating}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </View>

        </View>

        <View style={styles.cardContent}>
          {/* Author Info */}
          {item.author && (
            <View style={styles.authorContainer}>
              {item.author.photoURL ? (
                <Image source={{ uri: item.author.photoURL }} style={styles.authorPhoto} />
              ) : (
                <View style={styles.authorPhotoPlaceholder}>
                  <Ionicons name="person" size={14} color="#666" />
                </View>
              )}
              <Text style={styles.authorName} numberOfLines={1}>
                {item.author.name || 'Usuário'}
              </Text>
              <Text style={styles.postDate}>
                {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : ''}
              </Text>
            </View>
          )}

          <Text style={styles.locationName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.locationAddress} numberOfLines={1}>{item.address}</Text>

          {/* Classificação por estrelas abaixo do endereço */}
          {item.rating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 2 }}>
              <Ionicons name="star" size={15} color="#FFD700" style={{ marginRight: 2 }} />
              <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 14 }}>{item.rating.toFixed(1)}</Text>
            </View>
          )}

          {/* Accessibility Features with Ratings */}
          {item.accessibilityFeatures && item.accessibilityFeatures.length > 0 && (
            <View style={styles.accessibilityContainer}>
              {item.accessibilityFeatures.slice(0, 3).map((feature, index) => {
                const featureData = FEATURE_MAP[feature] || { icon: <Ionicons name="help-circle-outline" size={16} color="#b0b0b0" />, label: feature };
                const featureRating = item.featureRatings?.[feature];
                const iconColor = getFeatureRatingColor(featureRating);
                const iconWithColor = React.cloneElement(featureData.icon, { color: iconColor });
                return (
                  <View key={index} style={styles.accessibilityTag}>
                    {iconWithColor}
                  </View>
                );
              })}
              {item.accessibilityFeatures.length > 3 && (
                <View style={styles.moreTag}>
                  <Text style={styles.moreTagText}>+{item.accessibilityFeatures.length - 3}</Text>
                </View>
              )}
            </View>
          )}

          {item.placeType && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginTop: 2 }}>
              {PLACE_TYPE_ICONS[item.placeType] || PLACE_TYPE_ICONS['other']}
              <Text style={{ marginLeft: 6, fontSize: 13, color: '#1976d2', fontWeight: 'bold' }}>
                {PLACE_TYPE_LABELS[item.placeType] || item.placeType}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Sugestões de autocomplete
  const searchSuggestions = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return locations.filter(loc =>
      (loc.name && loc.name.toLowerCase().includes(q)) ||
      (loc.address && loc.address.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQuery, locations]);

  // Loading state - Só mostrar durante o carregamento inicial ou refresh
  if (loading && !refreshing && locations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary.dark} />
        <Text style={styles.loadingText}>Carregando locais...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={60} color="#F44336" />
        <Text style={styles.errorTitle}>Ops! Algo deu errado</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadLocations}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (locations.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="location-outline" size={80} color="#DDD" />
        <Text style={styles.emptyTitle}>Nenhum local encontrado</Text>
        <Text style={styles.emptyText}>
          Adicione o primeiro local acessível à sua lista!
        </Text>
        <TouchableOpacity
          style={styles.addFirstButton}
          onPress={() => navigation.navigate('SelectLocationMap')}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addFirstButtonText}>Adicionar Local</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader
        title="Locais Acessíveis"
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: 'options',
            label: 'Acessibilidade',
            onPress: () => setFilterModalVisible(true),
            badge: accessibilityFilters.length > 0 ? accessibilityFilters.length : undefined,
          },
          {
            icon: 'filter',
            label: 'Tipo',
            onPress: () => {
              setTempTypeFilter(placeTypeFilter);
              setTypeFilterModalVisible(true);
            },
            badge: placeTypeFilter !== 'all' ? 1 : undefined,
          },
        ]}
      />
      {/* Barra de pesquisa moderna */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: '#f8fafc', zIndex: 20 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f1f5f9',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 0,
          borderWidth: searchFocused ? 1.5 : 1,
          borderColor: searchFocused ? '#1976d2' : '#e0e0e0',
        }}>
          <Ionicons name="search" size={20} color={searchFocused ? '#1976d2' : '#b0b0b0'} style={{ marginRight: 6 }} />
          <TextInput
            style={{ flex: 1, height: 40, fontSize: 16, color: '#222', backgroundColor: 'transparent' }}
            placeholder="Buscar por local ou cidade..."
            placeholderTextColor="#b0b0b0"
            value={searchQuery}
            onChangeText={text => { setSearchQuery(text); setShowSuggestions(true); }}
            onFocus={() => { setSearchFocused(true); setShowSuggestions(true); }}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSuggestions(false); }} style={{ marginLeft: 4 }}>
              <Ionicons name="close-circle" size={20} color="#b0b0b0" />
            </TouchableOpacity>
          )}
        </View>
        {/* Dropdown de sugestões */}
        {showSuggestions && searchQuery.length > 0 && (
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            marginTop: 2,
            shadowColor: '#000',
            shadowOpacity: 0.10,
            shadowRadius: 8,
            elevation: 6,
            maxHeight: 220,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#e0e0e0',
            zIndex: 30,
          }}>
            {searchSuggestions.length > 0 ? (
              searchSuggestions.map(sug => (
                <TouchableOpacity
                  key={sug.id}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                  onPress={() => { setSearchQuery(sug.name); setShowSuggestions(false); }}
                >
                  <Ionicons name="location" size={18} color="#1976d2" style={{ marginRight: 10 }} />
                  <View>
                    <Text style={{ fontSize: 15, color: '#222', fontWeight: 'bold' }}>{sug.name}</Text>
                    <Text style={{ fontSize: 13, color: '#666' }}>{sug.address}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'center' }}
                onPress={() => {
                  setShowSuggestions(false);
                  navigation.navigate('SelectLocationMap', { prefillName: searchQuery });
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#1976d2" style={{ marginRight: 8 }} />
                <Text style={{ color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>
                  Não encontrou o local? <Text style={{ textDecorationLine: 'underline' }}>Adicione ao sistema!</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {/* Modais de filtro */}
      {/* Modal de filtro de tipo de local */}
      <Modal
        visible={typeFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeFilterModalVisible(false)}
      >
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} activeOpacity={1} onPress={() => setTypeFilterModalVisible(false)} />
        <View style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          padding: 24,
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          minHeight: 180,
          alignItems: 'center',
        }}>
          {/* Handle visual */}
          <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: '#e0e0e0', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1976d2', marginBottom: 18 }}>Filtrar por tipo de local</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18, alignSelf: 'stretch' }}>
            {MAIN_PLACE_TYPES.map(type => {
              const count = type.key === 'all' ? locations.length : (typeCounts[type.key] || 0);
              const isSelected = tempTypeFilter === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#e3f2fd' : '#f5f5f5',
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 10,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: '#1976d2',
                    elevation: isSelected ? 2 : 0,
                    opacity: type.key === 'all' ? 1 : (locations.length === 0 ? 0.5 : 1),
                  }}
                  onPress={() => setTempTypeFilter(type.key)}
                  disabled={locations.length === 0 && type.key !== 'all'}
                >
                  {type.icon}
                  <Text style={{ marginLeft: 8, color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{type.label}</Text>
                  <View style={{ backgroundColor: '#1976d2', borderRadius: 10, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignSelf: 'stretch' }}>
            <TouchableOpacity onPress={() => { setTempTypeFilter('all'); setPlaceTypeFilter('all'); setTypeFilterModalVisible(false); }} style={{ padding: 10, borderRadius: 12, backgroundColor: '#f5f5f5', marginRight: 8 }}>
              <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPlaceTypeFilter(tempTypeFilter); setTypeFilterModalVisible(false); }} style={{ padding: 10, borderRadius: 12, backgroundColor: '#1976d2' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Modal de filtro de acessibilidade */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
        <View style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          padding: 24,
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          minHeight: 180,
          alignItems: 'center',
        }}>
          {/* Handle visual */}
          <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: '#e0e0e0', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1976d2', marginBottom: 18 }}>Filtrar por acessibilidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18, alignSelf: 'stretch' }}>
            {dynamicFeatures.map(feature => {
              const selected = accessibilityFilters.includes(feature.key);
              return (
                <TouchableOpacity
                  key={feature.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selected ? '#e3f2fd' : '#f5f5f5',
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 10,
                    borderWidth: selected ? 2 : 0,
                    borderColor: '#1976d2',
                    elevation: selected ? 2 : 0,
                  }}
                  onPress={() => {
                    setAccessibilityFilters(selected
                      ? accessibilityFilters.filter(f => f !== feature.key)
                      : [...accessibilityFilters, feature.key]);
                  }}
                >
                  {feature.icon}
                  <Text style={{ marginLeft: 8, color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{feature.label}</Text>
                  <View style={{ backgroundColor: '#1976d2', borderRadius: 10, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{feature.count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignSelf: 'stretch' }}>
            <TouchableOpacity onPress={() => setAccessibilityFilters([])} style={{ padding: 10, borderRadius: 12, backgroundColor: '#f5f5f5', marginRight: 8 }}>
              <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={{ padding: 10, borderRadius: 12, backgroundColor: '#1976d2' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <FlatList
        data={displayedLocations}
        keyExtractor={item => item.id}
        renderItem={renderLocation}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={[
          styles.listContent,
          displayedLocations.length === 0 && styles.emptyListContent,
          { backgroundColor: '#f8fafc' }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary.dark]}
            progressBackgroundColor="#fff"
            tintColor={Colors.primary.dark}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={[styles.emptyResults, { backgroundColor: '#f8fafc' }]}>
            <Ionicons name="search" size={60} color="#DDD" />
            <Text style={[styles.emptyResultsText, { color: '#666' }]}>Nenhum local encontrado com os filtros aplicados</Text>
          </View>
        )}
      />
      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary.dark }]}
        onPress={() => navigation.navigate('SelectLocationMap')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    zIndex: 1000,
  },
  headerContainer: {
    // Para garantir espaçamento e alinhamento
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 8,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 4,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchContainer: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersRow: {
    flex: 1,
    marginRight: 12,
  },
  filtersList: {
    flexGrow: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // Grid Card Styles
  gridCard: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 22,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 0,
    overflow: 'hidden',
    // Glow sutil para status
  },
  gridImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  // List Card Styles
  listCard: {
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 22,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
    flexDirection: 'row',
    borderWidth: 0,
    overflow: 'hidden',
  },
  listImageContainer: {
    width: 110,
    height: 110,
    position: 'relative',
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    overflow: 'hidden',
  },
  listImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  placeholderImage: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  placeholderText: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 4,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  locationName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '400',
  },
  locationDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    lineHeight: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  starIcon: {
    marginRight: 1,
  },
  reviewCount: {
    fontSize: 12,
    color: '#888',
  },
  accessibilityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
    gap: 2,
  },
  accessibilityTag: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 2,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  moreTag: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  moreTagText: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
  },
  // Loading and Error States
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary.dark,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Empty States
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.dark,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  addFirstButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#f8fafc',
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary.dark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
    gap: 12,
  },
  pickerSummaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  pickerSummaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerModalContainer: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 1001,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 18,
    textAlign: 'center',
  },
  pickerModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerModalItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  pickerModalItemText: {
    fontSize: 15,
    color: '#333',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorPhotoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  authorName: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  postDate: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
  },
  emojiRating: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 20,
  },
  emojiText: {
    fontSize: 16,
    marginRight: 6,
  },
  emojiLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featureRating: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 118, 210, 0.95)', // Azul sólido com opacidade
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 20,
  },
});