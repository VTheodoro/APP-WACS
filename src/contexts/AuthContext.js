import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { saveLastUser } from '../utils/storage';
import { saveImageLocally, deleteLocalImage } from '../services/storage';
import { uploadProfilePicture, deleteProfilePicture } from '../services/profilePictureService';
import { Alert } from 'react-native';
import { saveUserData, getUserData, updateUserData } from '../services/firebase/user';
import { fetchLocations, fetchReviewsForLocation } from '../services/firebase/locations';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Função para calcular e atualizar gamificação do usuário
  async function calculateAndUpdateGamification(uid) {
    // Buscar todas as avaliações feitas pelo usuário
    let reviewsCount = 0;
    let locationsCount = 0;
    try {
      // Buscar todos os locais e reviews
      const locations = await fetchLocations();
      locationsCount = locations.filter(l => l.author?.id === uid || l.userId === uid).length;
      let allReviews = [];
      for (const loc of locations) {
        const reviews = await fetchReviewsForLocation(loc.id);
        allReviews = allReviews.concat(reviews.filter(r => r.userId === uid || r.user?.id === uid));
      }
      reviewsCount = allReviews.length;
    } catch (e) {
      // fallback: não atualiza
      return;
    }
    // Regras de XP e níveis
    const XP_RULES = { review: 10, add_location: 30 };
    const LEVELS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 999999];
    let xp = reviewsCount * XP_RULES.review + locationsCount * XP_RULES.add_location;
    let level = 1;
    for (let i = 1; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i]) level = i + 1;
      else break;
    }
    // Badges
    let badges = [];
    if (xp >= 50) badges.push('primeiros_passos');
    if (reviewsCount >= 100) badges.push('mestre_avaliacoes');
    // Atualizar no Firestore
    await updateUserData(uid, { xp, level, badges, reviewsDone: reviewsCount, locationsAdded: locationsCount });
  }

  // Monitorar estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let firestoreUser = null;
        try {
          firestoreUser = await getUserData(firebaseUser.uid);
        } catch (e) {
          firestoreUser = null;
        }
        const formattedUser = {
          id: firebaseUser.uid,
          name: firestoreUser?.name || firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email,
          photoURL: firestoreUser?.photoURL || firebaseUser.photoURL || null,
          birthdate: firestoreUser?.birthdate || '',
          cidade: firestoreUser?.cidade || '',
          mobilityType: firestoreUser?.mobilityType || '',
          comorbidades: firestoreUser?.comorbidades || [],
          acceptTerms: firestoreUser?.acceptTerms !== undefined ? firestoreUser.acceptTerms : true,
          phoneNumber: firestoreUser?.phoneNumber || firestoreUser?.phone || '',
          instagram: firestoreUser?.instagram || '',
          xp: firestoreUser?.xp || 0,
          level: firestoreUser?.level || 1,
          badges: firestoreUser?.badges || [],
          streak: firestoreUser?.streak || 0,
          reviewsDone: firestoreUser?.reviewsDone || 0,
          locationsAdded: firestoreUser?.locationsAdded || 0,
        };
        setUser(formattedUser);
        saveLastUser(formattedUser);
        setLoading(false);
        // Atualizar gamificação em background
        calculateAndUpdateGamification(firebaseUser.uid);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Login com email e senha
  const login = async (email, password) => {
    try {
      setError(null);

      await signInWithEmailAndPassword(auth, email, password);

      return true;
    } catch (err) {
      console.error('[AuthContext] Erro no login:', err.message);
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  // Registro de novo usuário
  const register = async (email, password, name, extraData = {}) => {
    try {
      setError(null);
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      // Adicionar o nome de exibição
      if (name) {
        await updateProfile(firebaseUser, { displayName: name });
      }
      // Salvar dados extras no Firestore
      await saveUserData(firebaseUser.uid, {
        name,
        email,
        ...extraData,
      });
      return true;
    } catch (err) {
      console.error('Erro no registro:', err.message);
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      return true;
    } catch (err) {
      console.error('Erro ao fazer logout:', err.message);
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  // Atualizar dados do usuário
  const updateUser = async (userData) => {
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, userData);
        // Atualizar no Firestore
        await updateUserData(auth.currentUser.uid, userData);
        setUser(prev => ({
          ...prev,
          ...userData
        }));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err.message);
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  // Atualizar foto de perfil
  const updateProfilePicture = async (imageAsset, onProgress = null) => {
    if (!user || !imageAsset) {
      Alert.alert('Erro', 'Usuário ou imagem inválidos');
      return;
    }

    try {
      setIsUploading(true);
      
      // Fazer upload da imagem para o Firebase Storage com monitoramento de progresso e nome do usuário
      const photoURL = await uploadProfilePicture(
        user.id, 
        imageAsset, 
        onProgress, 
        user.name
      );
      
      if (!photoURL) {
        throw new Error('Falha ao fazer upload da imagem');
      }

      // Atualizar o perfil do usuário com a nova URL da foto
      await updateProfile(auth.currentUser, { photoURL });

      // Atualizar estado local
      setUser(prev => ({
        ...prev,
        photoURL
      }));

      // Salvar imagem localmente para cache
      await saveImageLocally(user.id, imageAsset);
      
      // Atualizar dados do último usuário
      saveLastUser({
        ...user,
        photoURL
      });

      return photoURL;
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto de perfil. Tente novamente.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Deletar foto de perfil
  const removeProfilePicture = async (photoURL = null) => {
    if (!user) {
      Alert.alert('Erro', 'Usuário não encontrado');
      return;
    }

    try {
      setIsUploading(true);

      // Deletar foto do Firebase Storage
      await deleteProfilePicture(user.id, photoURL || user.photoURL);

      // Atualizar perfil do usuário removendo a foto
      await updateProfile(auth.currentUser, { photoURL: null });

      // Atualizar estado local
      setUser(prev => ({
        ...prev,
        photoURL: null
      }));

      // Deletar imagem local
      await deleteLocalImage(user.id);
      
      // Atualizar dados do último usuário
      saveLastUser({
        ...user,
        photoURL: null
      });

      Alert.alert('Sucesso', 'Foto de perfil removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover foto de perfil:', error);
      Alert.alert('Erro', 'Não foi possível remover a foto de perfil. Tente novamente.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Alterar senha do usuário
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }
      
      // Reautenticar o usuário antes de alterar a senha
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Alterar a senha
      await updatePassword(auth.currentUser, newPassword);
      
      return true;
    } catch (err) {
      console.error('Erro ao alterar senha:', err.message);
      
      // Tratamento específico para erro de senha atual incorreta
      if (err.code === 'auth/wrong-password') {
        setError('Senha atual incorreta');
      } else {
        setError(getErrorMessage(err.code));
      }
      
      throw err;
    }
  };

  // Função auxiliar para tratamento de erros
  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email ou senha incorretos';
      case 'auth/email-already-in-use':
        return 'Este email já está em uso';
      case 'auth/weak-password':
        return 'A senha precisa ter pelo menos 6 caracteres';
      case 'auth/invalid-email':
        return 'Email inválido';
      case 'auth/network-request-failed':
        return 'Erro de conexão com a internet';
      default:
        return 'Ocorreu um erro, tente novamente';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      isUploading,
      login,
      register,
      logout,
      updateUser,
      updateProfilePicture,
      removeProfilePicture,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};