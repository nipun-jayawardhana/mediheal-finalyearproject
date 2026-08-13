import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { CommunityPostCard } from '../../components/CommunityPostCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getCommunityPosts, removeCommunityPost } from '../../services/communityService';
import { CommunityPost, CommunityCategory, PaginationMetadata } from '../../types/community';

const CATEGORIES: { label: string; value: CommunityCategory | 'all' }[] = [
  { label: 'All Topics', value: 'all' },
  { label: 'General Q&A', value: 'general' },
  { label: 'Elderly Care', value: 'elderly-care' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Exercise', value: 'exercise' },
  { label: 'Medication', value: 'medication' },
  { label: 'Wellbeing', value: 'wellbeing' },
  { label: 'Other', value: 'other' },
];

export default function CaregiverCommunityFeedScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CommunityCategory | 'all'>('all');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [disclaimerText, setDisclaimerText] = useState<string>(
    'Community content is shared by users and should not be considered professional medical advice.'
  );

  const fetchPosts = useCallback(
    async (targetPage: number = 1, cat: CommunityCategory | 'all' = selectedCategory, isRefresh: boolean = false) => {
      if (targetPage === 1 && !isRefresh) setLoading(true);
      if (targetPage > 1) setLoadingMore(true);
      setErrorMsg('');

      try {
        const queryCategory = cat === 'all' ? undefined : cat;
        const res = await getCommunityPosts({
          category: queryCategory,
          page: targetPage,
          limit: 10,
        });

        if (res && res.success) {
          if (targetPage === 1) {
            setPosts(res.data || []);
          } else {
            setPosts((prev) => [...prev, ...(res.data || [])]);
          }
          if (res.pagination) setPagination(res.pagination);
          if (res.disclaimer) setDisclaimerText(res.disclaimer);
        } else {
          setErrorMsg(res.message || 'Failed to load community feed.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to fetch community posts.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [selectedCategory]
  );

  useFocusEffect(
    useCallback(() => {
      fetchPosts(1, selectedCategory, true);
    }, [selectedCategory])
  );

  const handleCategorySelect = (cat: CommunityCategory | 'all') => {
    setSelectedCategory(cat);
    setPage(1);
    fetchPosts(1, cat, false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPosts(1, selectedCategory, true);
  };

  const handleLoadMore = () => {
    if (pagination && page < pagination.pages && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage, selectedCategory, false);
    }
  };

  const handlePostPress = (post: CommunityPost) => {
    // Caregiver single post viewing
    Alert.alert(post.title, post.content);
  };

  const handleRemovePost = (post: CommunityPost) => {
    Alert.alert(
      'Remove Community Post',
      'Are you sure you want to remove your post from the community feed?',
      [
        { text: 'Keep Post', style: 'cancel' },
        {
          text: 'Remove Post',
          style: 'destructive',
          onPress: () => performRemovePost(post._id),
        },
      ]
    );
  };

  const performRemovePost = async (postId: string) => {
    try {
      const res = await removeCommunityPost(postId);
      if (res && res.success) {
        Alert.alert('Post Removed', 'Your post has been removed successfully.');
        setPosts((prev) => prev.filter((p) => p._id !== postId));
      } else {
        Alert.alert('Error', res.message || 'Failed to remove post.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to remove post.');
    }
  };

  if (loading && posts.length === 0) {
    return <LoadingView message="Loading caregiver community feed..." />;
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Community Health"
        subtitle="Caregiver Forum & Support Feed"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {/* Medical Disclaimer Banner */}
        <View style={styles.disclaimerBanner}>
          <Text style={styles.disclaimerIcon}>ℹ️</Text>
          <Text style={styles.disclaimerText}>{disclaimerText}</Text>
        </View>

        {/* Category Selector Chips */}
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleCategorySelect(cat.value)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Feed Content */}
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchPosts(1, selectedCategory, true)} />
        ) : null}

        {!errorMsg && posts.length === 0 && (
          <EmptyState
            icon="💬"
            title="No Community Posts Yet"
            description="No community discussions found in this topic."
          />
        )}

        {!errorMsg && posts.length > 0 && (
          <FlatList
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <CommunityPostCard
                post={item}
                currentUserId={user?._id}
                onPress={handlePostPress}
                onRemove={handleRemovePost}
              />
            )}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
              />
            }
            ListFooterComponent={
              pagination && page < pagination.pages ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  <Text style={styles.loadMoreText}>
                    {loadingMore ? 'Loading More...' : 'Load More Posts'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  disclaimerText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  categoriesContainer: {
    marginVertical: spacing.xs,
  },
  categoriesScroll: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  categoryChip: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  feedContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
  loadMoreBtn: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
});
