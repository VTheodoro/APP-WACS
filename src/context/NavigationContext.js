import React, { createContext, useContext, useState, useRef } from 'react';
import Constants from 'expo-constants';
import { decodePolyline, calculateDistance } from '../utils/mapUtils';

export const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const [routeData, setRouteData] = useState(null); // { origin, destination, polyline, steps, info }
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navigationError, setNavigationError] = useState(null);
  const navigationInterval = useRef(null);
  const [lastUserLocation, setLastUserLocation] = useState(null);

  // Buscar rota na API do Google Directions
  async function requestRoute(origin, destination, apiKey) {
    setNavigationError(null);
    setRouteData(null);
    if (!origin || !destination) {
      setNavigationError('Origem ou destino inválido.');
      return;
    }
    if (!apiKey) {
      // Evita travar caso a API key não esteja disponível; mostra erro amigável
      setNavigationError('Chave da API do Google Maps ausente.');
      return;
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=walking&key=${apiKey}&language=pt-BR`;
      console.log('[NavigationContext] requestRoute URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('[NavigationContext] requestRoute resposta:', data);
      if (data.routes && data.routes.length > 0) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        const leg = data.routes[0].legs[0];
        const steps = leg.steps.map(step => ({
          distance: step.distance.text,
          duration: step.duration.text,
          instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
          startLocation: step.start_location,
          endLocation: step.end_location,
          maneuver: step.maneuver || '',
          polyline: decodePolyline(step.polyline.points)
        }));
        setRouteData({
          origin,
          destination,
          polyline: points,
          steps,
          info: {
            distance: leg.distance.text,
            duration: leg.duration.text,
            start_address: leg.start_address,
            end_address: leg.end_address,
            instruction: leg.steps[0]?.html_instructions.replace(/<[^>]+>/g, '') || '',
          }
        });
      } else {
        setNavigationError(data.status || 'Rota não encontrada');
        console.warn('[NavigationContext] Rota não encontrada ou erro:', data.status, data.error_message);
      }
    } catch (e) {
      setNavigationError('Erro ao buscar rota');
      console.error('[NavigationContext] Erro ao buscar rota:', e);
    }
  }

  function startNavigation() {
    setIsNavigating(true);
    setCurrentStepIndex(0);
  }

  function stopNavigation() {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    if (navigationInterval.current) {
      clearInterval(navigationInterval.current);
      navigationInterval.current = null;
    }
  }

  function cancelNavigation() {
    stopNavigation();
    setRouteData(null);
    setNavigationError(null);
  }

  function resetNavigation() {
    stopNavigation();
    setRouteData(null);
    setNavigationError(null);
  }

  function clearAllNavigation() {
    stopNavigation();
    setRouteData(null);
    setNavigationError(null);
    setCurrentStepIndex(0);
  }

  // Novo: monitorar posição do usuário e recalcular rota se desviar >30m
  async function updateUserLocation(location) {
    setLastUserLocation(location);
    if (isNavigating && routeData && routeData.polyline && routeData.polyline.length > 0) {
      // Verificar distância do usuário ao ponto mais próximo da rota
      let minDist = Infinity;
      for (let i = 0; i < routeData.polyline.length; i++) {
        const point = routeData.polyline[i];
        const dist = calculateDistance(location.latitude, location.longitude, point.latitude, point.longitude);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > 30) {
        await requestRoute(
          location,
          routeData.destination,
          Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || Constants.manifest2?.extra?.GOOGLE_MAPS_API_KEY
        );
      }
    }
  }

  return (
    <NavigationContext.Provider value={{
      routeData,
      isNavigating,
      currentStepIndex,
      navigationError,
      requestRoute,
      startNavigation,
      stopNavigation,
      cancelNavigation,
      resetNavigation,
      setCurrentStepIndex,
      clearAllNavigation,
      updateUserLocation,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  return useContext(NavigationContext);
}