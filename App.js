import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { BluetoothProvider } from './src/contexts/BluetoothContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SearchHistoryProvider } from './src/contexts/SearchHistoryContext';
import { ChatProvider } from './src/contexts/ChatContext';
import * as SplashScreen from 'expo-splash-screen';
import CustomSplashScreen from './src/screens/SplashScreen'; // Import your custom splash screen
import { NavigationProvider } from './src/context/NavigationContext';
import Toast from './src/components/common/Toast';
import { Image, View, Text } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState(null);

  return (
    <NavigationProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <BluetoothProvider>
              <AppWithAuth
                appIsReady={appIsReady}
                setAppIsReady={setAppIsReady}
                splashAnimationComplete={splashAnimationComplete}
                setSplashAnimationComplete={setSplashAnimationComplete}
                showWelcome={showWelcome}
                setShowWelcome={setShowWelcome}
                welcomeUser={welcomeUser}
                setWelcomeUser={setWelcomeUser}
              />
            </BluetoothProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </NavigationProvider>
  );
}

function AppWithAuth({
  appIsReady,
  setAppIsReady,
  splashAnimationComplete,
  setSplashAnimationComplete,
  showWelcome,
  setShowWelcome,
  welcomeUser,
  setWelcomeUser
}) {
  const { user, loading } = require('./src/contexts/AuthContext').useAuth();

  // Splash logic
  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onSplashAnimationComplete = useCallback(() => {
    setSplashAnimationComplete(true);
  }, [setSplashAnimationComplete]);

  useEffect(() => {
    if (appIsReady && splashAnimationComplete && !loading) {
      require('expo-splash-screen').hideAsync();
    }
  }, [appIsReady, splashAnimationComplete, loading]);

  // Exibir Toast de boas-vindas ao detectar login automático
  useEffect(() => {
    if (!loading && user) {
      setWelcomeUser(user);
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [loading, user, setShowWelcome]);

  if (!appIsReady || !splashAnimationComplete || loading) {
    return <CustomSplashScreen onAnimationComplete={onSplashAnimationComplete} />;
  }

  return (
    <NavigationContainer>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <AppNavigator />
        {/* Toast de boas-vindas */}
        <Toast
          visible={showWelcome}
          type="success"
          duration={3500}
          onHide={() => setShowWelcome(false)}
          message={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {welcomeUser?.photoURL ? (
                <Image source={{ uri: welcomeUser.photoURL }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1976d2', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{welcomeUser?.name?.charAt(0) || '?'}</Text>
                </View>
              )}
              <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 16 }}>Bem-vindo de volta, {welcomeUser?.name?.split(' ')[0] || 'usuário'}!</Text>
            </View>
          }
        />
      </SafeAreaView>
    </NavigationContainer>
  );
}