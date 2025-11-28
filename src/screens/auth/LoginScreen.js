import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);
  const navigation = useNavigation();
  const { login, signInWithGoogle, loading: authLoading, user } = useAuth();
  const [navigating, setNavigating] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {

    if (user && !authLoading) {
      setNavigating(true);

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainSelection' }],
      });
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!isFocused && navigating) {
      setNavigating(false);
    }
  }, [isFocused, navigating]);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setIsLoading(true);

    try {
      await login(email, password);

    } catch (e) {
      setError('Email ou senha inválidos.');

    } finally {
      setIsLoading(false);

    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert('Recuperação de senha', 'Digite seu email para receber instruções.');
      return;
    }
    Alert.alert('Recuperação de senha', 'Se o email existir, você receberá instruções em breve.');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError('Falha ao fazer login com o Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Modal de carregamento global */}
      <Modal
        visible={isLoading || authLoading || navigating}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', elevation: 8 }}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={{ marginTop: 16, color: '#1976d2', fontWeight: 'bold', fontSize: 16 }}>Entrando...</Text>
            <Text style={{ marginTop: 8, color: '#888', fontSize: 12 }}>isLoading: {String(isLoading)} | authLoading: {String(authLoading)} | navigating: {String(navigating)}</Text>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#1976d2', '#2196f3']} style={styles.header}>
          <Image
            source={require('../../../assets/logos_wacs/logo_padrao_com_nome.png')}
            style={{ width: 120, height: 120, resizeMode: 'contain', marginBottom: 0, alignSelf: 'center' }}
            accessibilityLabel="Logo WACS"
          />
          <Text style={styles.headerSubtitle}>Acesse sua conta para continuar</Text>
        </LinearGradient>
        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.inputGroup}>
            <MaterialIcons name="email" size={22} color="#1976d2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#b0b0b0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              accessible={true}
              accessibilityLabel="Campo de email"
              importantForAutofill="yes"
              autoComplete="email"
            />
          </View>
          <View style={styles.inputGroup}>
            <MaterialIcons name="lock" size={22} color="#1976d2" style={styles.inputIcon} />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#b0b0b0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              accessible={true}
              accessibilityLabel="Campo de senha"
              importantForAutofill="yes"
              autoComplete="password"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              accessible={true}
              accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#1976d2"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.forgot} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Esqueceu a senha?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#1976d2', '#2196f3']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityLabel="Entrar com Google"
          >
            <FontAwesome5 name="google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
            <Text style={styles.googleButtonText}>Entrar com Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.register}
            onPress={() => navigation.navigate('RegisterScreen')}
            disabled={isLoading}
          >
            <Text style={styles.registerText}>Não tem uma conta? Registre-se</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e3f2fd',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 22,
    margin: 22,
    marginTop: -22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 18,
    alignSelf: 'center',
    letterSpacing: 0.2,
  },
  error: {
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 15,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 15,
    backgroundColor: '#f8fafc',
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
  },
  input: {
    flex: 1,
    padding: 16,
    paddingLeft: 48,
    borderRadius: 15,
    fontSize: 16,
    color: '#222',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    zIndex: 1,
    padding: 5,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    padding: 5,
  },
  forgotText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  button: {
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 0,
  },
  buttonGradient: {
    padding: 15,
    alignItems: 'center',
    borderRadius: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
    color: '#b0b0b0',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonText: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
  },
  register: {
    marginTop: 10,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 15,
    color: '#1976d2',
    fontWeight: 'bold',
  },
});

export default LoginScreen; 