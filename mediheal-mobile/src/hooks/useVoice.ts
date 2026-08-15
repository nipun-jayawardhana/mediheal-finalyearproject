import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  VoiceLanguage,
  VoiceState,
  getLocaleForLanguage,
  isSpeechRecognitionSupported,
  requestSpeechPermissions,
  speakText,
  stopSpeaking,
} from '../services/voiceService';

export interface UseVoiceOptions {
  language?: VoiceLanguage;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onSpeechEnd?: () => void;
}

export const useVoice = (options: UseVoiceOptions = {}) => {
  const { language = 'en', onTranscript, onSpeechEnd } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webRecognitionRef = useRef<any>(null);

  // Clear silence timeout helper
  const clearSilenceTimer = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Reset voice state
  const resetVoice = useCallback(() => {
    clearSilenceTimer();
    setVoiceState('idle');
    setIsListening(false);
    setIsSpeaking(false);
    setTranscript('');
    setErrorMessage('');
  }, []);

  // Stop Speech-to-Text
  const stopListening = useCallback(async () => {
    clearSilenceTimer();
    setIsListening(false);

    try {
      if (Platform.OS === 'web' && webRecognitionRef.current) {
        webRecognitionRef.current.stop();
      } else if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.stop === 'function') {
        await ExpoSpeechRecognitionModule.stop();
      }
    } catch (err) {
      // Ignore stop errors
    }

    if (voiceState === 'listening') {
      setVoiceState(transcript ? 'recognized' : 'no_speech');
    }
  }, [voiceState, transcript]);

  // Stop Text-to-Speech
  const stopSpeech = useCallback(async () => {
    await stopSpeaking();
    setIsSpeaking(false);
  }, []);

  // Text-to-Speech wrapper
  const speak = useCallback(
    async (text: string, customLang?: VoiceLanguage) => {
      if (!text) return;
      setIsSpeaking(true);
      const targetLang = customLang || language;

      await speakText(
        text,
        targetLang,
        () => {
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
        },
        (_err) => {
          setIsSpeaking(false);
        }
      );
    },
    [language, onSpeechEnd]
  );

  // Native ExpoSpeechRecognition event listeners
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setVoiceState('listening');
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    clearSilenceTimer();
    const results = event.results || [];
    if (results.length > 0) {
      const bestTranscript = results[0]?.transcript || '';
      const isFinal = Boolean(event.isFinal || results[0]?.isFinal);

      if (bestTranscript) {
        setTranscript(bestTranscript);
        setVoiceState(isFinal ? 'recognized' : 'listening');

        if (onTranscript) {
          onTranscript(bestTranscript, isFinal);
        }
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer();
    setIsListening(false);
    setVoiceState((prev) => {
      if (prev === 'listening' || prev === 'processing') {
        return transcript ? 'recognized' : 'no_speech';
      }
      return prev;
    });
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    clearSilenceTimer();
    setIsListening(false);

    const errStr = event.error || event.message || '';
    if (errStr.includes('no-speech') || errStr.includes('7')) {
      setVoiceState('no_speech');
      setErrorMessage("We didn't hear anything. Please try again or type your symptoms.");
    } else {
      setVoiceState('error');
      setErrorMessage(errStr || 'Speech recognition encountered an error. You can still type your symptoms.');
    }
  });

  // Start Speech-to-Text
  const startListening = useCallback(
    async (customLang?: VoiceLanguage) => {
      resetVoice();
      setVoiceState('requesting');

      // Stop any active TTS first
      await stopSpeech();

      // Check support
      const supported = isSpeechRecognitionSupported();

      // Request permission upon active user tap
      const hasPermission = await requestSpeechPermissions();

      if (!hasPermission) {
        setVoiceState('error');
        setErrorMessage(
          'Microphone access is needed for voice input. You can still type your symptoms.'
        );
        return;
      }

      if (!supported && Platform.OS !== 'web') {
        // Safe fallback for Expo Go where native module binary is not linked
        setVoiceState('error');
        setErrorMessage(
          'Speech recognition requires a Development Build or supported device. Manual symptom entry remains fully available.'
        );
        return;
      }

      const locale = getLocaleForLanguage(customLang || language);

      try {
        if (Platform.OS === 'web') {
          const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

          if (!SpeechRecognition) {
            setVoiceState('error');
            setErrorMessage('Voice recognition is not supported in this browser. Please type your symptoms.');
            return;
          }

          const recognition = new SpeechRecognition();
          webRecognitionRef.current = recognition;
          recognition.lang = locale;
          recognition.interimResults = true;
          recognition.continuous = false;

          recognition.onstart = () => {
            setIsListening(true);
            setVoiceState('listening');
          };

          recognition.onresult = (event: any) => {
            clearSilenceTimer();
            let current = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              current += event.results[i][0].transcript;
            }
            if (current) {
              setTranscript(current);
              setVoiceState('listening');
              if (onTranscript) {
                onTranscript(current, event.results[0].isFinal);
              }
            }
          };

          recognition.onerror = (e: any) => {
            clearSilenceTimer();
            setIsListening(false);
            if (e.error === 'no-speech') {
              setVoiceState('no_speech');
              setErrorMessage("We didn't hear anything. Please try again or type your symptoms.");
            } else {
              setVoiceState('error');
              setErrorMessage('Voice input failed. Please type your symptoms manually.');
            }
          };

          recognition.onend = () => {
            clearSilenceTimer();
            setIsListening(false);
            setVoiceState((prev) => (prev === 'listening' ? 'recognized' : prev));
          };

          recognition.start();
        } else if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.start === 'function') {
          await ExpoSpeechRecognitionModule.start({
            lang: locale,
            interimResults: true,
            maxAlternatives: 1,
            recordingOptions: {
              persist: false, // Privacy requirement: Do NOT save raw microphone recordings
            },
          });
          setIsListening(true);
          setVoiceState('listening');
        }

        // Set 8 second silence fallback timer
        silenceTimeoutRef.current = setTimeout(() => {
          if (!transcript) {
            stopListening();
            setVoiceState('no_speech');
            setErrorMessage("We didn't hear anything. Please try again or type your symptoms.");
          }
        }, 8000);
      } catch (err: any) {
        console.warn('Error starting speech recognition:', err);
        setVoiceState('error');
        setErrorMessage(
          err.message || 'Speech recognition is unavailable on this device. Manual symptom entry remains fully available.'
        );
      }
    },
    [language, resetVoice, stopSpeech, stopListening, transcript, onTranscript]
  );

  // Clean up on unmount (Requirement 21 & 2)
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      stopSpeaking();
      try {
        if (Platform.OS === 'web' && webRecognitionRef.current) {
          webRecognitionRef.current.abort();
        } else if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.abort === 'function') {
          ExpoSpeechRecognitionModule.abort();
        }
      } catch (err) {
        // Ignore abort error on cleanup
      }
    };
  }, []);

  return {
    voiceState,
    isListening,
    isSpeaking,
    transcript,
    errorMessage,
    speak,
    stopSpeech,
    startListening,
    stopListening,
    resetVoice,
    setTranscript,
  };
};
