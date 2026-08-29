import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { AppButton } from './AppButton';
import { useTheme } from '../context/ThemeContext';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  retryText?: string;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = 'An error occurred. Please try again.',
  onRetry,
  retryText = 'Try Again',
}) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: themeColors.dangerLight, borderColor: themeColors.danger }]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.message, { color: themeColors.danger }]}>{message}</Text>
      {onRetry && (
        <AppButton
          title={retryText}
          onPress={onRetry}
          variant="outline"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    borderColor: colors.danger,
    minWidth: 140,
  },
});
