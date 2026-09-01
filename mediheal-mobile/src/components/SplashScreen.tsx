import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';
import { spacing, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface SplashScreenProps {
  /**
   * Optional custom test ID or accessibility label
   */
  accessibilityLabel?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  accessibilityLabel = 'MediHeal Splash Screen',
}) => {
  const { isDark, colors, isLoadingTheme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const splashImage = isDark
    ? require('../../assets/images/mediheal-splash-dark.jpg')
    : require('../../assets/images/mediheal-splash-light.jpg');

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
        style={[
          styles.brandCard,
          {
            backgroundColor: isDark ? '#071424' : colors.card,
            borderColor: isDark ? '#1E293B' : '#E2E8F0',
            borderWidth: isDark ? 1 : 0,
            shadowColor: isDark ? '#000000' : '#0F172A',
            shadowOpacity: isDark ? 0.25 : 0.08,
            elevation: isDark ? 4 : 6,
          },
          { opacity: fadeAnim },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={splashImage}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  brandCard: {
    width: '85%',
    maxWidth: 420,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
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


