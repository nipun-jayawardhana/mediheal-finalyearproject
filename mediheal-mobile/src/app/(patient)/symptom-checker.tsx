import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { analyzeSymptomsApi } from '../../services/symptomService';
import { SeverityLevel } from '../../types/symptom';
import { useVoice } from '../../hooks/useVoice';
import { useAuth } from '../../context/AuthContext';

const SEVERITY_OPTIONS: { label: string; value: SeverityLevel }[] = [
  { label: 'Mild', value: 'mild' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Severe', value: 'severe' },
];

export default function SymptomCheckerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userLang = user?.preferredLanguage === 'Sinhala' ? 'si' : user?.preferredLanguage === 'Tamil' ? 'ta' : 'en';

  // Manual Symptom State
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomsList, setSymptomsList] = useState<string[]>([]);
  const [duration, setDuration] = useState('2 days');
  const [severity, setSeverity] = useState<SeverityLevel>('moderate');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inputError, setInputError] = useState('');

  // Real Voice Hook
  const {
    voiceState,
    isListening,
    transcript,
    errorMessage: voiceError,
    startListening,
    stopListening,
    resetVoice,
  } = useVoice({
    language: userLang,
    onTranscript: (capturedText, _isFinal) => {
      if (capturedText) {
        setSymptomInput(capturedText);
      }
    },
  });

  // Toggle Microphone Listening
  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Convert recognized or typed text into symptom chips (conservative splitting by comma / "and")
  const handleConvertVoiceToChips = () => {
    const rawText = (symptomInput || transcript).trim();
    if (!rawText) return;

    // Conservative split by comma, semicolon, or "and" / "සහ" / "මෙන්ම"
    const splitTokens = rawText
      .split(/[,;\n]| and | සහ | සහව | සහත් /i)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.length <= 100);

    const updated = [...symptomsList];
    splitTokens.forEach((token) => {
      if (!updated.includes(token) && updated.length < 20) {
        updated.push(token);
      }
    });

    setSymptomsList(updated);
    setSymptomInput('');
    resetVoice();
  };

  // Add single symptom chip handler (manual)
  const handleAddSymptom = () => {
    setInputError('');
    const clean = symptomInput.trim();

    if (!clean) {
      setInputError('Please type a symptom name to add');
      return;
    }
    if (clean.length > 100) {
      setInputError('Symptom string cannot exceed 100 characters');
      return;
    }
    if (symptomsList.includes(clean.toLowerCase())) {
      setInputError('This symptom is already in your list');
      return;
    }
    if (symptomsList.length >= 20) {
      setInputError('Maximum 20 symptoms allowed per analysis request');
      return;
    }

    setSymptomsList([...symptomsList, clean]);
    setSymptomInput('');
  };

  // Remove symptom chip handler
  const handleRemoveSymptom = (index: number) => {
    const updated = [...symptomsList];
    updated.splice(index, 1);
    setSymptomsList(updated);
  };

  // Reset form
  const handleRestart = () => {
    resetVoice();
    setSymptomInput('');
    setSymptomsList([]);
    setDuration('2 days');
    setSeverity('moderate');
    setErrorMsg('');
    setInputError('');
  };

  // Submit Analysis to existing backend rule-based engine
  const handleAnalyze = async () => {
    setErrorMsg('');
    setInputError('');

    // Check if user typed or spoke a symptom without pressing "+ Add"
    let currentSymptoms = [...symptomsList];
    const pendingInput = symptomInput.trim();
    if (pendingInput && !currentSymptoms.includes(pendingInput.toLowerCase())) {
      currentSymptoms.push(pendingInput);
      setSymptomsList(currentSymptoms);
      setSymptomInput('');
    }

    if (currentSymptoms.length === 0) {
      setErrorMsg('Please add at least one symptom to analyze');
      return;
    }

    setLoading(true);

    try {
      const res = await analyzeSymptomsApi({
        symptoms: currentSymptoms,
        duration: duration.trim() || undefined,
        severity,
      });

      if (res && res.success && res.analysis?.symptomCheckId) {
        // Navigate to Analysis Result with symptomCheckId
        router.push({
          pathname: '/(patient)/analysis-result' as any,
          params: { id: res.analysis.symptomCheckId },
        });
      } else {
        setErrorMsg('Unexpected response from symptom analysis service');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Symptom analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title="Symptom Checker"
        subtitle="කරුණාකර ඔබේ රෝග ලක්ෂණ පවසන්න"
        onBackPress={() => router.back()}
        rightComponent={
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={handleRestart}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Restart symptom input"
          >
            <Text style={styles.restartBtnText}>🔄 RESTART</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView
            message={errorMsg}
            onRetry={() => setErrorMsg('')}
            retryText="Dismiss"
          />
        ) : null}

        {/* Conversational Bot Bubble & Voice Trigger */}
        <View style={styles.chatBubbleBot}>
          <View style={styles.botTextCol}>
            <Text style={styles.botBubbleTitle}>Where does it hurt today?</Text>
            <Text style={styles.botBubbleSub}>අද ඔබට රිදෙන්නේ කොතැනද? (Tap mic or type below)</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.headerMicBtn,
              isListening && styles.headerMicBtnActive,
            ]}
            onPress={handleToggleMic}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Tap to speak symptoms'}
          >
            <Text style={styles.headerMicIcon}>{isListening ? '⏹️' : '🎙️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Voice Feedback Banner */}
        {(isListening || voiceState === 'recognized' || voiceState === 'no_speech' || voiceState === 'error') && (
          <View
            style={[
              styles.voiceFeedbackCard,
              isListening && styles.voiceFeedbackListening,
              voiceState === 'recognized' && styles.voiceFeedbackRecognized,
              (voiceState === 'no_speech' || voiceState === 'error') && styles.voiceFeedbackError,
            ]}
          >
            <Text style={styles.voiceFeedbackTitle}>
              {isListening
                ? '🎙️ Listening... Speak your symptoms clearly'
                : voiceState === 'recognized'
                ? '✅ Speech Recognized'
                : voiceState === 'no_speech'
                ? '⚠️ No Speech Detected'
                : 'ℹ️ Voice Notice'}
            </Text>

            {voiceError ? (
              <Text style={styles.voiceFeedbackText}>{voiceError}</Text>
            ) : transcript ? (
              <Text style={styles.voiceFeedbackText}>"{transcript}"</Text>
            ) : null}

            {voiceState === 'recognized' && (
              <TouchableOpacity
                style={styles.convertChipBtn}
                onPress={handleConvertVoiceToChips}
              >
                <Text style={styles.convertChipBtnText}>➕ Add "{transcript}" to Symptoms List</Text>
              </TouchableOpacity>
            )}

            {(voiceState === 'no_speech' || voiceState === 'error') && (
              <TouchableOpacity
                style={styles.retryMicBtn}
                onPress={() => startListening()}
              >
                <Text style={styles.retryMicBtnText}>🔄 Tap to Try Speaking Again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Symptom Input Form */}
        <View style={styles.inputCard}>
          <Text style={styles.cardHeaderTitle}>Add Your Symptoms</Text>

          <View style={styles.inputAddRow}>
            <AppInput
              placeholder="e.g. fever, cough, headache"
              value={symptomInput}
              onChangeText={(val) => {
                setSymptomInput(val);
                if (inputError) setInputError('');
              }}
              containerStyle={styles.flexInput}
              error={inputError}
            />

            <TouchableOpacity
              style={[styles.micIconButton, isListening && styles.micIconButtonActive]}
              onPress={handleToggleMic}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Microphone symptom input"
            >
              <Text style={styles.micIconButtonText}>{isListening ? '⏹️' : '🎙️'}</Text>
            </TouchableOpacity>

            <AppButton
              title="+ Add"
              onPress={handleAddSymptom}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>

          {/* Active Symptom Chips */}
          <Text style={styles.chipLabel}>Added Symptoms ({symptomsList.length}):</Text>
          <View style={styles.chipsContainer}>
            {symptomsList.length > 0 ? (
              symptomsList.map((sym, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.symptomChip}
                  onPress={() => handleRemoveSymptom(idx)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove symptom ${sym}`}
                >
                  <Text style={styles.symptomChipText}>{sym}</Text>
                  <Text style={styles.chipRemoveIcon}>✕</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noChipsText}>
                No symptoms added yet. Type or speak a symptom above and tap "+ Add".
              </Text>
            )}
          </View>

          {/* Duration Input */}
          <AppInput
            label="How long have you had these symptoms?"
            placeholder="e.g. 2 days, 3 hours"
            value={duration}
            onChangeText={setDuration}
          />

          {/* Severity Selector */}
          <Text style={styles.fieldLabel}>Severity Level</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.8}
                onPress={() => setSeverity(item.value)}
                style={[
                  styles.severityChip,
                  severity === item.value && styles.severityChipSelected,
                  severity === item.value && item.value === 'severe' && styles.severityChipDanger,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select severity ${item.label}`}
              >
                <Text
                  style={[
                    styles.severityText,
                    severity === item.value && styles.severityTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppButton
            title="🔍 Analyze Symptoms"
            onPress={handleAnalyze}
            loading={loading}
            style={styles.analyzeBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xs,
  },
  restartBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  restartBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chatBubbleBot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  botTextCol: {
    flex: 1,
  },
  botBubbleTitle: {
    ...typography.subheader,
    color: colors.textWhite,
  },
  botBubbleSub: {
    ...typography.caption,
    color: '#DBEAFE',
    marginTop: 2,
  },
  headerMicBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerMicBtnActive: {
    backgroundColor: colors.danger,
    borderColor: '#FFFFFF',
  },
  headerMicIcon: {
    fontSize: 24,
  },
  voiceFeedbackCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  voiceFeedbackListening: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  voiceFeedbackRecognized: {
    borderColor: colors.success,
    backgroundColor: '#F0FDF4',
  },
  voiceFeedbackError: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  voiceFeedbackTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  voiceFeedbackText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  convertChipBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  convertChipBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  retryMicBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  retryMicBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  inputCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeaderTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputAddRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flexInput: {
    flex: 1,
    marginRight: spacing.xs,
  },
  micIconButton: {
    height: 52,
    width: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginRight: spacing.xs,
  },
  micIconButtonActive: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
  },
  micIconButtonText: {
    fontSize: 22,
  },
  addBtn: {
    height: 52,
    minWidth: 70,
    marginTop: spacing.xs,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  symptomChipText: {
    ...typography.bodyBold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  chipRemoveIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  noChipsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  fieldLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  severityChip: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  severityChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  severityChipDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  severityText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  severityTextSelected: {
    color: colors.primary,
  },
  analyzeBtn: {
    marginTop: spacing.xs,
  },
});
