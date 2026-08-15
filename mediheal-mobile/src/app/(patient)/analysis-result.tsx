import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { InfoCard } from '../../components/InfoCard';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getSymptomCheckByIdApi } from '../../services/symptomService';
import { SymptomCheckRecord } from '../../types/symptom';
import { useVoice } from '../../hooks/useVoice';
import { useAuth } from '../../context/AuthContext';

export default function AnalysisResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userLang = user?.preferredLanguage === 'Sinhala' ? 'si' : user?.preferredLanguage === 'Tamil' ? 'ta' : 'en';

  const [result, setResult] = useState<SymptomCheckRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const { isSpeaking, speak, stopSpeech } = useVoice({ language: userLang });

  const fetchResult = useCallback(async () => {
    if (!id) {
      setErrorMsg('No symptom check record ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getSymptomCheckByIdApi(id);
      if (res && res.success && res.data) {
        setResult(res.data);
      } else {
        setErrorMsg('Failed to load analysis result record.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve analysis results.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  // Play Audio Text-to-Speech using real backend analysis data ONLY
  const handleToggleAudio = () => {
    if (isSpeaking) {
      stopSpeech();
    } else if (result) {
      const guidanceText = Array.isArray(result.guidance) && result.guidance.length > 0
        ? result.guidance.join('. ')
        : 'Consult a qualified doctor.';

      let audioSummary = `Symptom Analysis Result. Assessment: ${result.possibleCondition}. Risk Level: ${result.riskLevel} risk. Recommended Specialist: ${result.recommendedSpecialist}. Immediate Care Steps: ${guidanceText}. Disclaimer: ${result.disclaimer}`;

      if (result.emergencyRecommended || result.riskLevel === 'high') {
        audioSummary = `Urgent Medical Attention Recommended. ${audioSummary}`;
      }

      speak(audioSummary);
    }
  };

  const handleSpecialistPress = () => {
    stopSpeech();
    const specialization = result?.recommendedSpecialist || 'General Physician';
    router.push({
      pathname: '/(patient)/specialists' as any,
      params: { specialization },
    });
  };

  const handleRecheckSymptoms = () => {
    stopSpeech();
    router.replace('/(patient)/symptom-checker' as any);
  };

  if (loading) {
    return <LoadingView message="Retrieving your symptom analysis..." />;
  }

  if (errorMsg || !result) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Analysis Results" onBackPress={() => { stopSpeech(); router.back(); }} />
        <ErrorView message={errorMsg || 'Analysis result not found.'} onRetry={fetchResult} />
      </ScreenContainer>
    );
  }

  const isEmergency = result.emergencyRecommended || result.riskLevel === 'high';

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title="Analysis Results"
        subtitle="Preliminary Healthcare Guidance"
        onBackPress={() => { stopSpeech(); router.back(); }}
      />

      <View style={styles.content}>
        {/* Audio Guidance Banner with real TTS Controls */}
        <TouchableOpacity
          style={[styles.audioBanner, isSpeaking && styles.audioBannerSpeaking]}
          activeOpacity={0.8}
          onPress={handleToggleAudio}
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? 'Stop listening to explanation' : 'Listen to audio explanation'}
        >
          <Text style={styles.audioIcon}>{isSpeaking ? '⏹️' : '🔊'}</Text>
          <View style={styles.audioTextCol}>
            <Text style={styles.audioTitle}>
              {isSpeaking ? 'Playing Audio Explanation...' : 'Listen to Explanation'}
            </Text>
            <Text style={styles.audioSub}>
              {isSpeaking ? 'Tap to Stop Audio' : 'Tap to hear real analysis results read aloud'}
            </Text>
          </View>
          <View style={styles.audioBadge}>
            <Text style={styles.audioBadgeText}>{isSpeaking ? 'STOP' : 'PLAY'}</Text>
          </View>
        </TouchableOpacity>

        {/* Emergency Alert Warning Banner */}
        {isEmergency && (
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeaderRow}>
              <Text style={styles.emergencyIcon}>🚨</Text>
              <View style={styles.emergencyTextCol}>
                <Text style={styles.emergencyTitle}>Urgent Medical Attention Recommended</Text>
                <Text style={styles.emergencySub}>
                  High risk symptoms detected. Please seek immediate professional medical assistance.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: colors.danger,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                alignItems: 'center',
                marginTop: spacing.md,
              }}
              activeOpacity={0.8}
              onPress={() => { stopSpeech(); router.push('/(patient)/emergency-countdown' as any); }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                🚨 Trigger Emergency SOS
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Possible Condition Card */}
        <View
          style={[
            styles.conditionCard,
            result.riskLevel === 'high' && styles.conditionCardHigh,
            result.riskLevel === 'medium' && styles.conditionCardMedium,
          ]}
        >
          <View style={styles.conditionHeaderRow}>
            <Text style={styles.conditionIcon}>
              {result.riskLevel === 'high' ? '⚠️' : '⚙️'}
            </Text>
            <View style={styles.conditionTextCol}>
              <StatusBadge
                status={result.riskLevel}
                label={`${result.riskLevel.toUpperCase()} RISK ASSESSMENT`}
              />
              <Text style={styles.conditionTitle}>{result.possibleCondition}</Text>
            </View>
          </View>

          <Text style={styles.matchedText}>
            Based on your symptoms ({result.matchedSymptoms.join(', ') || result.symptoms.join(', ')}).
          </Text>
        </View>

        {/* Guidance / Immediate Care Steps */}
        <InfoCard title="Immediate Care Steps" subtitle="Recommended preliminary actions">
          {result.guidance && result.guidance.length > 0 ? (
            result.guidance.map((step, idx) => (
              <View key={idx} style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>•</Text>
                <Text style={styles.guidanceText}>{step}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.guidanceText}>Consult a qualified healthcare professional for evaluation.</Text>
          )}
        </InfoCard>

        {/* Recommended Specialist Card */}
        <InfoCard title="Recommended Specialist">
          <View style={styles.specialistRow}>
            <View style={styles.specialistIconCircle}>
              <Text style={styles.specialistIcon}>🩺</Text>
            </View>
            <View style={styles.specialistTextCol}>
              <Text style={styles.specialistTitle}>{result.recommendedSpecialist}</Text>
              <Text style={styles.specialistSub}>Recommended for professional medical evaluation</Text>
            </View>
          </View>

          <AppButton
            title={`Find ${result.recommendedSpecialist}`}
            onPress={handleSpecialistPress}
            style={styles.findDoctorBtn}
          />
        </InfoCard>

        {/* Re-check Symptoms Button */}
        <AppButton
          title="🔄 Check Symptoms Again"
          onPress={handleRecheckSymptoms}
          variant="outline"
          style={styles.recheckBtn}
        />

        {/* Mandatory Backend Medical Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>Medical Disclaimer</Text>
          <Text style={styles.disclaimerText}>{result.disclaimer}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xs,
  },
  audioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  audioBannerSpeaking: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  audioIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  audioTextCol: {
    flex: 1,
  },
  audioTitle: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  audioSub: {
    ...typography.caption,
    color: colors.primary,
  },
  audioBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  audioBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  emergencyCard: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  emergencyTextCol: {
    flex: 1,
  },
  emergencyTitle: {
    ...typography.subheader,
    color: colors.danger,
  },
  emergencySub: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 2,
  },
  conditionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  conditionCardMedium: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  conditionCardHigh: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  conditionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  conditionIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  conditionTextCol: {
    flex: 1,
  },
  conditionTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  matchedText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: spacing.xs,
  },
  guidanceBullet: {
    fontSize: 18,
    color: colors.primary,
    marginRight: spacing.sm,
    fontWeight: '800',
  },
  guidanceText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  specialistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  specialistIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  specialistIcon: {
    fontSize: 24,
  },
  specialistTextCol: {
    flex: 1,
  },
  specialistTitle: {
    ...typography.header,
    color: colors.primary,
  },
  specialistSub: {
    ...typography.caption,
    marginTop: 2,
  },
  findDoctorBtn: {
    marginTop: spacing.xs,
  },
  recheckBtn: {
    marginVertical: spacing.md,
  },
  disclaimerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
