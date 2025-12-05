import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Mapa de tipos de locais para ícones
const PLACE_TYPE_ICONS = {
  restaurant: { lib: 'MaterialCommunityIcons', name: 'silverware-fork-knife' },
  bar: { lib: 'MaterialCommunityIcons', name: 'glass-cocktail' },
  hotel: { lib: 'FontAwesome5', name: 'bed' },
  park: { lib: 'MaterialCommunityIcons', name: 'tree' },
  hospital: { lib: 'MaterialCommunityIcons', name: 'hospital-building' },
  pharmacy: { lib: 'MaterialCommunityIcons', name: 'pill' },
  store: { lib: 'MaterialCommunityIcons', name: 'shopping' },
  supermarket: { lib: 'MaterialCommunityIcons', name: 'cart' },
  school: { lib: 'Ionicons', name: 'school' },
  gym: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  bank: { lib: 'MaterialCommunityIcons', name: 'bank' },
  post_office: { lib: 'MaterialCommunityIcons', name: 'email' },
  cinema: { lib: 'MaterialCommunityIcons', name: 'movie' },
  theater: { lib: 'MaterialCommunityIcons', name: 'theater' },
  default: { lib: 'FontAwesome5', name: 'map-marker-alt' },
};

// Helper para determinar a cor do marcador com base na avaliação
const getMarkerStyle = (rating = 0) => {
  if (rating >= 4.0) {
    return {
      color: '#4CAF50', // Verde vibrante
      shadowColor: '#1B5E20',
    };
  }
  if (rating >= 2.5) {
    return {
      color: '#FFC107', // Amarelo
      shadowColor: '#FF6F00',
    };
  }
  if (rating > 0) {
    return {
      color: '#F44336', // Vermelho
      shadowColor: '#B71C1C',
    };
  }
  return {
    color: '#9E9E9E', // Cinza
    shadowColor: '#424242',
  };
};

const AccessibleMarker = ({ location, isSelected }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const { color, shadowColor } = getMarkerStyle(location.rating);

  // Selecionar ícone baseado no tipo
  const placeType = location.placeType || 'default';
  const iconConfig = PLACE_TYPE_ICONS[placeType] || PLACE_TYPE_ICONS.default;

  const renderIcon = () => {
    const size = isSelected ? 20 : 16;
    const color = '#fff';

    if (iconConfig.lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={iconConfig.name} size={size} color={color} />;
    }
    if (iconConfig.lib === 'Ionicons') {
      return <Ionicons name={iconConfig.name} size={size} color={color} />;
    }
    return <FontAwesome5 name={iconConfig.name} size={size} color={color} />;
  };

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.25 : 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [isSelected, scaleAnim]);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.pin, { backgroundColor: color, shadowColor, elevation: isSelected ? 12 : 6 }]}>
        {renderIcon()}
      </View>
      <View style={[styles.arrow, { borderTopColor: color }]} />
      {/* Ponto de sombra no chão para dar efeito de flutuar */}
      <View style={styles.shadowBase} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60, // Espaço reservado para o pin e a sombra
  },
  pin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    zIndex: 2,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -8, // Sobrepõe para conectar
    zIndex: 1,
  },
  shadowBase: {
    width: 14,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 2,
    marginTop: 2,
  },
});

export default AccessibleMarker; 