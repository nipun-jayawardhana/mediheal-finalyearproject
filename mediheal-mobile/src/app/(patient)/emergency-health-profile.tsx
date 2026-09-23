import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { InfoCard } from '../../components/InfoCard';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getMyEmergencyProfileApi,
  updateMyEmergencyProfileApi,
} from '../../services/emergencyProfileService';
import {
  EmergencyHealthProfileData,
  EmergencyBloodGroup,
} from '../../types/emergencyProfile';

const BLOOD_GROUPS: EmergencyBloodGroup[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'
];

export default function EmergencyHealthProfileScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();

  // Profile data & UI state
  const [profile, setProfile] = useState<EmergencyHealthProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Edit form state
  const [bloodGroup, setBloodGroup] = useState<EmergencyBloodGroup>('Unknown');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [hasNoKnownAllergies, setHasNoKnownAllergies] = useState<boolean>(false);
  const [newAllergyInput, setNewAllergyInput] = useState<string>('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactRelationship, setContactRelationship] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [emergencyNotes, setEmergencyNotes] = useState<string>('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getMyEmergencyProfileApi();
      if (res && res.success && res.data) {
        setProfile(res.data);
        // Pre-populate edit form
        setBloodGroup(res.data.bloodGroup || 'Unknown');
        setAllergies(res.data.allergies || []);
        setHasNoKnownAllergies(res.data.hasNoKnownAllergies || false);
        setChronicConditions(res.data.chronicConditions || []);
        setContactName(res.data.emergencyContact?.name || '');
        setContactRelationship(res.data.emergencyContact?.relationship || '');
        setContactPhone(res.data.emergencyContact?.phone || '');
        setEmergencyNotes(res.data.emergencyNotes || '');
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load emergency health profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handlers for Allergy management in edit mode
  const handleAddAllergy = () => {
    const trimmed = newAllergyInput.trim();
    if (!trimmed) return;
    if (!allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      setHasNoKnownAllergies(false);
    }
    setNewAllergyInput('');
  };

  const handleRemoveAllergy = (item: string) => {
    setAllergies(allergies.filter((a) => a !== item));
  };

  const handleToggleNoKnownAllergies = () => {
    if (!hasNoKnownAllergies) {
      setHasNoKnownAllergies(true);
      setAllergies([]);
    } else {
      setHasNoKnownAllergies(false);
    }
  };

  // Handlers for Chronic Conditions in edit mode
  const handleAddCondition = () => {
    const trimmed = newConditionInput.trim();
    if (!trimmed) return;
    if (!chronicConditions.includes(trimmed)) {
      setChronicConditions([...chronicConditions, trimmed]);
    }
    setNewConditionInput('');
  };

  const handleRemoveCondition = (item: string) => {
    setChronicConditions(chronicConditions.filter((c) => c !== item));
  };

  // Save emergency profile
  const handleSaveProfile = async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const payloadAllergies = hasNoKnownAllergies
        ? ['No known allergies']
        : allergies;

      const res = await updateMyEmergencyProfileApi({
        bloodGroup,
        allergies: payloadAllergies,
        hasNoKnownAllergies,
        chronicConditions,
        emergencyContact: {
          name: contactName.trim(),
          relationship: contactRelationship.trim(),
          phone: contactPhone.trim(),
        },
        emergencyNotes: emergencyNotes.trim(),
      });

      if (res && res.success && res.data) {
        setProfile(res.data);
        setIsEditing(false);
      } else {
        setErrorMsg('Failed to save emergency profile.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save emergency profile.');
    } finally {
      setSaving(false);
    }
  };

  // Place phone call to emergency contact
  const handleCallEmergencyContact = () => {
    const phone = profile?.emergencyContact?.phone?.trim();
    const name = profile?.emergencyContact?.name?.trim() || t('emergencyContact');

    if (!phone) {
      if (Platform.OS === 'web') {
        window.alert(t('noPhoneNumberForContact'));
      } else {
        Alert.alert(t('emergencyContact'), t('noPhoneNumberForContact'));
      }
      return;
    }

    const confirmMsg = t('callEmergencyContactConfirm')
      .replace('{name}', name)
      .replace('{phone}', phone);

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMsg);
      if (confirmed) {
        Linking.openURL(`tel:${phone}`);
      }
      return;
    }

    Alert.alert(t('callEmergencyContact'), confirmMsg, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('call'),
        style: 'default',
        onPress: () => {
          Linking.openURL(`tel:${phone}`);
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingView message="Loading emergency health profile..." />;
  }

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('emergencyHealthProfile')}
        subtitle={t('emergencyHealthProfileSub')}
        onBackPress={() => {
          if (isEditing && profile) {
            setIsEditing(false);
          } else {
            router.back();
          }
        }}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchProfile} />
        ) : null}

        {/* 1. Empty State (When no profile exists yet) */}
        {!profile && !isEditing ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
              <Text style={styles.emptyIconText}>🚨</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.danger }]}>
              {t('emergencyProfileNotCompleted')}
            </Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
              {t('emergencyProfileNotCompletedSub')}
            </Text>
            <AppButton
              title={t('completeEmergencyProfile')}
              onPress={() => setIsEditing(true)}
              variant="danger"
              style={styles.completeBtn}
            />
          </View>
        ) : isEditing ? (
          /* =======================================================
             2. EDIT MODE
             ======================================================= */
          <View style={styles.editSection}>
            <Text style={[styles.editModeHeading, { color: themeColors.textPrimary }]}>
              {profile ? t('editEmergencyProfile') : t('completeEmergencyProfile')}
            </Text>

            {/* Blood Group Selector */}
            <InfoCard title={t('bloodGroup')} subtitle={t('selectBloodGroup')}>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <TouchableOpacity
                      key={bg}
                      style={[
                        styles.bloodChip,
                        {
                          backgroundColor: isSelected
                            ? themeColors.danger
                            : themeColors.card,
                          borderColor: isSelected
                            ? themeColors.danger
                            : themeColors.border,
                        },
                      ]}
                      onPress={() => setBloodGroup(bg)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Blood group ${bg}`}
                    >
                      <Text
                        style={[
                          styles.bloodChipText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : themeColors.textPrimary,
                          },
                        ]}
                      >
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </InfoCard>

            {/* Allergies Editor */}
            <InfoCard title={t('allergies')} subtitle="Record substances or medications patient is allergic to">
              {/* Quick toggle for No Known Allergies */}
              <TouchableOpacity
                style={[
                  styles.toggleRow,
                  {
                    backgroundColor: hasNoKnownAllergies
                      ? isDark
                        ? 'rgba(34, 197, 94, 0.2)'
                        : '#DCFCE7'
                      : themeColors.background,
                    borderColor: hasNoKnownAllergies
                      ? themeColors.success
                      : themeColors.border,
                  },
                ]}
                onPress={handleToggleNoKnownAllergies}
                activeOpacity={0.8}
              >
                <Text style={styles.toggleIcon}>{hasNoKnownAllergies ? '✅' : '⚪'}</Text>
                <Text
                  style={[
                    styles.toggleLabel,
                    {
                      color: hasNoKnownAllergies
                        ? themeColors.success
                        : themeColors.textPrimary,
                      fontWeight: hasNoKnownAllergies ? '700' : '500',
                    },
                  ]}
                >
                  {t('noKnownAllergies')}
                </Text>
              </TouchableOpacity>

              {!hasNoKnownAllergies && (
                <>
                  <View style={styles.tagWrap}>
                    {allergies.map((alg) => (
                      <View
                        key={alg}
                        style={[
                          styles.tagItem,
                          {
                            backgroundColor: isDark
                              ? 'rgba(239, 68, 68, 0.25)'
                              : '#FEE2E2',
                            borderColor: themeColors.danger,
                          },
                        ]}
                      >
                        <Text style={[styles.tagItemText, { color: themeColors.danger }]}>
                          ⚠️ {alg}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveAllergy(alg)}
                          style={styles.tagRemoveBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.tagRemoveText, { color: themeColors.danger }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <View style={styles.addTagInputRow}>
                    <TextInput
                      style={[
                        styles.tagInput,
                        {
                          backgroundColor: themeColors.card,
                          borderColor: themeColors.border,
                          color: themeColors.textPrimary,
                        },
                      ]}
                      placeholder={t('enterAllergyName')}
                      placeholderTextColor={themeColors.textMuted}
                      value={newAllergyInput}
                      onChangeText={setNewAllergyInput}
                      onSubmitEditing={handleAddAllergy}
                    />
                    <TouchableOpacity
                      style={[styles.addTagBtn, { backgroundColor: themeColors.danger }]}
                      onPress={handleAddAllergy}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addTagBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </InfoCard>

            {/* Chronic Conditions Editor */}
            <InfoCard title={t('chronicConditions')} subtitle="Record pre-existing long-term medical conditions">
              <View style={styles.tagWrap}>
                {chronicConditions.map((cond) => (
                  <View
                    key={cond}
                    style={[
                      styles.tagItem,
                      {
                        backgroundColor: isDark
                          ? 'rgba(59, 130, 246, 0.2)'
                          : '#DBEAFE',
                        borderColor: themeColors.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.tagItemText, { color: themeColors.primary }]}>
                      🩺 {cond}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveCondition(cond)}
                      style={styles.tagRemoveBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.tagRemoveText, { color: themeColors.primary }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.addTagInputRow}>
                <TextInput
                  style={[
                    styles.tagInput,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder={t('enterConditionName')}
                  placeholderTextColor={themeColors.textMuted}
                  value={newConditionInput}
                  onChangeText={setNewConditionInput}
                  onSubmitEditing={handleAddCondition}
                />
                <TouchableOpacity
                  style={[styles.addTagBtn, { backgroundColor: themeColors.primary }]}
                  onPress={handleAddCondition}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addTagBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </InfoCard>

            {/* Emergency Contact Editor */}
            <InfoCard title={t('emergencyContact')} subtitle="Primary person to contact in medical crisis">
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {t('emergencyContactName')}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
                placeholder="e.g. Nimal Perera"
                placeholderTextColor={themeColors.textMuted}
                value={contactName}
                onChangeText={setContactName}
              />

              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {t('relationship')}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
                placeholder="e.g. Father, Spouse, Sibling"
                placeholderTextColor={themeColors.textMuted}
                value={contactRelationship}
                onChangeText={setContactRelationship}
              />

              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {t('emergencyContactPhone')}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
                placeholder="e.g. 0771234567"
                placeholderTextColor={themeColors.textMuted}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </InfoCard>

            {/* Emergency Notes Editor */}
            <InfoCard title={t('emergencyNotes')} subtitle="Special instructions for emergency responders">
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
                placeholder="e.g. Carries EpiPen in backpack, diabetic insulin alert, pacemaker fitted"
                placeholderTextColor={themeColors.textMuted}
                value={emergencyNotes}
                onChangeText={setEmergencyNotes}
                multiline
                numberOfLines={4}
              />
            </InfoCard>

            {/* Save & Cancel Buttons */}
            <View style={styles.editActionRow}>
              {profile ? (
                <AppButton
                  title={t('cancel')}
                  onPress={() => setIsEditing(false)}
                  variant="outline"
                  style={styles.cancelBtn}
                  disabled={saving}
                />
              ) : null}
              <AppButton
                title={saving ? t('savingEmergencyProfile') : t('saveEmergencyProfile')}
                onPress={handleSaveProfile}
                variant="danger"
                style={{ flex: 1 }}
                disabled={saving}
              />
            </View>
          </View>
        ) : (
          /* =======================================================
             3. VIEW MODE
             ======================================================= */
          profile && (
            <View style={styles.viewSection}>
              {/* Emergency Hero Banner */}
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                    borderColor: themeColors.danger,
                  },
                ]}
              >
                <View style={styles.heroRow}>
                  <View style={[styles.heroIconBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2' }]}>
                    <Text style={styles.heroIcon}>🚨</Text>
                  </View>
                  <View style={styles.heroTextCol}>
                    <Text style={[styles.heroTitle, { color: themeColors.danger }]}>
                      {t('emergencyIdCard')}
                    </Text>
                    <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
                      {t('emergencyRespondersNotice')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Personal Details & Blood Group */}
              <InfoCard
                title={t('personalDetails')}
                badge={
                  <View style={[styles.bloodGroupBadge, { backgroundColor: themeColors.danger }]}>
                    <Text style={styles.bloodGroupBadgeText}>{profile.bloodGroup}</Text>
                  </View>
                }
              >
                <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('fullName')}</Text>
                  <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{profile.patient.fullName}</Text>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('bloodGroup')}</Text>
                  <Text style={[styles.bloodGroupValue, { color: themeColors.danger }]}>{profile.bloodGroup}</Text>
                </View>

                {profile.patient.dateOfBirth ? (
                  <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('dateOfBirth')}</Text>
                    <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                      {new Date(profile.patient.dateOfBirth).toISOString().split('T')[0]}
                    </Text>
                  </View>
                ) : null}

                {profile.patient.gender ? (
                  <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('gender')}</Text>
                    <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                      {profile.patient.gender.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </InfoCard>

              {/* Allergies Card */}
              <InfoCard title={t('allergies')} subtitle="Known adverse drug or substance reactions">
                {profile.hasNoKnownAllergies || (profile.allergies.length === 1 && profile.allergies[0].toLowerCase() === 'no known allergies') ? (
                  <View
                    style={[
                      styles.safePill,
                      {
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7',
                        borderColor: themeColors.success,
                      },
                    ]}
                  >
                    <Text style={[styles.safePillText, { color: themeColors.success }]}>
                      ✅ {t('noKnownAllergies')}
                    </Text>
                  </View>
                ) : profile.allergies && profile.allergies.length > 0 ? (
                  <View style={styles.tagWrap}>
                    {profile.allergies.map((alg, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.allergyBadge,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                            borderColor: themeColors.danger,
                          },
                        ]}
                      >
                        <Text style={[styles.allergyBadgeText, { color: themeColors.danger }]}>
                          ⚠️ {alg}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyMutedText, { color: themeColors.textMuted }]}>
                    {t('noAllergyInformation')}
                  </Text>
                )}
              </InfoCard>

              {/* Chronic Conditions Card */}
              <InfoCard title={t('chronicConditions')} subtitle="Pre-existing diagnoses and chronic illnesses">
                {profile.chronicConditions && profile.chronicConditions.length > 0 ? (
                  <View style={styles.tagWrap}>
                    {profile.chronicConditions.map((cond, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.conditionBadge,
                          {
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
                            borderColor: themeColors.primary,
                          },
                        ]}
                      >
                        <Text style={[styles.conditionBadgeText, { color: themeColors.primary }]}>
                          🩺 {cond}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyMutedText, { color: themeColors.textMuted }]}>
                    {t('noChronicConditions')}
                  </Text>
                )}
              </InfoCard>

              {/* Current Medications (Derived & Auto-Synced) */}
              <InfoCard
                title={t('currentMedications')}
                subtitle={t('autoSyncedMedications')}
              >
                {profile.currentMedications && profile.currentMedications.length > 0 ? (
                  <View style={styles.medsList}>
                    {profile.currentMedications.map((med, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.medRowCard,
                          {
                            backgroundColor: themeColors.background,
                            borderColor: themeColors.border,
                          },
                        ]}
                      >
                        <Text style={styles.medPillIcon}>💊</Text>
                        <View style={styles.medCol}>
                          <Text style={[styles.medName, { color: themeColors.textPrimary }]}>
                            {med.medicineName} {med.dosage}
                          </Text>
                          <Text style={[styles.medFreq, { color: themeColors.primary }]}>
                            {med.frequency}
                          </Text>
                          {med.instructions ? (
                            <Text style={[styles.medInstr, { color: themeColors.textSecondary }]}>
                              {med.instructions}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyMutedText, { color: themeColors.textMuted }]}>
                    {t('noActiveMedications')}
                  </Text>
                )}
              </InfoCard>

              {/* Emergency Contact Card */}
              <InfoCard title={t('emergencyContact')} subtitle="Primary next-of-kin or designated responder">
                <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('emergencyContactName')}</Text>
                  <Text style={[styles.detailValue, { color: themeColors.textPrimary, fontWeight: '700' }]}>
                    {profile.emergencyContact?.name || 'N/A'}
                  </Text>
                </View>

                {profile.emergencyContact?.relationship ? (
                  <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('relationship')}</Text>
                    <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                      {profile.emergencyContact.relationship}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('emergencyContactPhone')}</Text>
                  <Text style={[styles.phoneValue, { color: themeColors.primary }]}>
                    {profile.emergencyContact?.phone || 'N/A'}
                  </Text>
                </View>

                {/* Big Accessible Call Button */}
                <TouchableOpacity
                  style={[
                    styles.callButton,
                    {
                      backgroundColor: profile.emergencyContact?.phone
                        ? themeColors.danger
                        : themeColors.border,
                    },
                  ]}
                  onPress={handleCallEmergencyContact}
                  activeOpacity={0.8}
                  disabled={!profile.emergencyContact?.phone}
                  accessibilityRole="button"
                  accessibilityLabel={t('callEmergencyContact')}
                >
                  <Text style={styles.callButtonIcon}>📞</Text>
                  <Text style={styles.callButtonText}>{t('callEmergencyContact')}</Text>
                </TouchableOpacity>
              </InfoCard>

              {/* Emergency Notes Card */}
              {profile.emergencyNotes ? (
                <InfoCard title={t('emergencyNotes')} subtitle="Special instructions for emergency care">
                  <View
                    style={[
                      styles.notesBox,
                      {
                        backgroundColor: themeColors.background,
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.notesText, { color: themeColors.textPrimary }]}>
                      {profile.emergencyNotes}
                    </Text>
                  </View>
                </InfoCard>
              ) : null}

              {/* Edit Profile Button */}
              <AppButton
                title={t('editEmergencyProfile')}
                onPress={() => setIsEditing(true)}
                variant="outline"
                style={styles.editBtn}
              />
            </View>
          )
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Empty State Styles
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    ...shadows.card,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    ...typography.subheader,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySub: {
    ...typography.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  completeBtn: {
    minWidth: 220,
  },
  // View Section Styles
  viewSection: {
    gap: spacing.md,
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    ...shadows.card,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: 24,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    ...typography.subheader,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroSub: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  bloodGroupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  bloodGroupBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    ...typography.body,
    fontSize: 14,
  },
  detailValue: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
  },
  bloodGroupValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  phoneValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  safePill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  safePillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  allergyBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  allergyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  conditionBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  conditionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyMutedText: {
    ...typography.body,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  medsList: {
    gap: spacing.xs,
  },
  medRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  medPillIcon: {
    fontSize: 24,
  },
  medCol: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
  },
  medFreq: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  medInstr: {
    fontSize: 12,
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
    minHeight: 48,
  },
  callButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  notesBox: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  notesText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  editBtn: {
    marginTop: spacing.sm,
  },
  // Edit Section Styles
  editSection: {
    gap: spacing.md,
  },
  editModeHeading: {
    ...typography.subheader,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bloodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minWidth: 54,
    alignItems: 'center',
  },
  bloodChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toggleIcon: {
    fontSize: 16,
  },
  toggleLabel: {
    fontSize: 14,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    gap: 6,
  },
  tagItemText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagRemoveBtn: {
    padding: 2,
  },
  tagRemoveText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addTagInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tagInput: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
  },
  addTagBtn: {
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  inputLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  formInput: {
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 90,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  editActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
});
