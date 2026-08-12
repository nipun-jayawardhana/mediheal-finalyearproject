import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';

export const VOICE_ONBOARDING_STORAGE_KEY = '@mediheal_voice_onboarding_seen';

export default function VoiceOnboardingScreen() {
  const router = useRouter();

  const markSeenAndNavigate = async () => {
    try {
      await AsyncStorage.setItem(VOICE_ONBOARDING_STORAGE_KEY, 'true');
    } catch (err) {
      console.error('Error saving voice onboarding flag:', err);
    }
    router.replace('/(patient)/symptom-checker' as any);
  };

  const handleTrySpeaking = () => {
    Alert.alert(
      'Voice Input Practice',
      'Microphone speech recognition will be activated in the upcoming Voice Integration module. Manual symptom input is fully enabled now.',
      [
        {
          text: 'Continue to Symptom Checker',
          onPress: markSeenAndNavigate,
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title="Voice Tutorial"
        subtitle="Learn how to navigate MediHeal with your voice"
        rightComponent={
          <AppButton
            title="Skip"
            onPress={markSeenAndNavigate}
            variant="outline"
            style={styles.skipBtn}
            textStyle={styles.skipBtnText}
          />
        }
      />

      <View style={styles.content}>
        {/* Large Central Microphone Visual */}
        <View style={styles.micContainer}>
          <View style={styles.micCircle}>
            <Text style={styles.micIcon}>🎙️</Text>
          </View>
        </View>

        {/* Tutorial Instruction */}
        <View style={styles.instructionBox}>
          <Text style={styles.headingText}>
            Say <Text style={styles.highlightText}>"Check Symptoms"</Text> or{' '}
            <Text style={styles.highlightText}>"Call Doctor"</Text> to navigate!
          </Text>
          <Text style={styles.bodyText}>
            Speak clearly near your phone's microphone. MediHeal will listen and take you there.
          </Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillDot}>●</Text>
            <Text style={styles.statusPillText}>Voice Navigation Ready</Text>
          </View>
        </View>

        {/* Feature Cards */}
        <View style={styles.cardSection}>
          <View style={styles.infoCard}>
            <Text style={styles.cardIcon}>💡</Text>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>Did you know?</Text>
              <Text style={styles.cardSub}>
                You can also ask about your medications by saying "Pill Schedule".
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardIcon}>🔒</Text>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>Private & Secure</Text>
              <Text style={styles.cardSub}>
                Your voice is only used for local commands and never stored or recorded.
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          <AppButton
            title="🎙️ Try Speaking Now"
            onPress={handleTrySpeaking}
            style={styles.tryBtn}
          />
          <Text style={styles.subtext}>Tap the button above to start practice</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
  },
  skipBtn: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderColor: colors.primary,
  },
  skipBtnText: {
    fontSize: 14,
  },
  micContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  micCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  micIcon: {
    fontSize: 56,
  },
  instructionBox: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  headingText: {
    ...typography.title,
    fontSize: 22,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  highlightText: {
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    marginTop: spacing.md,
  },
  statusPillDot: {
    color: colors.success,
    fontSize: 12,
    marginRight: 6,
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardSection: {
    marginVertical: spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  cardTextCol: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.caption,
    marginTop: 2,
  },
  actionSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  tryBtn: {
    width: '100%',
  },
  subtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
