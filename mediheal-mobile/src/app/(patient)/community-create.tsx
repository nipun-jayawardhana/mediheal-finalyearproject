import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { createCommunityPost } from '../../services/communityService';
import { CommunityCategory } from '../../types/community';
import { useTheme } from '../../context/ThemeContext';

const CATEGORY_OPTIONS: { label: string; value: CommunityCategory }[] = [
  { label: 'General Q&A', value: 'general' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Exercise', value: 'exercise' },
  { label: 'Medication', value: 'medication' },
  { label: 'Elderly Care', value: 'elderly-care' },
  { label: 'Wellbeing', value: 'wellbeing' },
  { label: 'Other', value: 'other' },
];

export default function CreateCommunityPostScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<CommunityCategory>('general');
  const [content, setContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
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
      const res = await createCommunityPost({
        title: cleanTitle,
        content: cleanContent,
        category,
      });

      if (res && res.success) {
        Alert.alert(
          'Post Created',
          'Your post has been published successfully to the MediHeal community.'
        );
        router.back();
      } else {
        Alert.alert('Error', res.message || 'Failed to create post.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to publish community post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Create Post"
        subtitle="Ask a Question or Share Insights"
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>Post Title *</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder="e.g. Tips for staying active at home?"
            placeholderTextColor={themeColors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <Text style={[styles.charCount, { color: themeColors.textSecondary }]}>{title.length} / 120 characters</Text>
        </View>

        {/* Category Selector */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>Select Topic Category *</Text>
          <View style={styles.categoryWrap}>
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryOption,
                    { backgroundColor: themeColors.card, borderColor: themeColors.border },
                    isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      { color: themeColors.textSecondary },
                      isSelected && { color: '#FFFFFF' },
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
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>Discussion Details / Question *</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            placeholder="Write your health question or discussion details here..."
            placeholderTextColor={themeColors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[styles.charCount, { color: themeColors.textSecondary }]}>{content.length} / 2000 characters</Text>
        </View>

        {/* Medical Safety Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            ℹ️ Community content is shared by users and should not replace professional medical advice.
          </Text>
        </View>

        {/* Submit Action */}
        <AppButton
          title={submitting ? 'Publishing...' : 'Post to Community'}
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
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
  },
  submitBtn: {
    minHeight: 48,
  },
});
