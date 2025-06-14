import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image, Pressable, FlatList, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Borders, Shadows } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

export const PostsFeedScreen = () => {
  const navigation = useNavigation();
  const [postText, setPostText] = useState('');
  const { user } = useAuth();

  // Placeholder data for demonstration
  const feedItems = [
    {
      id: '1',
      profilePic: user?.photoURL || 'https://via.placeholder.com/40/BDBDBD/FFFFFF?text=VP',
      name: user?.name || 'Você',
      time: 'agora mesmo',
      text: postText || 'Bem-vindo(a) à Comunidade WACS! Use este espaço para compartilhar suas experiências e interagir com outros usuários.',
      likes: 0,
      comments: 0,
      hasImage: false,
    },
    {
      id: '2',
      profilePic: 'https://via.placeholder.com/40/33FF57/FFFFFF?text=MO', // Placeholder for Maria Oliveira
      name: 'Maria Oliveira',
      time: 'há 3 horas',
      text: 'Muito feliz em ver a comunidade WACS crescendo! Juntos somos mais fortes para promover a inclusão. #ComunidadeWACS',
      likes: 28,
      comments: 7,
      hasImage: true, // Placeholder for image
      postImage: 'https://via.placeholder.com/300x200?text=Imagem+do+Post',
    },
  ];

  const renderFeedItem = ({ item }) => (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Image source={{ uri: item.profilePic }} style={styles.feedProfilePic} />
        <View>
          <Text style={styles.feedName}>{item.name}</Text>
          <Text style={styles.feedTime}>{item.time}</Text>
        </View>
      </View>
      <Text style={styles.feedText}>{item.text}</Text>
      {item.hasImage && <Image source={{ uri: item.postImage }} style={styles.feedPostImage} />}
      <View style={styles.feedActions}>
        <View style={styles.feedActionItem}>
          <Ionicons name="heart-outline" size={Typography.fontSizes.md} color={Colors.text.darkSecondary} />
          <Text style={styles.feedActionText}>{item.likes} Curtidas</Text>
        </View>
        <View style={styles.feedActionItem}>
          <Ionicons name="chatbubble-outline" size={Typography.fontSizes.md} color={Colors.text.darkSecondary} />
          <Text style={styles.feedActionText}>{item.comments} Comentários</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {/* Seção de Postagem */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <Image source={{ uri: user?.photoURL || 'https://via.placeholder.com/40/BDBDBD/FFFFFF?text=VP' }} style={styles.feedProfilePic} />
            <TextInput
              style={styles.postInput}
              placeholder="O que você está pensando?"
              placeholderTextColor={Colors.text.darkTertiary}
              multiline
              value={postText}
              onChangeText={setPostText}
            />
          </View>
          <View style={styles.postActions}>
            <Pressable style={styles.postActionButton}>
              <Ionicons name="image-outline" size={Typography.fontSizes.xl} color={Colors.primary.dark} />
              <Text style={styles.postActionText}>Foto</Text>
            </Pressable>
            <Pressable style={styles.postActionButton}>
              <Ionicons name="videocam-outline" size={Typography.fontSizes.xl} color={Colors.primary.dark} />
              <Text style={styles.postActionText}>Vídeo</Text>
            </Pressable>
            <LinearGradient
              colors={[Colors.primary.dark, Colors.primary.light]}
              style={styles.publishButtonGradient}
            >
              <Pressable style={styles.publishButton} onPress={() => console.log('Publicar:', postText)}>
                <Text style={styles.publishButtonText}>Publicar</Text>
              </Pressable>
            </LinearGradient>
          </View>
        </View>

        {/* Feed da Comunidade */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Feed da Comunidade</Text>
          <FlatList
            data={feedItems}
            keyExtractor={item => item.id}
            renderItem={renderFeedItem}
            scrollEnabled={false} // Nested ScrollView - disable inner scroll
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.screen,
  },
  scrollViewContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl * 2, // Extra padding at bottom
  },
  sectionContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: Borders.radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.default,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text.darkPrimary,
    marginBottom: Spacing.lg,
  },
  // Postagem Section
  postCard: {
    backgroundColor: Colors.background.card,
    borderRadius: Borders.radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.default,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  postInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.background.screen,
    borderRadius: Borders.radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.fontSizes.md,
    color: Colors.text.darkPrimary,
    textAlignVertical: 'top',
    borderWidth: Borders.width.sm,
    borderColor: Colors.border.light,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Borders.radius.xs,
    backgroundColor: Colors.background.disabled,
  },
  postActionText: {
    marginLeft: Spacing.xs,
    fontSize: Typography.fontSizes.sm,
    color: Colors.primary.dark,
    fontWeight: Typography.fontWeights.semibold,
  },
  publishButtonGradient: {
    borderRadius: Borders.radius.sm,
    overflow: 'hidden',
  },
  publishButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishButtonText: {
    color: Colors.text.lightOnPrimary,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
  },
  // Feed da Comunidade
  feedCard: {
    backgroundColor: Colors.background.card,
    borderRadius: Borders.radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: Borders.width.sm,
    borderColor: Colors.border.light,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  feedProfilePic: {
    width: 40,
    height: 40,
    borderRadius: Borders.radius.circular,
    marginRight: Spacing.sm,
    borderWidth: Borders.width.sm,
    borderColor: Colors.primary.dark,
  },
  feedName: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.text.darkPrimary,
  },
  feedTime: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.text.darkSecondary,
  },
  feedText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.text.darkPrimary,
    marginBottom: Spacing.md,
  },
  feedPostImage: {
    width: '100%',
    height: 200,
    borderRadius: Borders.radius.md,
    resizeMode: 'cover',
    marginBottom: Spacing.md,
  },
  feedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  feedActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  feedActionText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.text.darkSecondary,
  },
}); 