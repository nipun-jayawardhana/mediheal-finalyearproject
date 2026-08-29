import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { AppButton } from './AppButton';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = '📋',
  actionText,
  onAction,
}) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: themeColors.textSecondary }]}>{description}</Text> : null}
      {actionText && onAction && (
        <AppButton
          title={actionText}
          onPress={onAction}
          variant="secondary"
          style={styles.actionButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subheader,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});
