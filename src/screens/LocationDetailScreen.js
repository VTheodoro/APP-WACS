import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  Alert,
  Share,
  Linking,
  Platform,
  RefreshControl,
  Modal,
  StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchLocationById, fetchReviewsForLocation } from '../services/firebase/locations';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import ReviewModal from '../components/ReviewModal';
import { db } from '../services/firebase/config';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc,
  increment,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { Snackbar } from 'react-native-paper';
import { addXP } from '../services/gamification';
import ContributionsList from '../features/location-contributions/ContributionsList';
import { Colors } from '../theme/Colors';

// Função para calcular distância
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Novas funções auxiliares
const getLocationEmoji = (rating) => {
  if (rating === undefined || rating === null || rating === 0) return { emoji: '🆕', text: 'Novo' };
  if (rating >= 4.5) return { emoji: '⭐', text: 'Excelente' };
  if (rating >= 3.5) return { emoji: '👍', text: 'Bom' };
  if (rating >= 2.0) return { emoji: '😐', text: 'Regular' };
  return { emoji: '👎', text: 'Ruim' };
};

const getRatingColor = (rating) => {
  if (rating === undefined || rating === null || rating === 0) return Colors.text.darkSecondary;
  if (rating >= 4.5) return Colors.success.primary;
  if (rating >= 3.5) return Colors.warning.primary;
  if (rating >= 2.0) return '#FFC107'; // Amarelo
  return Colors.danger.primary;
};

