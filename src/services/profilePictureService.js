import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable, listAll } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

// Configurações de imagem
const IMAGE_CONFIG = {
  maxSize: 2 * 1024 * 1024, // 2MB
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.7, // 70% de qualidade
  allowedFormats: ['jpg', 'jpeg', 'png']
};

/**
 * Valida se a imagem atende aos requisitos
 * @param {object} imageAsset Objeto da imagem selecionada
 * @returns {Promise<boolean>} true se a imagem é válida
 */
const validateImage = async (imageAsset) => {
  if (!imageAsset || !imageAsset.uri) {
    Alert.alert('Erro', 'Imagem inválida');
    return false;
  }

  // Verificar tamanho
  const fileInfo = await FileSystem.getInfoAsync(imageAsset.uri);
  if (!fileInfo.exists) {
    Alert.alert('Erro', 'Arquivo não encontrado');
    return false;
  }

  if (fileInfo.size > IMAGE_CONFIG.maxSize) {
    Alert.alert(
      'Imagem muito grande',
      `O tamanho máximo permitido é ${(IMAGE_CONFIG.maxSize / 1024 / 1024).toFixed(1)}MB. ` +
      `Sua imagem tem ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB.`
    );
    return false;
  }

  // Verificar formato (extensão)
  const extension = imageAsset.uri.split('.').pop().toLowerCase();
  if (!IMAGE_CONFIG.allowedFormats.includes(extension)) {
    Alert.alert(
      'Formato não suportado',
      `Os formatos suportados são: ${IMAGE_CONFIG.allowedFormats.join(', ')}`
    );
    return false;
  }

  return true;
};

/**
 * Comprime e redimensiona a imagem
 * @param {string} uri URI da imagem original
 * @returns {Promise<string>} URI da imagem processada
 */
const processImage = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: {
          width: IMAGE_CONFIG.maxWidth,
          height: IMAGE_CONFIG.maxHeight,
        }}
      ],
      {
        compress: IMAGE_CONFIG.quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return result.uri;
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    throw error;
  }
};

/**
 * Deleta as fotos de perfil antigas do usuário
 * @param {string} userId ID do usuário
 * @returns {Promise<void>}
 */
const deleteOldProfilePictures = async (userId) => {
  try {
    const profilePicsRef = ref(storage, 'profile_pictures');
    const listResult = await listAll(profilePicsRef);
    
    const userPics = listResult.items.filter(item => {
      // Filtrar imagens que começam com o ID do usuário
      const name = item.name;
      return name.startsWith(userId);
    });

    // Deletar todas as fotos antigas do usuário
    const deletePromises = userPics.map(pic => deleteObject(pic));
    await Promise.all(deletePromises);
    

  } catch (error) {
    console.error('Erro ao deletar fotos antigas:', error);
    // Não propagamos o erro para não afetar o upload da nova foto
  }
};

/**
 * Formata o nome para usar em nomes de arquivos (remove caracteres especiais)
 * @param {string} name Nome original
 * @returns {string} Nome formatado
 */
const formatNameForFile = (name) => {
  if (!name) return '';
  // Remove caracteres especiais, acentos e espaços
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
};

/**
 * Faz upload da foto de perfil para o Firebase Storage
 * @param {string} userId ID do usuário
 * @param {object} imageAsset Objeto da imagem selecionada
 * @param {function} onProgress Função de callback para progresso do upload
 * @param {string} userName Nome do usuário para incluir no nome do arquivo
 * @returns {Promise<string|null>} URL da imagem no Firebase Storage ou null em caso de erro
 */
export const uploadProfilePicture = async (userId, imageAsset, onProgress = null, userName = null) => {
  if (!userId || !imageAsset || !imageAsset.uri) {
    console.error('Parâmetros inválidos para upload:', { userId, imageAsset });
    return null;
  }

  try {


    // Validar imagem
    const isValid = await validateImage(imageAsset);
    if (!isValid) {
      return null;
    }

    // Deletar fotos antigas primeiro
    await deleteOldProfilePictures(userId);

    // Processar imagem (comprimir e redimensionar)

    const processedImageUri = await processImage(imageAsset.uri);
    
    // Gerar nome de arquivo com nome do usuário, se disponível
    const timestamp = new Date().getTime();
    const formattedName = formatNameForFile(userName || 'user');
    const fileName = `${userId}_${formattedName}_profile_${timestamp}.jpg`;
    const storageRef = ref(storage, `profile_pictures/${fileName}`);

    // Converter a imagem para blob
    const response = await fetch(processedImageUri);
    const blob = await response.blob();

    // Fazer upload com monitoramento de progresso
    if (onProgress) {
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => {
            console.error('Erro durante upload:', error);
            reject(error);
          },
          async () => {
            // Upload completo, obter URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            resolve(downloadURL);
          }
        );
      });
    } else {
      // Método simples sem monitoramento de progresso
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    }
  } catch (error) {
    console.error('Erro ao fazer upload da foto de perfil:', error);
    throw error;
  }
};

/**
 * Deleta a foto de perfil do Firebase Storage
 * @param {string} userId ID do usuário
 * @param {string} photoURL URL da foto a ser deletada
 * @returns {Promise<boolean>} true se a deleção foi bem sucedida
 */
export const deleteProfilePicture = async (userId, photoURL) => {
  if (!userId) {
    console.error('ID do usuário não fornecido');
    return false;
  }

  try {


    // Se temos a URL, podemos extrair a referência direta
    let storageRef;
    
    if (photoURL && photoURL.includes('firebase')) {
      // Extrai a referência da URL do Firebase Storage
      storageRef = ref(storage, photoURL);
    } else {
      // Buscar todas as fotos de perfil do usuário (pode haver várias versões)
      const userPicsRef = ref(storage, `profile_pictures/${userId}`);
      storageRef = userPicsRef;
    }

    // Deletar o arquivo
    await deleteObject(storageRef);


    return true;
  } catch (error) {
    console.error('Erro ao deletar foto de perfil:', error);
    throw error;
  }
}; 