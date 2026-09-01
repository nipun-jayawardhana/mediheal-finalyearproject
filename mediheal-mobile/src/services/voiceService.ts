import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { apiClient } from '../api/apiClient';

export type VoiceLanguage = 'en' | 'si' | 'ta' | string;

export type VoiceState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'recognized'
  | 'no_speech'
  | 'error';

// Reference to active server-generated HTML5/Native audio instance
let activeServerAudio: any = null;
let isServerAudioActive = false;

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
 * Attempts to find a matching installed voice for the target locale or base language.
 */
export const findBestVoiceForLocale = async (locale: string): Promise<string | undefined> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices || voices.length === 0) return undefined;

    const reqLocaleLower = locale.toLowerCase();
    const baseLangLower = locale.split('-')[0].toLowerCase();

    // 1. Exact locale match e.g. "si-lk" or "ta-lk" or "en-us"
    const exactMatch = voices.find(
      (v) => (v.language || '').toLowerCase().replace('_', '-') === reqLocaleLower
    );
    if (exactMatch) return exactMatch.identifier || exactMatch.name;

    // 2. Base language match e.g. "si" or "ta"
    const baseMatch = voices.find(
      (v) =>
        (v.language || '').toLowerCase().startsWith(`${baseLangLower}-`) ||
        (v.language || '').toLowerCase() === baseLangLower
    );
    if (baseMatch) return baseMatch.identifier || baseMatch.name;

    return undefined;
  } catch (e) {
    return undefined;
  }
};

/**
 * Stop any ongoing Text-to-Speech playback (both local speech synthesis and server audio).
 */
export const stopSpeaking = async (): Promise<void> => {
  try {
    // 1. Stop local Expo Speech
    const isLocalSpeaking = await Speech.isSpeakingAsync();
    if (isLocalSpeaking) {
      await Speech.stop();
    }
  } catch (err) {
    // Ignore local speech stop errors
  }

  // 2. Stop server-generated audio instance
  if (activeServerAudio) {
    try {
      if (typeof activeServerAudio.pause === 'function') {
        activeServerAudio.pause();
        activeServerAudio.currentTime = 0;
      }
      activeServerAudio.onended = null;
      activeServerAudio.onerror = null;
    } catch (e) {
      // Ignore audio cleanup error
    }
    activeServerAudio = null;
  }
  isServerAudioActive = false;
};

/**
 * Fetches server-synthesized TTS audio base64 payload from backend.
 */
export const fetchServerTtsAudio = async (text: string, language: string): Promise<string> => {
  const res = await apiClient.post('/voice/tts', { text, language });
  if (res.data && res.data.success && res.data.audioBase64) {
    return res.data.audioBase64;
  }
  throw new Error('Failed to retrieve server TTS audio response.');
};

/**
 * Plays server-synthesized audio payload using HTML5 Audio on Web or system player.
 */
export const playServerAudio = async (
  audioBase64: string,
  onDone?: () => void,
  onError?: (error: any) => void
): Promise<void> => {
  await stopSpeaking();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).Audio !== 'undefined') {
    try {
      const audio = new (window as any).Audio(audioBase64);
      activeServerAudio = audio;
      isServerAudioActive = true;

      audio.onended = () => {
        isServerAudioActive = false;
        activeServerAudio = null;
        if (onDone) onDone();
      };

      audio.onerror = (e: any) => {
        console.error('[TTS SERVER AUDIO] Web Audio element playback error:', e);
        isServerAudioActive = false;
        activeServerAudio = null;
        if (onError) onError(e);
      };

      await audio.play();
    } catch (err) {
      console.error('[TTS SERVER AUDIO] Web play exception:', err);
      isServerAudioActive = false;
      activeServerAudio = null;
      if (onError) onError(err);
    }
  } else {
    // Mobile Native Fallback audio player (Data URI supported in React Native Web / native elements)
    try {
      const AudioConstructor = (globalThis as any).Audio || (typeof window !== 'undefined' ? (window as any).Audio : null);
      if (AudioConstructor) {
        const audio = new AudioConstructor(audioBase64);
        activeServerAudio = audio;
        isServerAudioActive = true;
        audio.onended = () => {
          isServerAudioActive = false;
          activeServerAudio = null;
          if (onDone) onDone();
        };
        await audio.play();
      } else if (onDone) {
        onDone();
      }
    } catch (err) {
      console.warn('[TTS SERVER AUDIO] Native play fallback warning:', err);
      isServerAudioActive = false;
      activeServerAudio = null;
      if (onDone) onDone();
    }
  }
};

