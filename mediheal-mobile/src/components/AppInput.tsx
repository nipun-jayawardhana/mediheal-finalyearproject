import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography, layout } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: themeColors.textPrimary }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
          isFocused && { borderColor: themeColors.primary },
          !!error && { borderColor: themeColors.danger },
        ]}
      >
        <TextInput
          style={[styles.input, { color: themeColors.textPrimary }, style]}
          placeholderTextColor={themeColors.textSecondary}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus && onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur && onBlur(e);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={[styles.errorText, { color: themeColors.danger }]}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  inputWrapper: {
    height: layout.inputHeight,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  focusedWrapper: {
    borderColor: colors.primary,
  },
  errorWrapper: {
    borderColor: colors.danger,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 2,
    marginLeft: 2,
  },
});
