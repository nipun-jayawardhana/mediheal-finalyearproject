import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface MediHealLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * MediHeal brand mark: a rounded badge with a medical cross.
 * Built from plain Views so it stays crisp at any size without image assets.
 * Proportions match assets/images/splash-icon.png (used by the native splash).
 */
export const MediHealLogo: React.FC<MediHealLogoProps> = ({ size = 96, style }) => {
  const { colors } = useTheme();

  const armLength = size * 0.56;
  const armThickness = size * 0.2;
  const armRadius = armThickness * 0.3;

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="MediHeal logo"
    >
      <View
        style={[
          styles.arm,
          { width: armLength, height: armThickness, borderRadius: armRadius },
        ]}
      />
      <View
        style={[
          styles.arm,
          { width: armThickness, height: armLength, borderRadius: armRadius },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  arm: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
