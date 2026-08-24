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
import { useLanguage } from '../../context/LanguageContext';

export default function AnalysisResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [result, setResult] = useState<SymptomCheckRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const { isSpeaking, speak, stopSpeech } = useVoice({ language });

  const fetchResult = useCallback(async () => {
    if (!id) {
      setErrorMsg('No symptom check record ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getSymptomCheckByIdApi(id, language);
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
  }, [id, language]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  // Play Audio Text-to-Speech using real backend analysis data ONLY
  const handleToggleAudio = () => {
    if (isSpeaking) {
      stopSpeech();
    } else if (result) {
      const condList = Array.isArray(result.possibleConditions) && result.possibleConditions.length > 0
        ? result.possibleConditions.map((c) => c.condition).join(', ')
        : result.possibleCondition;

      const guidanceText = Array.isArray(result.guidance) && result.guidance.length > 0
        ? result.guidance.join('. ')
        : 'Consult a qualified doctor.';

      let audioSummary = `Symptom Analysis Result. Possible conditions include: ${condList}. Risk Level: ${result.riskLevel} risk. Recommended Specialist: ${result.recommendedSpecialist}. Immediate Care Steps: ${guidanceText}. Disclaimer: ${result.disclaimer}`;

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
  const conditionsList = Array.isArray(result.possibleConditions) && result.possibleConditions.length > 0
    ? result.possibleConditions
    : [{ condition: result.possibleCondition, confidence: 'medium' }];

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title={t('analysisResultsTitle')}
        subtitle={t('preliminaryGuidance')}
        onBackPress={() => { stopSpeech(); router.back(); }}
      />

      <View style={styles.content}>
        {/* Developer Debug Label (DEV mode only) */}
        {__DEV__ && result?.analysisSource && (
          <View
            style={{
              backgroundColor: result.analysisSource === 'openbiollm' ? '#DCFCE7' : '#FEF3C7',
              borderColor: result.analysisSource === 'openbiollm' ? '#166534' : '#B45309',
              borderWidth: 1,
              borderRadius: borderRadius.md,
              paddingVertical: 4,
              paddingHorizontal: spacing.sm,
              marginBottom: spacing.sm,
              alignSelf: 'flex-start',
            }}
          >
            <Text
              style={{
                color: result.analysisSource === 'openbiollm' ? '#166534' : '#B45309',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              🛠️ AI Source: {result.analysisSource === 'openbiollm' ? `OpenBioLLM (${result.modelName || 'aaditya/Llama3-OpenBioLLM-8B'})` : result.analysisSource === 'rule-based-emergency' ? 'Rule Engine (Emergency)' : 'Safe Fallback'}
            </Text>
          </View>
        )}

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
              {isSpeaking ? t('playingAudio') : t('listenExplanation')}
            </Text>
            <Text style={styles.audioSub}>
              {isSpeaking ? t('tapToStop') : t('tapToListen')}
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
                <Text style={styles.emergencyTitle}>{t('urgentEmergencyTitle')}</Text>
                <Text style={styles.emergencySub}>
                  {t('urgentEmergencySub')}
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
                {t('triggerEmergencySos')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Possible Conditions Card */}
        <View
          style={[
            styles.conditionCard,
            result.riskLevel === 'high' && styles.conditionCardHigh,
            result.riskLevel === 'medium' && styles.conditionCardMedium,
          ]}
        >
          <View style={styles.conditionHeaderRow}>
            <Text style={styles.conditionIcon}>
              {result.riskLevel === 'high' ? '⚠️' : '🩺'}
            </Text>
            <View style={styles.conditionTextCol}>
              <StatusBadge
                status={result.riskLevel}
                label={`${(result.riskLevel === 'high' ? t('highRisk') : result.riskLevel === 'medium' ? t('mediumRisk') : t('lowRisk')).toUpperCase()} ${t('riskAssessment')}`}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 4 }}>
                {t('possibleConditions').toUpperCase()} ({conditionsList.length})
              </Text>
            </View>
          </View>

          {conditionsList.map((item, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: idx === 0 ? colors.primaryLight : '#F8FAFC',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.xs,
                borderWidth: idx === 0 ? 1.5 : 1,
                borderColor: idx === 0 ? colors.primary : colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text
                  style={[
                    styles.conditionTitle,
                    { fontSize: idx === 0 ? 18 : 15, fontWeight: idx === 0 ? '800' : '600' },
                  ]}
                >
                  {idx + 1}. {item.condition}
                </Text>
                {item.confidence && (
                  <View
                    style={{
                      backgroundColor: idx === 0 ? colors.primary : '#94A3B8',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: borderRadius.pill,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                      {item.confidence} confidence
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          <Text style={styles.matchedText}>
            {t('basedOnSymptoms')}: {result.matchedSymptoms.join(', ') || result.symptoms.join(', ')}.
          </Text>
        </View>

        {/* Guidance / Immediate Care Steps */}
        <InfoCard title={t('immediateCareSteps')} subtitle={t('preliminaryGuidance')}>
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
        <InfoCard title={t('recommendedSpecialist')}>
          <View style={styles.specialistRow}>
            <View style={styles.specialistIconCircle}>
              <Text style={styles.specialistIcon}>🩺</Text>
            </View>
            <View style={styles.specialistTextCol}>
              <Text style={styles.specialistTitle}>{result.displayRecommendedSpecialist || result.recommendedSpecialist}</Text>
              <Text style={styles.specialistSub}>{t('recommendedSpecialist')}</Text>
            </View>
          </View>

          <AppButton
            title={`${t('findDoctor')} (${result.displayRecommendedSpecialist || result.recommendedSpecialist})`}
            onPress={handleSpecialistPress}
            style={styles.findDoctorBtn}
          />
        </InfoCard>

        {/* Re-check Symptoms Button */}
        <AppButton
          title={`❓ ${t('recheckSymptoms')}`}
          onPress={handleRecheckSymptoms}
          variant="outline"
          style={styles.recheckBtn}
        />

        {/* Mandatory Backend Medical Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>{t('medicalDisclaimerTitle')}</Text>
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
