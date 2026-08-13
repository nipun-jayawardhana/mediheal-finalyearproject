import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { getCommunityPostById, updateCommunityPost } from '../../services/communityService';
import { CommunityCategory } from '../../types/community';

const CATEGORY_OPTIONS: { label: string; value: CommunityCategory }[] = [
  { label: 'General Q&A', value: 'general' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Exercise', value: 'exercise' },
  { label: 'Medication', value: 'medication' },
  { label: 'Elderly Care', value: 'elderly-care' },
  { label: 'Wellbeing', value: 'wellbeing' },
  { label: 'Other', value: 'other' },
];

export default function EditCommunityPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<CommunityCategory>('general');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
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
      if (res && res.success && res.data?.post) {
        setTitle(res.data.post.title);
        setCategory(res.data.post.category);
        setContent(res.data.post.content);
      } else {
        setErrorMsg('Failed to load post for editing.');
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

  const handleSubmit = async () => {
    if (!params.id) return;

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      Alert.alert('Validation Error', 'Post title must be between 3 and 120 characters.');
      return;
    }

    if (cleanContent.length < 5 || cleanContent.length > 2000) {
      Alert.alert('Validation Error', 'Post content must be between 5 and 2000 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await updateCommunityPost(params.id, {
        title: cleanTitle,
        content: cleanContent,
        category,
      });

      if (res && res.success) {
        Alert.alert('Post Updated', 'Your post has been updated successfully.');
        router.back();
      } else {
        Alert.alert('Error', res.message || 'Failed to update post.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update post.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading post details..." />;
  }

  if (errorMsg) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Edit Post" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg} onRetry={fetchPostDetails} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Edit Post"
        subtitle="Modify Your Community Discussion"
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title Input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Post Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <Text style={styles.charCount}>{title.length} / 120 characters</Text>
        </View>

        {/* Category Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Select Topic Category *</Text>
          <View style={styles.categoryWrap}>
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryOption, isSelected && styles.categoryOptionSelected]}
                  activeOpacity={0.8}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      isSelected && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content Multiline Area */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Discussion Details / Question *</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{content.length} / 2000 characters</Text>
        </View>

        {/* Submit Action */}
        <AppButton
          title={submitting ? 'Saving Changes...' : 'Save Post Changes'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={styles.submitBtn}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 140,
  },
  charCount: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryOption: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryOptionText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryOptionTextSelected: {
    color: '#FFFFFF',
  },
  submitBtn: {
    minHeight: 48,
  },
});
