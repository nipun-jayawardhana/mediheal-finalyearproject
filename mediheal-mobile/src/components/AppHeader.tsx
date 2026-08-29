import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBackPress,
  rightComponent,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {onBackPress && (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onBackPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.backArrow, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightComponent && <View style={styles.rightContainer}>{rightComponent}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'transparent',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    ...typography.header,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: spacing.sm,
  },
});
