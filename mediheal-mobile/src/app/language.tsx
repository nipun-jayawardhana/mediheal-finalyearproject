import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { AppHeader } from '../components/AppHeader';
import { AppButton } from '../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
} from '../utils/languageStorage';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, setLanguage, t, isLoadingLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(language);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<string>('');

  useEffect(() => {
    setSelectedLang(language);
  }, [language]);

  const handleSelectLanguage = async (code: LanguageCode) => {
    try {
      setSaving(true);
      setSelectedLang(code);
      await setLanguage(code);

      const langName = SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;
      setSavedBanner(`${t('languageSaved')}: ${langName}`);

      setTimeout(() => {
        setSavedBanner('');
      }, 3000);
    } catch (err) {
      console.error('Error saving language:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title={t('chooseLanguage')}
        subtitle="තෝරන්න / தேர்ந்தெடுக்கவும்"
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={styles.heading}>{t('chooseLanguage')}</Text>
        <Text style={styles.subheading}>
          {t('languageSub')}
        </Text>

        {savedBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>✓ {savedBanner}</Text>
          </View>
        ) : null}

        {isLoadingLanguage ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.listContainer}>
            {SUPPORTED_LANGUAGES.map((item) => {
              const isSelected = selectedLang === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  activeOpacity={0.8}
                  onPress={() => handleSelectLanguage(item.code)}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.name}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.leftRow}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <View style={styles.textColumn}>
                      <Text style={[styles.langNative, isSelected && styles.textSelected]}>
                        {item.nativeName}
                      </Text>
                      <Text style={styles.langEnglish}>{item.name}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkIcon}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <AppButton
            title="Done"
            onPress={() => router.back()}
            loading={saving}
            style={styles.doneBtn}
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
  heading: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  banner: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    ...typography.bodyBold,
    color: colors.success,
    textAlign: 'center',
  },
  loader: {
    marginVertical: spacing.xl,
  },
  listContainer: {
    marginVertical: spacing.sm,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 68,
    ...shadows.card,
  },
  langCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  textColumn: {},
  langNative: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  langEnglish: {
    ...typography.caption,
    marginTop: 2,
  },
  textSelected: {
    color: colors.primary,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    color: colors.textWhite,
    fontSize: 18,
    fontWeight: '800',
  },
  footer: {
    marginTop: spacing.xl,
  },
  doneBtn: {},
});
