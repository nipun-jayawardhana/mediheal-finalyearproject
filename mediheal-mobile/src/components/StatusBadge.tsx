import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';

export type StatusType =
  | 'active'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'resolved'
  | 'high'
  | 'medium'
  | 'low';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  style,
}) => {
  const normStatus = String(status).toLowerCase().trim();

  const getColors = () => {
    switch (normStatus) {
      case 'active':
      case 'confirmed':
      case 'completed':
      case 'low':
        return { bg: colors.successLight, text: colors.success };
      case 'pending':
      case 'medium':
        return { bg: colors.warningLight, text: colors.warning };
      case 'high':
      case 'cancelled':
      case 'emergency':
        return { bg: colors.dangerLight, text: colors.danger };
      case 'resolved':
      default:
        return { bg: colors.primaryLight, text: colors.primary };
    }
  };

  const badgeColors = getColors();
  const displayLabel = label || normStatus.toUpperCase();

  return (
    <View style={[styles.badge, { backgroundColor: badgeColors.bg }, style]}>
      <Text style={[styles.text, { color: badgeColors.text }]}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs - 1,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
