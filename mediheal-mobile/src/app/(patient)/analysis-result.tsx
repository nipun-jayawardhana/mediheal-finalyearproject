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
import { getLocaleForLanguage } from '../../services/voiceService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatConditionForDisplay } from '../../utils/languageUtils';
import { useTheme } from '../../context/ThemeContext';

import { Platform } from 'react-native';

export default function AnalysisResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const symptomCheckId = Array.isArray(rawId) ? rawId[0] : (typeof rawId === 'string' ? rawId.trim() : '');
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();

  const [result, setResult] = useState<SymptomCheckRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { isSpeaking, speak, stopSpeech } = useVoice({ language });

  if (__DEV__) {
    console.log('[RESULT ROUTE] URL:', Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : 'native');
    console.log('[RESULT ROUTE] Raw params:', params);
    console.log('[RESULT ROUTE] Resolved symptomCheckId:', symptomCheckId || 'MISSING');

    if (symptomCheckId && errorMsg && errorMsg.includes('ID is required')) {
      console.error('[RESULT STATE] Invalid stale error: valid symptomCheckId exists');
    }
  }

  const fetchResult = useCallback(async (targetId: string) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      console.log('[RESULT API CALL] argument:', targetId, 'type:', typeof targetId);
      console.log(`[RESULT API] GET /symptoms/${targetId} started`);
      const res = await getSymptomCheckByIdApi(targetId, language);
      console.log(`[RESULT API] Response success: ${Boolean(res?.success)}`);

      if (res && res.success && res.data) {
        console.log(`[RESULT API] Record ID returned: ${res.data._id || targetId}`);
        console.log('[RESULT API] Result loaded successfully');
        setResult(res.data);
        setErrorMsg(null);
      } else {
        console.warn('[RESULT API] Fetch failed: response unsuccessful or missing data');
        setErrorMsg('Failed to load analysis result record.');
      }
    } catch (err: any) {
      console.error(`[RESULT API] Fetch failed. Message: ${err.message}`);
      setErrorMsg(err.message || 'Unable to retrieve analysis results.');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (symptomCheckId) {
      setErrorMsg(null);
      fetchResult(symptomCheckId);
    } else {
      setLoading(false);
      setErrorMsg('Symptom check ID is required');
    }
  }, [symptomCheckId, fetchResult]);

  // Play Audio Text-to-Speech using real backend analysis data (Language-Aware)
  const handleToggleAudio = () => {
    if (isSpeaking) {
      stopSpeech();
    } else if (result) {
      const isLocalized = language === 'si' || language === 'ta';

      // 1. Spoken conditions
      let spokenConditionsStr = '';
      if (isLocalized && Array.isArray(result.displayPossibleConditions) && result.displayPossibleConditions.length > 0) {
        spokenConditionsStr = result.displayPossibleConditions
          .map((c) => formatConditionForDisplay(c.condition, language))
          .filter(Boolean)
          .join(', ');
      } else if (isLocalized && result.displayPossibleCondition) {
        spokenConditionsStr = formatConditionForDisplay(result.displayPossibleCondition, language);
      } else {
        if (isLocalized && __DEV__) {
          console.warn(`[TTS LOCALIZATION] Missing displayPossibleConditions for language=${language}`);
        }
        spokenConditionsStr = Array.isArray(result.possibleConditions) && result.possibleConditions.length > 0
          ? result.possibleConditions.map((c) => formatConditionForDisplay(c.condition, language)).filter(Boolean).join(', ')
          : formatConditionForDisplay(result.possibleCondition, language);
      }

      // 2. Spoken positive symptoms
      let spokenSymptomsStr = '';
      if (isLocalized && Array.isArray(result.displayPositiveSymptoms) && result.displayPositiveSymptoms.length > 0) {
        spokenSymptomsStr = result.displayPositiveSymptoms.join(', ');
      } else if (Array.isArray(result.positiveSymptoms) && result.positiveSymptoms.length > 0) {
        if (isLocalized && __DEV__) {
          console.warn(`[TTS LOCALIZATION] Missing displayPositiveSymptoms for language=${language}`);
        }
        spokenSymptomsStr = result.positiveSymptoms.join(', ');
      } else if (Array.isArray(result.symptoms) && result.symptoms.length > 0) {
        spokenSymptomsStr = result.symptoms.join(', ');
      }

      // 3. Spoken guidance / immediate care steps
      let spokenGuidanceStr = '';
      if (isLocalized && Array.isArray(result.displayGuidance) && result.displayGuidance.length > 0) {
        spokenGuidanceStr = result.displayGuidance.join('. ');
      } else {
        if (isLocalized && __DEV__) {
          console.warn(`[TTS LOCALIZATION] Missing displayGuidance for language=${language}`);
        }
        spokenGuidanceStr = Array.isArray(result.guidance) && result.guidance.length > 0
          ? result.guidance.join('. ')
          : 'Consult a qualified doctor.';
      }

      // 4. Spoken recommended specialist
      let spokenSpecialistStr = '';
      if (isLocalized && result.displayRecommendedSpecialist) {
        spokenSpecialistStr = formatConditionForDisplay(result.displayRecommendedSpecialist, language);
      } else {
        if (isLocalized && __DEV__) {
          console.warn(`[TTS LOCALIZATION] Missing displayRecommendedSpecialist for language=${language}`);
        }
        spokenSpecialistStr = formatConditionForDisplay(result.recommendedSpecialist, language);
      }

      // 5. Spoken risk level assessment
      const spokenRiskStr = result.riskLevel === 'high'
        ? t('highRisk')
        : result.riskLevel === 'medium'
        ? t('mediumRisk')
        : t('lowRisk');

      // Assemble localized narration string
      let audioSummary = `${t('analysisResultsTitle')}. `;

      if (result.emergencyRecommended || result.riskLevel === 'high') {
        audioSummary = `${t('urgentEmergencyTitle')}. ${audioSummary}`;
      }

      audioSummary += `${t('possibleConditions')}: ${spokenConditionsStr}. `;
      if (spokenSymptomsStr) {
        audioSummary += `${t('basedOnSymptoms')}: ${spokenSymptomsStr}. `;
      }
      audioSummary += `${t('riskAssessment')}: ${spokenRiskStr}. `;
      audioSummary += `${t('recommendedSpecialist')}: ${spokenSpecialistStr}. `;
      audioSummary += `${t('immediateCareSteps')}: ${spokenGuidanceStr}.`;

      // Concise development logging (Requirement 18)
      if (__DEV__) {
        console.log(`[TTS PLAYBACK] App language: ${language}`);
        console.log(`[TTS PLAYBACK] Locale: ${getLocaleForLanguage(language)}`);
        console.log(`[TTS PLAYBACK] Source: ${language === 'en' ? 'canonical' : 'localized-display'}`);
        console.log(`[TTS PLAYBACK] Condition: ${spokenConditionsStr}`);
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

  if (loading && !result) {
    return <LoadingView message="Retrieving your symptom analysis..." />;
  }

  if (errorMsg || !result) {
    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <AppHeader title="Analysis Results" onBackPress={() => { stopSpeech(); router.back(); }} />
        <ErrorView
          message={errorMsg || 'Analysis result not found.'}
          onRetry={() => {
            if (symptomCheckId) {
              setErrorMsg(null);
              fetchResult(symptomCheckId);
            } else {
              stopSpeech();
              router.replace('/(patient)/symptom-checker' as any);
            }
          }}
        />
      </ScreenContainer>
    );
  }

  const isEmergency = result.emergencyRecommended || result.riskLevel === 'high';
  const conditionsList = Array.isArray(result.possibleConditions) && result.possibleConditions.length > 0
    ? result.possibleConditions
    : [{ condition: result.possibleCondition, confidence: 'medium' }];

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
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
              backgroundColor: result.analysisSource === 'openbiollm' ? '#DCFCE7' : result.analysisSource === 'gemini-secondary' ? '#E0F2FE' : '#FEF3C7',
              borderColor: result.analysisSource === 'openbiollm' ? '#166534' : result.analysisSource === 'gemini-secondary' ? '#0369A1' : '#B45309',
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
                color: result.analysisSource === 'openbiollm' ? '#166534' : result.analysisSource === 'gemini-secondary' ? '#0369A1' : '#B45309',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              🛠️ AI Source: {
                result.analysisSource === 'openbiollm'
                  ? `OpenBioLLM (${result.modelName || 'aaditya/Llama3-OpenBioLLM-8B'})`
                  : result.analysisSource === 'gemini-secondary'
                  ? `Gemini Secondary (${result.modelName || 'gemini-flash-lite-latest'})`
                  : result.analysisSource === 'rule-based-emergency'
                  ? 'Rule Engine (Emergency)'
                  : 'Safe Fallback'
              } | Canonical: {result.possibleCondition || (result.possibleConditions && result.possibleConditions[0]?.condition)}
            </Text>
          </View>
        )}

        {/* Audio Guidance Banner with real TTS Controls */}
        <TouchableOpacity
          style={[
            styles.audioBanner,
            {
              backgroundColor: isDark ? themeColors.surfaceSecondary : colors.primaryLight,
              borderColor: isDark ? themeColors.border : '#BFDBFE',
            },
            isSpeaking && styles.audioBannerSpeaking,
          ]}
          activeOpacity={0.8}
          onPress={handleToggleAudio}
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? 'Stop listening to explanation' : 'Listen to audio explanation'}
        >
          <Text style={styles.audioIcon}>{isSpeaking ? '⏹️' : '🔊'}</Text>
          <View style={styles.audioTextCol}>
            <Text style={[styles.audioTitle, { color: isDark ? themeColors.textPrimary : colors.primaryDark }]}>
              {isSpeaking ? t('playingAudio') : t('listenExplanation')}
            </Text>
            <Text style={[styles.audioSub, { color: isDark ? themeColors.textSecondary : colors.primary }]}>
              {isSpeaking ? t('tapToStop') : t('tapToListen')}
            </Text>
          </View>
          <View style={[styles.audioBadge, { backgroundColor: themeColors.primary }]}>
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
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
            result.riskLevel === 'high' && (isDark ? { backgroundColor: '#3B0764', borderColor: '#DC2626' } : styles.conditionCardHigh),
            result.riskLevel === 'medium' && (isDark ? { backgroundColor: '#451A03', borderColor: '#D97706' } : styles.conditionCardMedium),
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
              <Text style={{ fontSize: 12, fontWeight: '700', color: themeColors.textSecondary, marginTop: 4 }}>
                {t('possibleConditions').toUpperCase()} ({conditionsList.length})
              </Text>
            </View>
          </View>

          {conditionsList.map((item, idx) => {
            const rawDisplay = language !== 'en' && Array.isArray(result.displayPossibleConditions) && result.displayPossibleConditions[idx]
              ? result.displayPossibleConditions[idx].condition
              : item.condition;
            const displayCond = formatConditionForDisplay(rawDisplay, language) || item.condition || 'More Information Needed';
            return (
              <View
                key={idx}
                style={{
                  backgroundColor: idx === 0
                    ? (isDark ? '#1E3A8A' : colors.primaryLight)
                    : (isDark ? themeColors.surfaceSecondary : '#F8FAFC'),
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                  borderWidth: idx === 0 ? 1.5 : 1,
                  borderColor: idx === 0 ? themeColors.primary : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <Text
                      style={[
                        styles.conditionTitle,
                        { color: themeColors.textPrimary, fontSize: idx === 0 ? 17 : 15, fontWeight: idx === 0 ? '700' : '600', flexWrap: 'wrap' },
                      ]}
                      numberOfLines={2}
                    >
                      {idx + 1}. {displayCond}
                    </Text>
                  </View>
                  {item.confidence && (
                    <View
                      style={{
                        backgroundColor: idx === 0 ? themeColors.primary : '#64748B',
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
            );
          })}

          <Text style={[styles.matchedText, { color: themeColors.textSecondary }]}>
            {t('basedOnSymptoms')}: {(
              (language !== 'en' && Array.isArray(result.displayPositiveSymptoms) && result.displayPositiveSymptoms.length > 0)
                ? result.displayPositiveSymptoms
                : (Array.isArray(result.positiveSymptoms) && result.positiveSymptoms.length > 0
                  ? result.positiveSymptoms
                  : (result.symptoms || []))
            ).join(', ')}.
          </Text>

          {((language !== 'en' && Array.isArray(result.displayContext) && result.displayContext.length > 0) || (result.context && result.context.length > 0)) && (
            <Text style={[styles.matchedText, { marginTop: 4, fontStyle: 'italic', color: themeColors.textSecondary }]}>
              Relevant details: {(
                (language !== 'en' && Array.isArray(result.displayContext) && result.displayContext.length > 0)
                  ? result.displayContext
                  : (result.context || [])
              ).join(', ')}.
            </Text>
          )}
        </View>

        {/* Guidance / Immediate Care Steps */}
        <InfoCard title={t('immediateCareSteps')} subtitle={t('preliminaryGuidance')}>
          {(() => {
            const steps = (language !== 'en' && Array.isArray(result.displayGuidance) && result.displayGuidance.length > 0)
              ? result.displayGuidance
              : (result.guidance || []);

            if (steps.length === 0) {
              return <Text style={[styles.guidanceText, { color: themeColors.textPrimary }]}>Consult a qualified healthcare professional for evaluation.</Text>;
            }

            return steps.map((step: string, idx: number) => (
              <View key={idx} style={styles.guidanceItem}>
                <Text style={[styles.guidanceBullet, { color: themeColors.primary }]}>•</Text>
                <Text style={[styles.guidanceText, { color: themeColors.textPrimary, flex: 1, flexShrink: 1 }]}>{step}</Text>
              </View>
            ));
          })()}
        </InfoCard>

        {/* Recommended Specialist Card */}
        <InfoCard title={t('recommendedSpecialist')}>
          <View style={styles.specialistRow}>
            <View style={[styles.specialistIconCircle, { backgroundColor: isDark ? themeColors.surfaceSecondary : colors.primaryLight }]}>
              <Text style={styles.specialistIcon}>🩺</Text>
            </View>
            <View style={styles.specialistTextCol}>
              <Text style={[styles.specialistTitle, { color: themeColors.primary }]}>
                {formatConditionForDisplay(result.displayRecommendedSpecialist || result.recommendedSpecialist, language)}
              </Text>
              <Text style={[styles.specialistSub, { color: themeColors.textSecondary }]}>{t('recommendedSpecialist')}</Text>
            </View>
          </View>

          <AppButton
            title={`${t('findDoctor')} (${formatConditionForDisplay(result.displayRecommendedSpecialist || result.recommendedSpecialist, language)})`}
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

        <View style={[styles.disclaimerBox, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
          <Text style={[styles.disclaimerTitle, { color: themeColors.textSecondary }]}>{t('medicalDisclaimerTitle')}</Text>
          <Text style={[styles.disclaimerText, { color: themeColors.textSecondary }]}>{result.disclaimer}</Text>
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
