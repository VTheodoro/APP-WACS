import React, { useEffect, useMemo } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { View } from 'react-native';
import UserMarker from './UserMarker';
import AccessibleMarker from './AccessibleMarker';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#1976d2',
  accent: '#43e97b',
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

export default function MapViewContainer({
  mapRef,
  location,
  destination,
  destinationContext,
  accessibleLocations,
  selectedLocation,
  setSelectedLocation,
  routeCoords,
  navigationSteps,
  currentStepIndex,
  isNavigating,
  simpleRouteCoords,
  mapInitialRegion,
  onLongPress,
  mapReady,
  setMapReady,
  user,
  obstacles = [],
  elevationSegments = [],
  is3DNavigation = false,
  heading = 0,
}) {
  const finalDestination = destinationContext || destination;
  function getSegmentColor(status) {
    if (status === 'good') return '#43e97b';
    if (status === 'moderate') return '#FFD600';
    if (status === 'critical') return '#FF5252';
    return '#1976d2';
  }
  useEffect(() => {
    if (is3DNavigation && mapRef?.current && location) {
      mapRef.current.animateCamera({
        center: { latitude: location.latitude, longitude: location.longitude },
        pitch: 60,
        heading: heading || 0,
        zoom: 18,
        altitude: 300,
      }, { duration: 800 });
    }
  }, [is3DNavigation, location, heading]);

  // Memoizar marcadores de locais acessíveis
  const accessibleMarkers = useMemo(() => (accessibleLocations && accessibleLocations.map((loc) => {
    let latitude = loc.latitude;
    let longitude = loc.longitude;
    if (loc.location && typeof loc.location === 'object') {
      if (typeof loc.location.latitude === 'number' && typeof loc.location.longitude === 'number') {
        latitude = loc.location.latitude;
        longitude = loc.location.longitude;
      }
    }
    if (!latitude || !longitude) {
      if (typeof loc.location === 'string') {
        const match = loc.location.match(/([\d.]+)[^\d-]*([S|N]),\s*([\d.]+)[^\d-]*([W|E])/i);
        if (match) {
          let lat = parseFloat(match[1]);
          let lng = parseFloat(match[3]);
          if (match[2].toUpperCase() === 'S') lat = -lat;
          if (match[4].toUpperCase() === 'W') lng = -lng;
          latitude = lat;
          longitude = lng;
        }
      }
    }
    if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
      const isSelected = selectedLocation && selectedLocation.id === loc.id;
      return (
        <Marker
          key={loc.id}
          coordinate={{ latitude, longitude }}
          onPress={() => setSelectedLocation(loc)}
          anchor={{ x: 0.5, y: 1 }}
          zIndex={isSelected ? 999 : 1}
        >
          <AccessibleMarker location={loc} isSelected={isSelected} />
        </Marker>
      );
    }
    return null;
  })), [accessibleLocations, selectedLocation, setSelectedLocation]);

  // Memoizar obstáculos
  const obstacleMarkers = useMemo(() => (obstacles.map((obs, idx) => (
    <Marker
      key={`obstacle-${idx}`}
      coordinate={{ latitude: obs.latitude, longitude: obs.longitude }}
      title={obs.type === 'step' ? 'Degrau' : obs.type === 'hole' ? 'Buraco' : obs.type === 'ramp' ? 'Rampa' : 'Obstáculo'}
      description={obs.description}
      pinColor={obs.severity === 'critical' ? '#FF5252' : obs.severity === 'moderate' ? '#FFD600' : '#43e97b'}
      accessibilityLabel={`Obstáculo: ${obs.type}`}
      accessibilityHint={obs.description}
    >
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: getSegmentColor(obs.severity), alignItems: 'center' }}>
        <Ionicons name={
          obs.type === 'step' ? 'remove-outline' :
            obs.type === 'hole' ? 'ellipse-outline' :
              obs.type === 'ramp' ? 'trending-up-outline' :
                'alert-circle-outline'
        } size={28} color={getSegmentColor(obs.severity)} />
      </View>
    </Marker>
  ))), [obstacles]);

  // Memoizar polylines
  const routePolyline = useMemo(() => (
    routeCoords.length > 0 && elevationSegments.length > 0 ? (
      elevationSegments.map((seg, idx) => (
        <Polyline
          key={idx}
          coordinates={[seg.start, seg.end]}
          strokeWidth={8}
          strokeColor={getSegmentColor(seg.status)}
          lineCap="round"
        />
      ))
    ) : routeCoords.length > 0 ? (
      <Polyline
        coordinates={routeCoords}
        strokeWidth={8}
        strokeColor={'#1976d2'}
        lineCap="round"
      />
    ) : null
  ), [routeCoords, elevationSegments]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1, borderRadius: 24, overflow: 'hidden', margin: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 }}
      customMapStyle={mapCustomStyle}
      provider={PROVIDER_GOOGLE}
      initialRegion={mapInitialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      onLongPress={onLongPress}
      onMapReady={() => setMapReady(true)}
      pitchEnabled={false}
      rotateEnabled={false}
      zoomEnabled={true}
      scrollEnabled={true}
    >
      {location && (
        <Marker
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={1000}
        >
          <UserMarker photoURL={user?.photoURL} />
        </Marker>
      )}
      {finalDestination && (
        <Marker
          coordinate={finalDestination}
          title="Destino"
          anchor={{ x: 0.5, y: 1 }}
          zIndex={999}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 4, elevation: 6, shadowColor: '#2196f3', shadowOpacity: 0.25, shadowRadius: 8 }}>
            <Ionicons name="location-sharp" size={32} color="#2196f3" />
          </View>
        </Marker>
      )}
      {accessibleMarkers}
      {routePolyline}
      {obstacleMarkers}
      {isNavigating && navigationSteps.length > 0 && currentStepIndex < navigationSteps.length && (
        <>
          <Polyline
            coordinates={routeCoords}
            strokeWidth={6}
            strokeColor={'#90caf9'}
            lineCap="round"
          />
          <Polyline
            coordinates={navigationSteps[currentStepIndex].polyline}
            strokeWidth={10}
            strokeColor={'#ff9800'}
            lineCap="round"
          />
        </>
      )}
      {simpleRouteCoords.length === 2 && (
        <Polyline
          coordinates={simpleRouteCoords}
          strokeWidth={6}
          strokeColor={'#43e97b'}
          lineDashPattern={[10, 10]}
          lineCap="round"
        />
      )}
    </MapView>
  );
} 