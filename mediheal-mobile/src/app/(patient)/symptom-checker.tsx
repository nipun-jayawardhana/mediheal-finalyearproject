import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { analyzeSymptomsApi, getSymptomFollowUpApi } from '../../services/symptomService';
import {
  SeverityLevel,
  SymptomConversationTurn,
  SymptomSummaryData,
} from '../../types/symptom';
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

  // Step Mode: 'initial' | 'conversing' | 'summary'
  const [stepMode, setStepMode] = useState<'initial' | 'conversing' | 'summary'>('initial');

  // Symptoms & Input State
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomsList, setSymptomsList] = useState<string[]>([]);

  // Conversation History
  const [conversation, setConversation] = useState<SymptomConversationTurn[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentQuickOptions, setCurrentQuickOptions] = useState<string[]>([]);
  const [answerInput, setAnswerInput] = useState<string>('');

  // Structured Summary State
  const [summaryData, setSummaryData] = useState<SymptomSummaryData | null>(null);
  const [analysisRequestId, setAnalysisRequestId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Emergency Trigger State
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [emergencyWarning, setEmergencyWarning] = useState<string>('');

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');

  // Voice Hook Integration
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
    onTranscript: (capturedText) => {
      if (capturedText) {
        if (stepMode === 'conversing') {
          setAnswerInput(capturedText);
        } else {
          setSymptomInput(capturedText);
        }
      }
    },
  });

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const decomposeTextToSymptomChips = (text: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    const clean = text.trim();
    if (!clean) return [];

    if (clean.length <= 100 && !clean.includes(',') && !clean.includes(' and ')) {
      return [clean.toLowerCase()];
    }

    const clauses = clean
      .split(/[,;\.]|\s+(?:and|with|spreading to|as well as|feeling like|like a feeling)\s+/i)
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0);

    const concepts: string[] = [];
    for (const clause of clauses) {
      const concise = clause.length > 100 ? clause.substring(0, 97) + '...' : clause;
      if (!concepts.includes(concise) && concepts.length < 10) {
        concepts.push(concise);
      }
    }

    return concepts.length > 0 ? concepts : [clean.substring(0, 100).toLowerCase()];
  };

  // Convert voice transcript to symptom chips in initial state
  const handleConvertVoiceToChips = () => {
    const rawText = (symptomInput || transcript).trim();
    if (!rawText) return;

    const splitTokens = decomposeTextToSymptomChips(rawText);
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

  // Add single or natural text symptom description
  const handleAddSymptom = () => {
    setInputError('');
    const clean = symptomInput.trim();

    if (!clean) {
      setInputError('Please type a symptom name to add');
      return;
    }
    if (symptomsList.length >= 20) {
      setInputError('Maximum 20 symptoms allowed per analysis request');
      return;
    }

    const concepts = decomposeTextToSymptomChips(clean);
    const updated = [...symptomsList];
    concepts.forEach((c) => {
      if (!updated.includes(c) && updated.length < 20) {
        updated.push(c);
      }
    });

    setSymptomsList(updated);
    setSymptomInput('');
  };

  const handleRemoveSymptom = (index: number) => {
    const updated = [...symptomsList];
    updated.splice(index, 1);
    setSymptomsList(updated);
  };

  // Reset entire conversation state
  const handleRestart = () => {
    resetVoice();
    setStepMode('initial');
    setSymptomInput('');
    setSymptomsList([]);
    setConversation([]);
    setQuestionCount(0);
    setCurrentQuestion('');
    setCurrentQuickOptions([]);
    setAnswerInput('');
    setSummaryData(null);
    setAnalysisRequestId('');
    setIsAnalyzing(false);
    setIsEmergency(false);
    setEmergencyWarning('');
    setErrorMsg('');
    setInputError('');
    setLoading(false);
  };

  // Start Conversational Assessment
  const handleStartConversationalAssessment = async () => {
    setErrorMsg('');
    setInputError('');

    let activeSymptoms = [...symptomsList];
    const pendingInput = symptomInput.trim();
    if (pendingInput) {
      const concepts = decomposeTextToSymptomChips(pendingInput);
      concepts.forEach((c) => {
        if (!activeSymptoms.includes(c) && activeSymptoms.length < 20) {
          activeSymptoms.push(c);
        }
      });
      setSymptomsList(activeSymptoms);
      setSymptomInput('');
    }

    if (activeSymptoms.length === 0) {
      setErrorMsg('Please add at least one symptom to start assessment');
      return;
    }

    setLoading(true);
    setLoadingText('Preparing follow-up question...');

    try {
      const res = await getSymptomFollowUpApi({
        symptoms: activeSymptoms,
        conversation: [],
        questionCount: 0,
      });

      if (res && res.success && res.data) {
        if (res.data.status === 'emergency' || res.data.isEmergency) {
          setIsEmergency(true);
          setEmergencyWarning(res.data.emergencyWarning || 'High risk symptoms detected! Seek immediate medical attention.');
          setStepMode('conversing');
        } else if (res.data.status === 'ask' && res.data.question) {
          setCurrentQuestion(res.data.question);
          setCurrentQuickOptions(res.data.quickOptions || []);
          setQuestionCount(1);
          setStepMode('conversing');
        } else if (res.data.status === 'complete' && res.data.summary) {
          setSummaryData(res.data.summary);
          setStepMode('summary');
        }
      } else {
        // Fallback: Proceed directly to summary if service unavailable
        setSummaryData({
          symptoms: activeSymptoms,
          duration: '2 days',
          severity: 'moderate',
          additionalContext: [],
        });
        setStepMode('summary');
      }
    } catch (err: any) {
      // Fallback on network/API failure
      setSummaryData({
        symptoms: activeSymptoms,
        duration: '2 days',
        severity: 'moderate',
        additionalContext: [],
      });
      setStepMode('summary');
    } finally {
      setLoading(false);
    }
  };

  // Submit Answer to Current Question
  const handleSendAnswer = async (providedAnswer?: string) => {
    const finalAnswer = (providedAnswer || answerInput || transcript).trim();
    if (!finalAnswer) return;

    setErrorMsg('');
    resetVoice();

    const updatedTurn: SymptomConversationTurn = {
      question: currentQuestion,
      answer: finalAnswer,
    };
    const newHistory = [...conversation, updatedTurn];
    setConversation(newHistory);
    setAnswerInput('');

    const newQCount = questionCount;

    setLoading(true);
    setLoadingText('Analyzing your answer...');

    try {
      const res = await getSymptomFollowUpApi({
        symptoms: symptomsList,
        conversation: newHistory,
        questionCount: newQCount,
      });

      if (res && res.success && res.data) {
        if (res.data.status === 'emergency' || res.data.isEmergency) {
          setIsEmergency(true);
          setEmergencyWarning(res.data.emergencyWarning || 'High risk symptoms detected! Seek immediate medical attention.');
        } else if (res.data.status === 'ask' && res.data.question && newQCount < 3) {
          setCurrentQuestion(res.data.question);
          setCurrentQuickOptions(res.data.quickOptions || []);
          setQuestionCount(newQCount + 1);
        } else {
          // Status complete or 3 question limit reached
          const completeSummary = res.data.summary || {
            symptoms: symptomsList,
            duration: extractFieldValue(newHistory, 'duration') || '2 days',
            severity: (extractFieldValue(newHistory, 'severity') as SeverityLevel) || 'moderate',
            additionalContext: newHistory.map((c) => `${c.question}: ${c.answer}`),
          };
          setSummaryData(completeSummary);
          setStepMode('summary');
        }
      } else {
        // Fallback to summary if API returns unexpected format
        setSummaryData({
          symptoms: symptomsList,
          duration: extractFieldValue(newHistory, 'duration') || '2 days',
          severity: 'moderate',
          additionalContext: newHistory.map((c) => `${c.question}: ${c.answer}`),
        });
        setStepMode('summary');
      }
    } catch (err: any) {
      // Fallback to summary on error
      setSummaryData({
        symptoms: symptomsList,
        duration: extractFieldValue(newHistory, 'duration') || '2 days',
        severity: 'moderate',
        additionalContext: newHistory.map((c) => `${c.question}: ${c.answer}`),
      });
      setStepMode('summary');
    } finally {
      setLoading(false);
    }
  };

  // Skip Optional Follow-Up Question
  const handleSkipQuestion = () => {
    handleSendAnswer('Not sure / Skipped');
  };

  // Helper to extract field value from history
  const extractFieldValue = (history: SymptomConversationTurn[], keyword: string): string => {
    const found = history.find((h) => h.question.toLowerCase().includes(keyword));
    return found ? found.answer : '';
  };

  // Final OpenBioLLM Analysis Call
  const handleFinalAnalyze = async () => {
    if (!summaryData || loading || isAnalyzing) return;

    const reqId = analysisRequestId || `req-${Math.random().toString(36).substring(2, 10)}`;
    if (!analysisRequestId) {
      setAnalysisRequestId(reqId);
    }

    setErrorMsg('');
    setIsAnalyzing(true);
    setLoading(true);
    setLoadingText('Analyzing symptoms with OpenBioLLM...');

    try {
      const res = await analyzeSymptomsApi({
        symptoms: summaryData.symptoms,
        duration: summaryData.duration,
        severity: summaryData.severity,
        analysisRequestId: reqId,
      });

      if (res && res.success && res.analysis?.symptomCheckId) {
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
      setIsAnalyzing(false);
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

        {/* Emergency Alert Card (if triggered) */}
        {isEmergency && (
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeaderRow}>
              <Text style={styles.emergencyIcon}>🚨</Text>
              <View style={styles.emergencyTextCol}>
                <Text style={styles.emergencyTitle}>Urgent Emergency Warning</Text>
                <Text style={styles.emergencySub}>{emergencyWarning}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emergencyBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/(patient)/emergency-countdown' as any)}
            >
              <Text style={styles.emergencyBtnText}>🚨 Trigger Emergency SOS Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP MODE 1: INITIAL SYMPTOM ENTRY */}
        {stepMode === 'initial' && (
          <View>
            {/* Header Bot Greeting Bubble matching visual reference */}
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

            {/* Initial Symptom Input Form */}
            <View style={styles.inputCard}>
              <Text style={styles.cardHeaderTitle}>State Your Initial Symptom</Text>
              <Text style={styles.cardHeaderSub}>We will ask up to 3 short follow-up questions to understand your condition.</Text>

              <View style={styles.inputAddRow}>
                <AppInput
                  placeholder="e.g. headache, chest pain, fever"
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
              <Text style={styles.chipLabel}>Initial Symptoms ({symptomsList.length}):</Text>
              <View style={styles.chipsContainer}>
                {symptomsList.length > 0 ? (
                  symptomsList.map((sym, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.symptomChip}
                      onPress={() => handleRemoveSymptom(idx)}
                      activeOpacity={0.7}
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

              <AppButton
                title="Start Symptom Assessment ➔"
                onPress={handleStartConversationalAssessment}
                loading={loading}
                style={styles.startAssessmentBtn}
              />
            </View>
          </View>
        )}

        {/* STEP MODE 2: CONVERSATIONAL FOLLOW-UP ASSESSOR */}
        {stepMode === 'conversing' && !isEmergency && (
          <View>
            {/* Progress Badge */}
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Follow-up Question {questionCount} of up to 3</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(questionCount / 3) * 100}%` }]} />
              </View>
            </View>

            {/* Conversation Messages History */}
            <View style={styles.conversationContainer}>
              {/* Initial Symptoms Bubble */}
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>
                  I have: {symptomsList.join(', ')}
                </Text>
              </View>

              {/* Past Turns */}
              {conversation.map((turn, idx) => (
                <View key={idx}>
                  <View style={styles.chatBubbleBot}>
                    <Text style={styles.botBubbleIcon}>🤖</Text>
                    <Text style={styles.botBubbleTitle}>{turn.question}</Text>
                  </View>

                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{turn.answer}</Text>
                  </View>
                </View>
              ))}

              {/* Active Bot Question */}
              {currentQuestion ? (
                <View style={styles.activeQuestionCard}>
                  <View style={styles.activeQuestionHeader}>
                    <Text style={styles.activeQuestionIcon}>🤖</Text>
                    <Text style={styles.activeQuestionTitle}>{currentQuestion}</Text>
                  </View>

                  {/* Quick Answer Chips (if available) */}
                  {currentQuickOptions && currentQuickOptions.length > 0 && (
                    <View style={styles.quickOptionsRow}>
                      {currentQuickOptions.map((opt, oIdx) => (
                        <TouchableOpacity
                          key={oIdx}
                          style={styles.quickOptionChip}
                          onPress={() => handleSendAnswer(opt)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quickOptionText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Manual Text / Voice Answer Row */}
                  <View style={styles.answerInputRow}>
                    <AppInput
                      placeholder="Type your answer here..."
                      value={answerInput}
                      onChangeText={setAnswerInput}
                      containerStyle={styles.flexInput}
                    />

                    <TouchableOpacity
                      style={[styles.micIconButton, isListening && styles.micIconButtonActive]}
                      onPress={handleToggleMic}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.micIconButtonText}>{isListening ? '⏹️' : '🎙️'}</Text>
                    </TouchableOpacity>

                    <AppButton
                      title="Send"
                      onPress={() => handleSendAnswer()}
                      loading={loading}
                      style={styles.sendBtn}
                    />
                  </View>

                  {/* Voice Feedback inside question card */}
                  {isListening && (
                    <Text style={styles.activeListeningText}>
                      🎙️ Listening... Speak your answer
                    </Text>
                  )}

                  {/* Skip Question Button */}
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={handleSkipQuestion}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipBtnText}>Skip question ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {loading && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingBoxText}>{loadingText || 'Processing...'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* STEP MODE 3: STRUCTURED SYMPTOM SUMMARY CONFIRMATION */}
        {stepMode === 'summary' && summaryData && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderIcon}>📋</Text>
              <View>
                <Text style={styles.summaryHeaderTitle}>Symptom Assessment Summary</Text>
                <Text style={styles.summaryHeaderSub}>Please review your information before AI analysis</Text>
              </View>
            </View>

            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Symptoms Identified:</Text>
              <View style={styles.chipsContainer}>
                {summaryData.symptoms.map((s, idx) => (
                  <View key={idx} style={styles.summaryChip}>
                    <Text style={styles.summaryChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Duration:</Text>
                <Text style={styles.summaryVal}>{summaryData.duration}</Text>
              </View>

              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Discomfort Severity:</Text>
                <Text
                  style={[
                    styles.summaryVal,
                    summaryData.severity === 'severe' && { color: colors.danger, fontWeight: '800' },
                  ]}
                >
                  {summaryData.severity.toUpperCase()}
                </Text>
              </View>
            </View>

            {summaryData.additionalContext && summaryData.additionalContext.length > 0 && (
              <View style={styles.summarySection}>
                <Text style={styles.summaryLabel}>Additional Notes:</Text>
                {summaryData.additionalContext.map((note, nIdx) => (
                  <Text key={nIdx} style={styles.summaryNoteText}>• {note}</Text>
                ))}
              </View>
            )}

            {/* Severity Adjustment Options */}
            <Text style={styles.fieldLabel}>Adjust Severity Level (if needed)</Text>
            <View style={styles.severityRow}>
              {SEVERITY_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  activeOpacity={0.8}
                  onPress={() => setSummaryData({ ...summaryData, severity: item.value })}
                  style={[
                    styles.severityChip,
                    summaryData.severity === item.value && styles.severityChipSelected,
                    summaryData.severity === item.value && item.value === 'severe' && styles.severityChipDanger,
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      summaryData.severity === item.value && styles.severityTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <AppButton
              title="🔍 Analyze Symptoms with OpenBioLLM"
              onPress={handleFinalAnalyze}
              loading={loading}
              disabled={isAnalyzing || loading}
              style={styles.finalAnalyzeBtn}
            />

            <View style={styles.summaryActionRow}>
              <TouchableOpacity
                style={[styles.editBtn, (isAnalyzing || loading) && { opacity: 0.5 }]}
                onPress={() => !isAnalyzing && !loading && setStepMode('initial')}
                disabled={isAnalyzing || loading}
              >
                <Text style={styles.editBtnText}>✏️ Edit Symptoms</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.restartSummaryBtn, (isAnalyzing || loading) && { opacity: 0.5 }]}
                onPress={() => !isAnalyzing && !loading && handleRestart()}
                disabled={isAnalyzing || loading}
              >
                <Text style={styles.restartSummaryBtnText}>🔄 Restart</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  botBubbleIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
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
  },
  cardHeaderSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  startAssessmentBtn: {
    marginTop: spacing.xs,
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
  emergencyBtn: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emergencyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primary,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  conversationContainer: {
    marginBottom: spacing.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    borderBottomRightRadius: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  userBubbleText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  activeQuestionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  activeQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  activeQuestionIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  activeQuestionTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
    flex: 1,
  },
  quickOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  quickOptionChip: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  quickOptionText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  answerInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sendBtn: {
    height: 52,
    minWidth: 80,
    marginTop: spacing.xs,
  },
  activeListeningText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    marginTop: 4,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingBoxText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryHeaderIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  summaryHeaderTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
  },
  summaryHeaderSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summarySection: {
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryChip: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  summaryChipText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryCol: {
    flex: 1,
  },
  summaryVal: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  summaryNoteText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
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
  finalAnalyzeBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  editBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  editBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  restartSummaryBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  restartSummaryBtnText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    fontSize: 14,
  },
});
