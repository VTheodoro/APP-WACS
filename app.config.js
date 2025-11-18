require('dotenv').config();

module.exports = {
  expo: {
    name: 'WACS',
    slug: 'app-wacs',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1A1A1A'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wacs.app',
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Precisamos acessar suas fotos para adicionar uma imagem ao local.",
        NSPhotoLibraryUsageDescription: "O WACS precisa de acesso à sua biblioteca de fotos para que você possa selecionar uma foto de perfil."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1A1A1A'
      },
      package: 'com.wacs.app',
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES'
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Permitir WACS acessar sua localização.'
        }
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'O WACS precisa de acesso à sua biblioteca de fotos para que você possa selecionar uma foto de perfil.'
        }
      ],
    ],
    extra: {
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      WEBSOCKET_URL: process.env.WEBSOCKET_URL,
      USE_BLUETOOTH_MOCK: process.env.USE_BLUETOOTH_MOCK,
      
    }
  }
};