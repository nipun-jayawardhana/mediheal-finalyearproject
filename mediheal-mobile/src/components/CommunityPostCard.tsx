import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CommunityPost } from '../types/community';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

interface CommunityPostCardProps {
  post: CommunityPost;
  currentUserId?: string;
  onPress: (post: CommunityPost) => void;
  onEdit?: (post: CommunityPost) => void;
  onRemove?: (post: CommunityPost) => void;
}

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  currentUserId,
  onPress,
  onEdit,
  onRemove,
}) => {
  const authorName =
    typeof post.authorId === 'object' && post.authorId?.fullName
      ? post.authorId.fullName
      : 'Community Member';

  const authorRole =
    typeof post.authorId === 'object' && post.authorId?.role
      ? post.authorId.role
      : 'patient';

  const isOwner =
    currentUserId &&
    ((typeof post.authorId === 'object' && post.authorId?._id === currentUserId) ||
      post.authorId === currentUserId);

  // Generate clean initials
  const initials =
    authorName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'CM';

  // Format date string
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return isoStr;
    }
  };

  // Capitalize category badge
  const formatCategory = (cat: string) => {
    switch (cat) {
      case 'elderly-care':
        return 'Elderly Care';
      default:
        return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(post)}
    >
      {/* Top Author Row & Category Badge */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.authorCol}>
          <Text style={styles.authorName} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.authorSub}>
            {authorRole === 'caregiver' ? 'Caregiver • ' : ''}
            {formatDate(post.createdAt)}
          </Text>
        </View>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{formatCategory(post.category)}</Text>
        </View>
      </View>

      {/* Post Title */}
      <Text style={styles.postTitle} numberOfLines={2}>
        {post.title}
      </Text>

      {/* Post Content Snippet */}
      <Text style={styles.postSnippet} numberOfLines={3}>
        {post.content}
      </Text>

      {/* Footer Row */}
      <View style={styles.footerRow}>
        <Text style={styles.viewDiscussionText}>💬 View Discussion & Comments →</Text>

        {isOwner && (
          <View style={styles.ownerActions}>
            {onEdit && (
              <TouchableOpacity
                onPress={() => onEdit(post)}
                style={styles.ownerBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {onRemove && (
              <TouchableOpacity
                onPress={() => onRemove(post)}
                style={styles.ownerBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  authorCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  authorName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  authorSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
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
    fontWeight: '700',
    color: colors.primaryDark,
  },
  postTitle: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '800',
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  postSnippet: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  viewDiscussionText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  ownerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerBtn: {
    paddingHorizontal: spacing.xs,
  },
  editBtnText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  removeBtnText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
});
