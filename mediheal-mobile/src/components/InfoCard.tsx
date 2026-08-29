import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface InfoCardProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  badge?: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  subtitle,
  children,
  style,
  badge,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {badge}
      </View>
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  title: {
    ...typography.subheader,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 4,
  },
  content: {
    marginTop: spacing.md,
  },
});
