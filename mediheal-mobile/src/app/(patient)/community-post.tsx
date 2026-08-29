import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { AppButton } from '../../components/AppButton';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import {
  getCommunityPostById,
  addCommunityComment,
  removeCommunityComment,
  removeCommunityPost,
} from '../../services/communityService';
import { CommunityPost, CommunityComment } from '../../types/community';
import { useTheme } from '../../context/ThemeContext';

export default function SingleCommunityPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchPostDetails = useCallback(async () => {
    if (!params.id) {
      setErrorMsg('Post ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getCommunityPostById(params.id);
      if (res && res.success && res.data) {
        setPost(res.data.post);
        setComments(res.data.comments || []);
        if (res.data.disclaimer) setDisclaimer(res.data.disclaimer);
      } else {
        setErrorMsg('Failed to load community discussion.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve post details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPostDetails();
  }, [fetchPostDetails]);

  const handleAddComment = async () => {
    if (!params.id) return;
    const cleanContent = commentText.trim();

    if (cleanContent.length === 0) {
      Alert.alert('Validation Error', 'Please enter a comment.');
      return;
    }

    if (cleanContent.length > 1000) {
      Alert.alert('Validation Error', 'Comment cannot exceed 1000 characters.');
      return;
    }

    setSubmittingComment(true);

    try {
      const res = await addCommunityComment(params.id, { content: cleanContent });
      if (res && res.success) {
        setCommentText('');
        // Refresh discussion details
        fetchPostDetails();
      } else {
        Alert.alert('Error', res.message || 'Failed to post comment.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleRemoveComment = (commentId: string) => {
    Alert.alert(
      'Remove Comment',
      'Are you sure you want to remove your comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => performRemoveComment(commentId),
        },
      ]
    );
  };

  const performRemoveComment = async (commentId: string) => {
    try {
      const res = await removeCommunityComment(commentId);
      if (res && res.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      } else {
        Alert.alert('Error', res.message || 'Failed to remove comment.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to remove comment.');
    }
  };

  const handleRemovePost = () => {
    if (!post) return;
    Alert.alert(
      'Remove Post',
      'Are you sure you want to remove this post?',
      [
        { text: 'Keep Post', style: 'cancel' },
        {
          text: 'Remove Post',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await removeCommunityPost(post._id);
              if (res && res.success) {
                Alert.alert('Post Removed', 'Your post has been removed successfully.');
                router.back();
              } else {
                Alert.alert('Error', res.message || 'Failed to remove post.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to remove post.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return (
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ` on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      );
    } catch (e) {
      return isoStr;
    }
  };

  if (loading) {
    return <LoadingView message="Loading discussion..." />;
  }

  if (errorMsg || !post) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Community Post" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg || 'Post not found.'} onRetry={fetchPostDetails} />
      </ScreenContainer>
    );
  }

  const authorName =
    typeof post.authorId === 'object' && post.authorId?.fullName
      ? post.authorId.fullName
      : 'Community Member';

  const authorRole =
    typeof post.authorId === 'object' && post.authorId?.role
      ? post.authorId.role
      : 'patient';

  const isPostOwner =
    user?._id &&
    ((typeof post.authorId === 'object' && post.authorId?._id === user._id) ||
      post.authorId === user._id);

  const initials =
    authorName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'CM';

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Discussion Details"
        subtitle="Community Health Thread"
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Disclaimer Box */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              ℹ️ {disclaimer || 'Community content is shared by users and should not be considered professional medical advice.'}
            </Text>
          </View>

          {/* Full Post Card */}
          <View style={[styles.postCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.postHeaderRow}>
              <View style={[styles.avatarCircle, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
                <Text style={[styles.avatarText, { color: themeColors.primary }]}>{initials}</Text>
              </View>

              <View style={styles.authorCol}>
                <Text style={[styles.authorName, { color: themeColors.textPrimary }]}>{authorName}</Text>
                <Text style={[styles.authorSub, { color: themeColors.textMuted }]}>
                  {authorRole === 'caregiver' ? 'Caregiver • ' : 'Patient • '}
                  {formatDate(post.createdAt)}
                </Text>
              </View>

              <View style={[styles.categoryBadge, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
                <Text style={[styles.categoryText, { color: themeColors.primary }]}>{post.category.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={[styles.postTitle, { color: themeColors.textPrimary }]}>{post.title}</Text>
            <Text style={[styles.postContent, { color: themeColors.textPrimary }]}>{post.content}</Text>

            {isPostOwner && (
              <View style={[styles.ownerActionsRow, { borderTopColor: themeColors.border }]}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/community-edit' as any,
                      params: { id: post._id },
                    })
                  }
                >
                  <Text style={[styles.editBtnText, { color: themeColors.primary }]}>✏️ Edit Post</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleRemovePost}>
                  <Text style={[styles.deleteBtnText, { color: themeColors.danger }]}>🗑️ Delete Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Comments Section Header */}
          <Text style={[styles.commentsSectionTitle, { color: themeColors.textPrimary }]}>
            Comments & Discussion ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <View style={[styles.noCommentsBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.noCommentsText, { color: themeColors.textSecondary }]}>
                No comments yet. Start the conversation below!
              </Text>
            </View>
          ) : (
            comments.map((comment) => {
              const cAuthorName =
                typeof comment.authorId === 'object' && comment.authorId?.fullName
                  ? comment.authorId.fullName
                  : 'User';

              const cAuthorRole =
                typeof comment.authorId === 'object' && comment.authorId?.role
                  ? comment.authorId.role
                  : 'patient';

              const isCommentOwner =
                user?._id &&
                ((typeof comment.authorId === 'object' && comment.authorId?._id === user._id) ||
                  comment.authorId === user._id);

              const cInitials =
                cAuthorName
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'U';

              return (
                <View key={comment._id} style={[styles.commentCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={styles.commentHeaderRow}>
                    <View style={[styles.cAvatarCircle, { backgroundColor: themeColors.surfaceSecondary }]}>
                      <Text style={[styles.cAvatarText, { color: themeColors.success }]}>{cInitials}</Text>
                    </View>

                    <View style={styles.cAuthorCol}>
                      <Text style={[styles.cAuthorName, { color: themeColors.textPrimary }]}>{cAuthorName}</Text>
                      <Text style={[styles.cAuthorSub, { color: themeColors.textMuted }]}>
                        {cAuthorRole === 'caregiver' ? 'Caregiver • ' : ''}
                        {formatDate(comment.createdAt)}
                      </Text>
                    </View>

                    {isCommentOwner && (
                      <TouchableOpacity
                        onPress={() => handleRemoveComment(comment._id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.cDeleteText, { color: themeColors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.commentContent, { color: themeColors.textSecondary }]}>{comment.content}</Text>
                </View>
              );
            })
          )}

          {/* Add Comment Input Area */}
          <View style={[styles.addCommentBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.addCommentLabel, { color: themeColors.textPrimary }]}>Write a Comment / Response</Text>
            <TextInput
              style={[styles.commentInput, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Share your thoughts or helpful answer..."
              placeholderTextColor={themeColors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={1000}
            />
            <AppButton
              title={submittingComment ? 'Posting...' : 'Post Comment'}
              onPress={handleAddComment}
              variant="primary"
              disabled={submittingComment}
              style={styles.postCommentBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  authorCol: {
    flex: 1,
  },
  authorName: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
  },
  authorSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  categoryBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  categoryText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  postTitle: {
    ...typography.header,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  postContent: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    marginVertical: spacing.xs,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  editBtnText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  deleteBtnText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  commentsSectionTitle: {
    ...typography.subheader,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  noCommentsBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noCommentsText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  commentCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  cAvatarText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.success,
    fontSize: 12,
  },
  cAuthorCol: {
    flex: 1,
  },
  cAuthorName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  cAuthorSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  cDeleteText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  commentContent: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 20,
  },
  addCommentBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  addCommentLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  commentInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    marginBottom: spacing.sm,
  },
  postCommentBtn: {
    minHeight: 40,
  },
});
