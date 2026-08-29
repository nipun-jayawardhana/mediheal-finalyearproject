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
import { useTheme } from '../context/ThemeContext';

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, setLanguage, t, isLoadingLanguage } = useLanguage();
  const { colors: themeColors } = useTheme();
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
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('chooseLanguage')}
        subtitle="තෝරන්න / தேர்ந்தெடுக்கவும்"
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={[styles.heading, { color: themeColors.textPrimary }]}>{t('chooseLanguage')}</Text>
        <Text style={[styles.subheading, { color: themeColors.textSecondary }]}>
          {t('languageSub')}
        </Text>

        {savedBanner ? (
          <View style={[styles.banner, { backgroundColor: themeColors.successLight, borderColor: themeColors.success }]}>
            <Text style={[styles.bannerText, { color: themeColors.success }]}>✓ {savedBanner}</Text>
          </View>
        ) : null}

        {isLoadingLanguage ? (
          <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
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
                    { backgroundColor: themeColors.card, borderColor: themeColors.border },
                    isSelected && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.name}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.leftRow}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <View style={styles.textColumn}>
                      <Text style={[styles.langNative, { color: themeColors.textPrimary }, isSelected && { color: themeColors.primary }]}>
                        {item.nativeName}
                      </Text>
                      <Text style={[styles.langEnglish, { color: themeColors.textSecondary }]}>{item.name}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: themeColors.primary }]}>
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
            title={t('done')}
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
