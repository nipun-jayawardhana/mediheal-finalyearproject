import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { linkPatient } from '../../services/caregiverService';

export default function LinkPatientScreen() {
  const router = useRouter();

  const [linkCode, setLinkCode] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('Family Caregiver');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleLink = async () => {
    const cleanCode = linkCode.trim().toUpperCase();
    const cleanRel = relationship.trim();

    if (!cleanCode) {
      Alert.alert('Validation Error', 'Please enter a valid caregiver link code.');
      return;
    }

    if (!cleanRel) {
      Alert.alert('Validation Error', 'Please specify your relationship to the patient.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await linkPatient({
        caregiverLinkCode: cleanCode,
        relationship: cleanRel,
      });

      if (res && res.success) {
        Alert.alert(
          'Patient Linked Successfully',
          `You are now linked to ${res.data?.patient?.fullName || 'the patient'}. You can now view care plans and emergency alerts.`
        );
        router.replace('/(caregiver)' as any);
      } else {
        Alert.alert('Link Error', res.message || 'Unable to link patient.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to process patient link.';
      if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('invalid')) {
        Alert.alert(
          'Invalid Link Code',
          'We couldn\'t find a patient with this link code. Please verify the code from the patient\'s profile screen.'
        );
      } else if (errMsg.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Already Linked',
          'An active caregiver link already exists for this patient.'
        );
      } else {
        Alert.alert('Linking Failed', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Link Patient"
        subtitle="Connect Care Recipient"
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🤝</Text>
          <Text style={styles.infoTitle}>Caregiver Linking</Text>
          <Text style={styles.infoText}>
            Ask the patient or elder for their 6-character MediHeal Link Code found on their Patient Profile (e.g. MH-8573).
          </Text>
        </View>

        {/* Link Code Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Caregiver Link Code *</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="e.g. MH-8573"
            placeholderTextColor={colors.textMuted}
            value={linkCode}
            onChangeText={(val) => setLinkCode(val.toUpperCase())}
            autoCapitalize="characters"
            maxLength={10}
          />
        </View>

        {/* Relationship Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Relationship to Patient *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Son, Daughter, Spouse, Relative"
            placeholderTextColor={colors.textMuted}
            value={relationship}
            onChangeText={setRelationship}
          />
        </View>

        {/* Submit Action */}
        <AppButton
          title={submitting ? 'Linking Patient...' : 'Link Patient'}
          onPress={handleLink}
          variant="primary"
          disabled={submitting}
          style={styles.submitBtn}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  infoIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  infoTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  infoText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  codeInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    ...typography.header,
    fontSize: 20,
    color: colors.primaryDark,
    letterSpacing: 2,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  submitBtn: {
    minHeight: 50,
    marginTop: spacing.md,
  },
});