/**
 * Helper to handle fallback to server TTS when local speech fails.
 */
const triggerServerTtsFallback = (
  text: string,
  targetLang: string,
  onDone?: () => void,
  onError?: (error: any) => void
) => {
  fetchServerTtsAudio(text, targetLang)
    .then((audioBase64) => playServerAudio(audioBase64, onDone, onError))
    .catch((fallbackErr) => {
      if (onError) onError(fallbackErr);
    });
};

/**
 * TEXT-TO-SPEECH (TTS) DUAL-ENGINE CONTROLLER
 * Tries local speech synthesis first if voice exists.
 * Falls back seamlessly to backend server cloud TTS if local voice for Sinhala/Tamil is absent.
 */
export const speakText = async (
  text: string,
  lang?: VoiceLanguage,
  onDone?: () => void,
  onError?: (error: any) => void
): Promise<void> => {
  if (!text || !text.trim()) return;

  const targetLang = (lang || 'en').toLowerCase().trim();
  const locale = getLocaleForLanguage(targetLang);

  try {
    await stopSpeaking();

    // Check local voice availability
    const voiceId = await findBestVoiceForLocale(locale);

    // Decision: Use local TTS if language is English OR if a local voice for Sinhala/Tamil is installed
    if (targetLang === 'en' || voiceId !== undefined) {
      if (__DEV__) {
        console.log(`[TTS ENGINE] language=${targetLang}`);
        console.log(`[TTS ENGINE] locale=${locale}`);
        console.log(`[TTS ENGINE] source=local`);
      }

      const speakOptions: Speech.SpeechOptions = {
        language: locale,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          if (onDone) onDone();
        },
        onStopped: () => {
          if (onDone) onDone();
        },
        onError: (err) => {
          console.warn(`[TTS LOCAL ERROR] Error speaking local locale ${locale}:`, err);
          // If local speech fails unexpectedly for non-English, attempt server TTS fallback rather than English!
          if (targetLang !== 'en') {
            if (__DEV__) {
              console.log(`[TTS ENGINE] Local voice error; switching to server fallback...`);
            }
            triggerServerTtsFallback(text.trim(), targetLang, onDone, onError);
          } else if (onError) {
            onError(err);
          }
        },
      };

      if (voiceId) {
        speakOptions.voice = voiceId;
      }

      Speech.speak(text.trim(), speakOptions);
    } else {
      // Local voice for Sinhala/Tamil is missing (e.g. Chrome on Windows) -> Use Server TTS Fallback
      if (__DEV__) {
        console.log(`[TTS ENGINE] language=${targetLang}`);
        console.log(`[TTS ENGINE] locale=${locale}`);
        console.log(`[TTS ENGINE] Local voice unavailable`);
        console.log(`[TTS ENGINE] source=server-fallback`);
      }

      triggerServerTtsFallback(text.trim(), targetLang, onDone, onError);
    }
  } catch (err) {
    console.error('[TTS DUAL ENGINE] Error during TTS playback:', err);
    if (onError) onError(err);
  }
};

/**
 * Check if TTS is currently playing audio (local or server).
 */
export const isSpeakingActive = async (): Promise<boolean> => {
  try {
    const isLocalSpeaking = await Speech.isSpeakingAsync();
    return isLocalSpeaking || isServerAudioActive;
  } catch (err) {
    return isServerAudioActive;
  }
};
