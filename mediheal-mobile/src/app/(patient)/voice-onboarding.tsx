import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useVoice } from '../../hooks/useVoice';
import { useAuth } from '../../context/AuthContext';

export const VOICE_ONBOARDING_STORAGE_KEY = '@mediheal_voice_onboarding_seen';

export default function VoiceOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userLang = user?.preferredLanguage === 'Sinhala' ? 'si' : user?.preferredLanguage === 'Tamil' ? 'ta' : 'en';

  const {
    voiceState,
    isListening,
    transcript,
    errorMessage,
    startListening,
    stopListening,
    resetVoice,
  } = useVoice({ language: userLang });

  const markSeenAndNavigate = async () => {
    try {
      await AsyncStorage.setItem(VOICE_ONBOARDING_STORAGE_KEY, 'true');
    } catch (err) {
      console.error('Error saving voice onboarding flag:', err);
    }
    router.replace('/(patient)/symptom-checker' as any);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
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
          <TouchableOpacity
            style={[
              styles.micCircle,
              isListening && styles.micCircleListening,
              voiceState === 'recognized' && styles.micCircleRecognized,
              voiceState === 'error' && styles.micCircleError,
            ]}
            onPress={handleToggleListening}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Start speaking practice'}
          >
            <Text style={styles.micIcon}>
              {isListening ? '🎙️' : voiceState === 'recognized' ? '✅' : '🎤'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Status & Transcript Display */}
        <View style={styles.instructionBox}>
          {voiceState === 'idle' && (
            <>
              <Text style={styles.headingText}>
                Say <Text style={styles.highlightText}>"Check Symptoms"</Text> or{' '}
                <Text style={styles.highlightText}>"Call Doctor"</Text> to navigate!
              </Text>
              <Text style={styles.bodyText}>
                Speak clearly near your phone's microphone. MediHeal will listen and guide you.
              </Text>
            </>
          )}

          {voiceState === 'requesting' && (
            <>
              <Text style={styles.headingText}>Requesting Permission...</Text>
              <Text style={styles.bodyText}>Please grant microphone access to try voice input.</Text>
            </>
          )}

          {voiceState === 'listening' && (
            <>
              <Text style={[styles.headingText, { color: colors.primary }]}>Listening... 🎙️</Text>
              <Text style={styles.bodyText}>
                {transcript ? `"${transcript}"` : 'Say something like "I have fever and cough"'}
              </Text>
            </>
          )}

          {voiceState === 'recognized' && (
            <>
              <Text style={[styles.headingText, { color: colors.success }]}>Voice Recognized!</Text>
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptLabel}>Captured Phrase:</Text>
                <Text style={styles.transcriptText}>"{transcript}"</Text>
              </View>
            </>
          )}

          {voiceState === 'no_speech' && (
            <>
              <Text style={[styles.headingText, { color: colors.warning }]}>No Speech Detected</Text>
              <Text style={styles.bodyText}>
                We didn't hear anything. Tap "Try Again" below or continue to manual input.
              </Text>
            </>
          )}

          {voiceState === 'error' && (
            <>
              <Text style={[styles.headingText, { color: colors.danger }]}>Voice Input Notice</Text>
              <Text style={styles.bodyText}>{errorMessage}</Text>
            </>
          )}

          {/* Status Pill Indicator */}
          <View style={styles.statusPill}>
            <Text
              style={[
                styles.statusPillDot,
                isListening && { color: colors.primary },
                voiceState === 'recognized' && { color: colors.success },
                voiceState === 'error' && { color: colors.danger },
              ]}
            >
              ●
            </Text>
            <Text style={styles.statusPillText}>
              {isListening
                ? 'Listening Active'
                : voiceState === 'recognized'
                ? 'Practice Speech Captured'
                : voiceState === 'error'
                ? 'Manual Input Available'
                : 'Voice Navigation Ready'}
            </Text>
          </View>
        </View>

        {/* Feature & Privacy Cards */}
        <View style={styles.cardSection}>
          <View style={styles.infoCard}>
            <Text style={styles.cardIcon}>💡</Text>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>Did you know?</Text>
              <Text style={styles.cardSub}>
                You can describe symptoms naturally or type them manually anytime.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardIcon}>🔒</Text>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>Private & Truthful</Text>
              <Text style={styles.cardSub}>
                Voice recognition uses your device or system speech service. You can always use text input instead.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionSection}>
          {isListening ? (
            <AppButton
              title="⏹️ Stop Listening"
              onPress={stopListening}
              variant="outline"
              style={styles.tryBtn}
            />
          ) : voiceState === 'recognized' ? (
            <View style={styles.recognizedActionRow}>
              <AppButton
                title="🔄 Try Again"
                onPress={resetVoice}
                variant="outline"
                style={styles.halfBtn}
              />
              <AppButton
                title="Continue ➔"
                onPress={markSeenAndNavigate}
                style={styles.halfBtn}
              />
            </View>
          ) : (
            <AppButton
              title={voiceState === 'no_speech' || voiceState === 'error' ? '🔄 Try Speaking Again' : '🎙️ Try Speaking Now'}
              onPress={handleToggleListening}
              style={styles.tryBtn}
            />
          )}

          <AppButton
            title="Continue to Symptom Checker"
            onPress={markSeenAndNavigate}
            variant="outline"
            style={styles.continueBtn}
          />
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
  micCircleListening: {
    backgroundColor: '#2563EB',
    borderWidth: 4,
    borderColor: '#93C5FD',
  },
  micCircleRecognized: {
    backgroundColor: colors.success,
  },
  micCircleError: {
    backgroundColor: colors.textMuted,
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
  transcriptCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    width: '100%',
    alignItems: 'center',
  },
  transcriptLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  transcriptText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
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
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  tryBtn: {
    width: '100%',
  },
  continueBtn: {
    width: '100%',
    marginTop: spacing.xs,
  },
  recognizedActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  halfBtn: {
    flex: 1,
  },
});
