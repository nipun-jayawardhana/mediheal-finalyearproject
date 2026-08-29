import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

export interface SplashScreenProps {
  /**
   * Optional custom test ID or accessibility label
   */
  accessibilityLabel?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  accessibilityLabel = 'MediHeal Splash Screen',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <View
      style={styles.container}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.brandCard, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/mediheal-splash-light.jpg')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="MediHeal Logo"
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  brandCard: {
    width: '85%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    aspectRatio: 1024 / 558,
    borderRadius: borderRadius.md,
  },
});
