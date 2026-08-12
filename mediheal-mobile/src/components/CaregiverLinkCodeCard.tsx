import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

interface CaregiverLinkCodeCardProps {
  code: string;
  title?: string;
  showHelpText?: boolean;
  variant?: 'card' | 'standalone';
}

export const CaregiverLinkCodeCard: React.FC<CaregiverLinkCodeCardProps> = ({
  code,
  title = 'YOUR PATIENT LINKING CODE',
  showHelpText = true,
  variant = 'card',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  return (
    <View style={[styles.container, variant === 'card' && styles.cardContainer]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{code || '-------'}</Text>

        <TouchableOpacity
          style={[styles.copyButton, copied && styles.copyButtonDone]}
          onPress={handleCopy}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy linking code"
        >
          <Text style={[styles.copyButtonText, copied && styles.copyButtonTextDone]}>
            {copied ? '✓ Copied' : '📋 Copy Code'}
          </Text>
        </TouchableOpacity>
      </View>

      {showHelpText && (
        <Text style={styles.helpText}>
          Share this code only with a trusted caregiver you want to connect to your MediHeal account.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    marginVertical: spacing.xs,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 3,
    fontFamily: 'Platform',
    textAlign: 'center',
  },
  copyButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButtonDone: {
    backgroundColor: colors.primaryLight,
  },
  copyButtonText: {
    color: colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  copyButtonTextDone: {
    color: colors.primary,
  },
  helpText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
