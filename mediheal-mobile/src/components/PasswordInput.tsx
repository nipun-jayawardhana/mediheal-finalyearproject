import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AppInput, AppInputProps } from './AppInput';
import { colors, spacing } from '../constants/theme';

export const PasswordInput: React.FC<AppInputProps> = (props) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.relativeWrapper}>
      <AppInput
        secureTextEntry={!showPassword}
        {...props}
        style={[props.style, styles.paddingRight]}
      />
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowPassword(!showPassword)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      >
        <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  relativeWrapper: {
    position: 'relative',
  },
  paddingRight: {
    paddingRight: 60,
  },
  toggleButton: {
    position: 'absolute',
    right: spacing.md,
    top: 38,
    padding: spacing.xs,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
