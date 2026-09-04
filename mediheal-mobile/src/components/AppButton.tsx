import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, layout, shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const { colors: themeColors } = useTheme();

  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.secondaryContainer, { backgroundColor: themeColors.primaryLight }];
      case 'outline':
        return [styles.outlineContainer, { borderColor: themeColors.primary }];
      case 'danger':
        return [styles.dangerContainer, { backgroundColor: themeColors.danger }];
      case 'primary':
      default:
        return [styles.primaryContainer, { backgroundColor: themeColors.primary }];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.secondaryText, { color: themeColors.primary }];
      case 'outline':
        return [styles.outlineText, { color: themeColors.primary }];
      case 'danger':
        return [styles.dangerText, { color: themeColors.textWhite }];
      case 'primary':
      default:
        return [styles.primaryText, { color: themeColors.textWhite }];
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.baseButton,
        getContainerStyle(),
        disabled && [styles.disabledContainer, { backgroundColor: themeColors.border, borderColor: themeColors.border }],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'secondary' ? themeColors.primary : themeColors.textWhite}
        />
      ) : (
        <Text
          style={[
            styles.baseText,
            getTextStyle(),
            disabled && [styles.disabledText, { color: themeColors.textMuted }],
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    height: layout.buttonHeight,
    minWidth: layout.minTouchTarget,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  baseText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryContainer: {
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  primaryText: {
    color: colors.textWhite,
  },
  secondaryContainer: {
    backgroundColor: colors.primaryLight,
  },
  secondaryText: {
    color: colors.primary,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  dangerContainer: {
    backgroundColor: colors.danger,
  },
  dangerText: {
    color: colors.textWhite,
  },
  disabledContainer: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledText: {
    color: colors.textMuted,
  },
});
