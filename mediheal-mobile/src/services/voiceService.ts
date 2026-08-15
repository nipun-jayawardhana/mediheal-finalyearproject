import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';

export type VoiceLanguage = 'en' | 'si' | 'ta' | string;

export type VoiceState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'recognized'
  | 'no_speech'
  | 'error';

/**
 * Maps MediHeal language code to BCP 47 locale tag
 */
export const getLocaleForLanguage = (lang?: VoiceLanguage): string => {
  switch (lang) {
    case 'si':
      return 'si-LK';
    case 'ta':
      return 'ta-LK';
    case 'en':
    default:
      return 'en-US';
  }
};

/**
 * Check if Speech Recognition native module or Web API is available on the current environment.
 */
export const isSpeechRecognitionSupported = (): boolean => {
  try {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
      );
    }
    return Boolean(
      ExpoSpeechRecognitionModule &&
        typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
        ExpoSpeechRecognitionModule.isRecognitionAvailable()
    );
  } catch (err) {
    return false;
  }
};

/**
 * Request microphone & speech recognition permissions when actively triggered by user.
 */
export const requestSpeechPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      // Browser handles permission upon starting SpeechRecognition
      return isSpeechRecognitionSupported();
    }

    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function') {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    }
    return false;
  } catch (err) {
    console.warn('Speech recognition permission request failed:', err);
    return false;
  }
};

/**
 * TEXT-TO-SPEECH (TTS)
 * Speaks text using expo-speech with safe language locale mapping and overlap prevention.
 */
export const speakText = async (
  text: string,
  lang?: VoiceLanguage,
  onDone?: () => void,
  onError?: (error: any) => void
): Promise<void> => {
  if (!text || !text.trim()) return;

  try {
    // Prevent overlapping speech
    await stopSpeaking();

    const locale = getLocaleForLanguage(lang);

    Speech.speak(text.trim(), {
      language: locale,
      pitch: 1.0,
      rate: 0.9, // Slightly slower rate for accessibility and clarity for elderly patients
      onDone: () => {
        if (onDone) onDone();
      },
      onStopped: () => {
        if (onDone) onDone();
      },
      onError: (err) => {
        console.warn(`TTS error for locale ${locale}:`, err);
        // If error occurs (e.g. unsupported locale), fallback to default speech
        if (locale !== 'en-US') {
          Speech.speak(text.trim(), {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.9,
            onDone,
            onStopped: onDone,
            onError: (fallbackErr) => {
              if (onError) onError(fallbackErr);
            },
          });
        } else if (onError) {
          onError(err);
        }
      },
    });
  } catch (err) {
    console.error('Error initiating TTS speakText:', err);
    if (onError) onError(err);
  }
};

/**
 * Stop any ongoing Text-to-Speech playback.
 */
export const stopSpeaking = async (): Promise<void> => {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
  } catch (err) {
    // Ignore error if speech was not active
  }
};

/**
 * Check if TTS is currently playing audio.
 */
export const isSpeakingActive = async (): Promise<boolean> => {
  try {
    return await Speech.isSpeakingAsync();
  } catch (err) {
    return false;
  }
};