const PLACE_TYPE_ICONS = {
  restaurant: <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#1976d2" />,
  school: <Ionicons name="school-outline" size={20} color="#1976d2" />,
  hospital: <MaterialCommunityIcons name="hospital-building" size={20} color="#1976d2" />,
  store: <FontAwesome5 name="store" size={20} color="#1976d2" />,
  hotel: <FontAwesome5 name="hotel" size={20} color="#1976d2" />,
  gym: <MaterialCommunityIcons name="dumbbell" size={20} color="#1976d2" />,
  station: <MaterialCommunityIcons name="train" size={20} color="#1976d2" />,
  park: <MaterialCommunityIcons name="tree" size={20} color="#1976d2" />,
  church: <MaterialCommunityIcons name="church" size={20} color="#1976d2" />,
  pharmacy: <MaterialCommunityIcons name="pharmacy" size={20} color="#1976d2" />,
  supermarket: <MaterialCommunityIcons name="cart" size={20} color="#1976d2" />,
  shopping_mall: <MaterialCommunityIcons name="shopping" size={20} color="#1976d2" />,
  bank: <FontAwesome5 name="university" size={20} color="#1976d2" />,
  post_office: <MaterialCommunityIcons name="email" size={20} color="#1976d2" />,
  pet_store: <MaterialCommunityIcons name="dog" size={20} color="#1976d2" />,
  bar: <MaterialCommunityIcons name="glass-cocktail" size={20} color="#1976d2" />,
  bakery: <MaterialCommunityIcons name="bread-slice" size={20} color="#1976d2" />,
  gas_station: <MaterialCommunityIcons name="gas-station" size={20} color="#1976d2" />,
  clinic: <MaterialCommunityIcons name="stethoscope" size={20} color="#1976d2" />,
  theater: <MaterialCommunityIcons name="theater" size={20} color="#1976d2" />,
  cinema: <MaterialCommunityIcons name="movie" size={20} color="#1976d2" />,
  custom: <Ionicons name="create-outline" size={20} color="#1976d2" />,
  other: <Ionicons name="ellipsis-horizontal" size={20} color="#1976d2" />,
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

// Adicionar dicionário de explicações dos recursos
const FEATURE_EXPLANATIONS = {
  'wheelchair': 'Acessível para cadeirantes: rampas, portas largas e circulação livre.',
  'blind': 'Acessível para deficientes visuais: sinalização tátil, braile, piso tátil.',
  'deaf': 'Acessível para deficientes auditivos: sinalização visual, intérprete de Libras.',
  'elevator': 'Elevador disponível para acesso entre andares.',
  'parking': 'Vaga reservada para pessoas com deficiência.',
  'restroom': 'Banheiro adaptado: barras de apoio, espaço para cadeira de rodas.',
  'ramp': 'Rampa de acesso para cadeirantes.',
  'Acessível para cadeirantes': 'Acessível para cadeirantes: rampas, portas largas e circulação livre.',
  'Piso tátil': 'Piso tátil para orientação de deficientes visuais.',
  'Rampa de acesso': 'Rampa de acesso para cadeirantes.',
  'Banheiro acessível': 'Banheiro adaptado: barras de apoio, espaço para cadeira de rodas.',
  'Vaga PCD': 'Vaga reservada para pessoas com deficiência.',
  'Atendimento prioritário': 'Atendimento prioritário para pessoas com deficiência.',
  'Cão-guia permitido': 'Cão-guia permitido no local.',
  'Sinalização em braile': 'Sinalização em braile para deficientes visuais.',
};

// Função utilitária para extrair latitude/longitude do campo location ou dos campos separados
function getLatLngFromLocationField(item) {
  if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
    return { latitude: item.latitude, longitude: item.longitude };
  }
  if (item.location && typeof item.location === 'object' && !Array.isArray(item.location)) {
    if (typeof item.location.latitude === 'number' && typeof item.location.longitude === 'number') {
      return { latitude: item.location.latitude, longitude: item.location.longitude };
    }
  }
  if (Array.isArray(item.location) && item.location.length === 2) {
    let lat = item.location[0];
    let lng = item.location[1];
    if (typeof lat === 'string') lat = parseLatLngString(lat, true);
    if (typeof lng === 'string') lng = parseLatLngString(lng, false);
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  if (typeof item.location === 'string') {
    let str = item.location.replace(/\[|\]/g, '').trim();
    const parts = str.split(',');
    if (parts.length === 2) {
      const lat = parseLatLngString(parts[0], true);
      const lng = parseLatLngString(parts[1], false);
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }
  return null;
}
function parseLatLngString(str, isLat) {
  if (typeof str !== 'string') return NaN;
  const match = str.match(/([\d.\-]+)[^\d\-]*([NSLOEW])?/i);
  if (!match) return NaN;
  let value = parseFloat(match[1]);
  if (isNaN(value)) return NaN;
  if (/S|O|W/i.test(str)) value = -Math.abs(value);
  else value = Math.abs(value);
  return value;
}

export default function LocationDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { locationId } = route.params || {};
  
  // Estados
  const [location, setLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { currentUser, user } = useAuth();
  const [reviewsToShow, setReviewsToShow] = useState(3);
  const [xpSnackbar, setXpSnackbar] = useState({ visible: false, message: '' });
  
  // Função para carregar dados (NÃO é mais useCallback)
  async function loadData() {
    try {
      setError(null);
      const [loc, revs] = await Promise.all([
        fetchLocationById(locationId),
        fetchReviewsForLocation(locationId)
      ]);
      if (!loc) throw new Error('Local não encontrado');
      setLocation(loc);
      setReviews(revs);
    } catch (err) {
      setError(err.message || 'Erro ao carregar detalhes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  
  // Efeito para carregar dados ao montar a tela
  useEffect(() => {
    if (locationId) {
      loadData();
    }
  }, [locationId]);
  
  // Função de refresh manual
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };
  
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira este local acessível no WACS: ${location.name}. Endereço: ${location.address}`,
        title: `WACS: ${location.name}`
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o local.');
    }
  };
  
  const openInMaps = () => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${location.latitude},${location.longitude}`;
    const url = Platform.select({
      ios: `${scheme}${location.name}@${latLng}`,
      android: `${scheme}${latLng}(${location.name})`
    });
    Linking.openURL(url);
  };
  
  const toggleFavorite = () => setIsFavorite(!isFavorite);

  const handleReviewSubmit = async ({ rating, comment, featureRatings }) => {
    // Corrigir caminho da coleção
    const locationRef = doc(db, 'accessibleLocations', locationId);
    const reviewsCollectionRef = collection(db, 'reviews'); // coleção global
    
    try {
        await runTransaction(db, async (transaction) => {
            const locationDoc = await transaction.get(locationRef);
            if (!locationDoc.exists()) {
                throw new Error("Local não encontrado!");
            }

            // 1. Adicionar a nova avaliação na coleção global
            const newReviewRef = doc(reviewsCollectionRef); // Cria uma referência com ID único
            transaction.set(newReviewRef, {
                locationId, // importante para filtrar depois
                rating,
                comment,
                featureRatings,
                createdAt: serverTimestamp(),
                userId: user.id,
                userName: user.name || 'Anônimo',
                photoURL: user.photoURL || null,
            });

            // 2. Atualizar a avaliação média e a contagem no documento do local
            const oldRating = locationDoc.data().rating || 0;
            const reviewCount = locationDoc.data().reviewCount || 0;
            const newReviewCount = reviewCount + 1;
            const newRating = ((oldRating * reviewCount) + rating) / newReviewCount;

            transaction.update(locationRef, {
                rating: newRating,
                reviewCount: increment(1),
            });
        });

        Alert.alert("Sucesso", "Sua avaliação foi enviada!");
        setReviewModalVisible(false);
        onRefresh(); // Recarrega os dados para mostrar a nova avaliação
        if (user?.id) {
          await addXP(user.id, 'review');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setXpSnackbar({ visible: true, message: '+10 XP por avaliar!' });
        }
    } catch (error) {
        Alert.alert("Erro", "Não foi possível enviar sua avaliação. Por favor, tente novamente.");
    }
  };
  
  // Funções de renderização de UI
  const renderStars = (rating = 0, size = 18) => {
    const stars = Array(5).fill(0);
    return (
      <View style={styles.starsContainer}>
        {stars.map((_, i) => {
          const name = i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-outline';
          return <Ionicons key={i} name={name} size={size} color={Colors.warning.primary} />;
        })}
      </View>
    );
  };
  
  const getFeatureData = (featureKey) => {
    const featureMap = {
      'wheelchair': { icon: 'walk-outline', name: 'Cadeirante' },
      'blind': { icon: 'eye-off-outline', name: 'Def. Visual' },
      'deaf': { icon: 'ear-outline', name: 'Def. Auditiva' },
      'elevator': { icon: 'swap-vertical-outline', name: 'Elevador' },
      'parking': { icon: 'car-outline', name: 'Estacionamento' },
      'restroom': { icon: 'body-outline', name: 'Banheiro Adapt.' },
      'ramp': { icon: 'enter-outline', name: 'Rampa' },
      'Acessível para cadeirantes': { icon: 'walk-outline', name: 'Cadeirante' },
      'Piso tátil': { icon: 'analytics-outline', name: 'Piso Tátil' },
      'Rampa de acesso': { icon: 'enter-outline', name: 'Rampa' },
      'Banheiro acessível': { icon: 'body-outline', name: 'Banheiro' },
      'Vaga PCD': { icon: 'car-outline', name: 'Vaga PCD' },
      'Atendimento prioritário': { icon: 'people-outline', name: 'Atendimento' },
      'Cão-guia permitido': { icon: 'paw-outline', name: 'Cão-Guia' },
      'Sinalização em braile': { icon: 'bookmarks-outline', name: 'Braile' },
    };
    return featureMap[featureKey] || { icon: 'help-circle-outline', name: featureKey };
  };
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary.dark} />
        <Text style={styles.loadingText}>Carregando detalhes...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={60} color={Colors.danger.primary} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!location) return null;

  const { emoji, text: emojiText } = getLocationEmoji(location.rating);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary.dark} />
      <LinearGradient colors={[Colors.primary.dark, Colors.primary.light]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{location.name}</Text>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-social-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleFavorite} style={styles.headerButton}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? Colors.danger.primary : "#fff"} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary.dark]} />}
      >
        {location.imageUrl && (
          <Image source={{ uri: location.imageUrl }} style={styles.locationImage} />
        )}
        <View style={styles.mainContent}>
          <View style={styles.titleSection}>
            <Text style={styles.locationName}>{location.name}</Text>
            {location.placeType && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                {PLACE_TYPE_ICONS[location.placeType] || PLACE_TYPE_ICONS['other']}
                <Text style={{ marginLeft: 8, fontSize: 16, color: '#1976d2', fontWeight: 'bold' }}>
                  {PLACE_TYPE_LABELS[location.placeType] || location.placeType}
                </Text>
              </View>
            )}
          </View>
          {location.author && (
            <View style={styles.authorCard}>
              {location.author.photoURL ? (
                <Image source={{ uri: location.author.photoURL }} style={styles.authorPhoto} />
              ) : (
                <View style={styles.authorPhotoPlaceholder}>
                  <Ionicons name="person-outline" size={18} color="#666" />
                </View>
              )}
              <Text style={styles.authorText}>
                Adicionado por <Text style={{fontWeight: 'bold'}}>{location.author.name || 'um usuário'}</Text>
              </Text>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Avaliação Geral</Text>
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingScore}>{location.rating?.toFixed(1) || '-'}</Text>
              <View>
                {renderStars(location.rating, 24)}
                <Text style={styles.reviewCount}>
                  {location.reviewCount ? `${location.reviewCount} avaliações` : 'Sem avaliações'}
                </Text>
              </View>
              <View style={[styles.emojiTag, { backgroundColor: getRatingColor(location.rating) }]}> 
                <Text style={styles.emojiText}>{emoji}</Text>
                <Text style={styles.emojiTagText}>{emojiText}</Text>
              </View>
            </View>
            {location.description && (
              <Text style={styles.description}>{location.description}</Text>
            )}
          </View>
          <View style={styles.actionButtonsGrid}>
            <TouchableOpacity style={styles.gridButton} onPress={() => setReviewModalVisible(true)}>
              <LinearGradient colors={[Colors.primary.dark, Colors.primary.light]} style={styles.gridButtonGradient}>
                <Ionicons name="star-outline" size={24} color="#fff" />
                <Text style={styles.gridButtonText}>Avaliar</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gridButton}
              onPress={() => {
                const latLng = getLatLngFromLocationField(location);
                navigation.navigate('MapScreen', {
                  locationId: locationId,
                  latitude: latLng?.latitude,
                  longitude: latLng?.longitude,
                  centerOn: 'location',
                });
              }}
            >
              <LinearGradient colors={['#1976d2', '#63a4ff']} style={styles.gridButtonGradient}>
                <Ionicons name="map-outline" size={24} color="#fff" />
                <Text style={styles.gridButtonText}>Ver no Mapa</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {location.accessibilityFeatures?.length > 0 && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="accessibility" size={22} color={Colors.primary.dark} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recursos de Acessibilidade</Text>
              </View>
              <View style={styles.featuresGrid}>
                {location.accessibilityFeatures.map((featureKey) => {
                  const data = getFeatureData(featureKey);
                  const avgRating = location.featureRatings?.[featureKey];
                  let bgColor = '#f6f8fa';
                  if (avgRating !== undefined) {
                    if (avgRating >= 4) bgColor = '#e6f9ed';
                    else if (avgRating >= 3) bgColor = '#fffbe6';
                    else if (avgRating > 0) bgColor = '#ffeaea';
                  }
                  return (
                    <View
                      key={featureKey}
                      style={[styles.accessChip, { backgroundColor: bgColor }]}
                    >
                      <View style={{
                        backgroundColor: avgRating >= 4 ? '#43a04722' : avgRating >= 3 ? '#FFC10722' : avgRating > 0 ? '#F4433622' : '#e0e0e0',
                        borderRadius: 14,
                        padding: 6,
                        marginBottom: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name={data.icon} size={22} color={avgRating >= 4 ? '#43a047' : avgRating >= 3 ? '#FFC107' : avgRating > 0 ? '#F44336' : '#b0b0b0'} />
                      </View>
                      <Text style={styles.accessChipLabel}>{data.name}</Text>
                      {avgRating !== undefined ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                          <Ionicons name="star" size={12} color="#FFD700" style={{ marginRight: 2 }} />
                          <Text style={styles.accessChipRating}>{avgRating.toFixed(1)}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.accessChipRating, { color: '#b0b0b0', marginTop: 1 }]}>N/A</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Avaliações ({reviews.length})</Text>
            {reviews.length > 0 ? (
              <>
                {reviews.slice(-reviewsToShow).reverse().map(item => (
                  <View key={item.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      {item.photoURL ? (
                        <Image source={{uri: item.photoURL}} style={styles.reviewerPhoto} />
                      ) : (
                        <View style={styles.reviewerPhotoPlaceholder}>
                          <Ionicons name="person-outline" size={18} color="#666" />
                        </View>
                      )}
                      <View style={styles.reviewHeaderText}>
                        <Text style={styles.reviewUser}>{item.userName || 'Anônimo'}</Text>
                        {renderStars(item.rating, 16)}
                      </View>
                    </View>
                    {item.comment && <Text style={styles.reviewComment}>{item.comment}</Text>}
                    {item.featureRatings && Object.keys(item.featureRatings).length > 0 && (
                      <View style={styles.detailedRatingsContainer}>
                        {Object.entries(item.featureRatings).map(([feature, rating]) => {
                          const featureData = getFeatureData(feature);
                          return (
                            <View key={feature} style={styles.detailedRatingItem}>
                              <Ionicons name={featureData.icon} size={16} color={getRatingColor(rating)} />
                              <Text style={styles.detailedRatingText}>{featureData.name}:</Text>
                              {renderStars(rating, 14)}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    <Text style={styles.reviewDate}>
                      {item.createdAt?.toDate?.().toLocaleDateString?.('pt-BR') || ''}
                    </Text>
                  </View>
                ))}
                {reviewsToShow < reviews.length && (
                  <TouchableOpacity style={{ alignSelf: 'center', marginTop: 10 }} onPress={() => setReviewsToShow(reviewsToShow + 3)}>
                    <Text style={{ color: Colors.primary.dark, fontWeight: 'bold', fontSize: 15 }}>Ver mais avaliações</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.noReviewsText}>Nenhuma avaliação ainda.</Text>
            )}
          </View>
          <View style={{ position: 'relative', marginVertical: 16 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#b0b0b0', borderRadius: 10, padding: 12, alignItems: 'center', opacity: 0.7 }}
              disabled={true}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginTop: 2 }}>Contribuir</Text>
            </TouchableOpacity>
            <View style={{ position: 'absolute', top: 6, right: 16, backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 12 }}>Em breve</Text>
            </View>
          </View>
          <Text style={{ fontWeight: 'bold', color: '#1976d2', fontSize: 17, marginBottom: 8 }}>Contribuições da Comunidade</Text>
          <ContributionsList locationId={location.id} />
        </View>
      </ScrollView>
      <ReviewModal 
        visible={reviewModalVisible} 
        onClose={() => setReviewModalVisible(false)}
        onSubmit={handleReviewSubmit}
        locationName={location.name}
        features={location.accessibilityFeatures || []}
      />
      <Snackbar
        visible={xpSnackbar.visible}
        onDismiss={() => setXpSnackbar({ ...xpSnackbar, visible: false })}
        duration={2000}
        style={{ backgroundColor: '#43e97b', borderRadius: 16, marginBottom: 60 }}
        action={{ label: '🎉', onPress: () => setXpSnackbar({ ...xpSnackbar, visible: false }) }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{xpSnackbar.message}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.screen,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.screen,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.darkSecondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: Colors.text.darkPrimary,
  },
  retryButton: {
    backgroundColor: Colors.primary.dark,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  locationImage: {
    width: '100%',
    height: 250,
  },
  mainContent: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  locationName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.text.darkPrimary,
    marginBottom: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.dark,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.darkPrimary,
    marginBottom: 12,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  ratingScore: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.text.darkPrimary,
    marginRight: 12,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewCount: {
    fontSize: 14,
    color: Colors.text.darkSecondary,
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.darkPrimary,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridButton: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gridButtonGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureItem: {
    alignItems: 'center',
    width: '33%',
    paddingVertical: 12,
  },
  featureText: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.text.darkSecondary,
    textAlign: 'center',
  },
  reviewItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUser: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text.darkPrimary,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.text.darkSecondary,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.text.darkSecondary,
    textAlign: 'right',
    marginTop: 8,
  },
  noReviewsText: {
    fontSize: 14,
    color: Colors.text.darkSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  mapModalContainer: {
    flex: 1,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 16,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  map: {
    flex: 1,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 12,
  },
  authorPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  authorPhotoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorText: {
    fontSize: 14,
    color: Colors.text.darkSecondary,
  },
  emojiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  emojiText: {
    fontSize: 16,
    marginRight: 6,
  },
  emojiTagText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  featureRatingText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewHeaderText: {
    flex: 1,
  },
  detailedRatingsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
  },
  detailedRatingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailedRatingText: {
    fontSize: 13,
    color: Colors.text.darkSecondary,
    marginHorizontal: 8,
  },
  reviewerPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    margin: 4,
    minWidth: 70,
    maxWidth: 90,
    flex: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    transform: [{ scale: 1 }],
  },
  accessChipLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  accessChipRating: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#222',
  },
  distanceBadgeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(25, 118, 210, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
    marginBottom: 4,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
});