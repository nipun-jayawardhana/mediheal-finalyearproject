import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { MediHealLogo } from './MediHealLogo';

export interface SplashScreenProps {
  /**
   * Optional custom test ID or accessibility label
   */
  accessibilityLabel?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  accessibilityLabel = 'MediHeal Splash Screen',
}) => {
  const { colors, isLoadingTheme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  // Prevent flash during initial theme restoration from storage
  if (isLoadingTheme) {
    return <View style={[styles.container, { backgroundColor: '#0F172A' }]} />;
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <MediHealLogo size={104} />

        <Text style={styles.wordmark}>
          <Text style={{ color: colors.textPrimary }}>Medi</Text>
          <Text style={{ color: colors.primary }}>Heal</Text>
        </Text>

        <Text style={[styles.tagline, { color: colors.textMuted }]}>Your health companion</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  content: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
});
