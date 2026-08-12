export const colors = {
  // Brand Colors
  primary: '#1060C8',
  primaryDark: '#0C4896',
  primaryLight: '#E8F1FD',
  accent: '#208AEF',

  // Backgrounds
  background: '#F4F7FC',
  card: '#FFFFFF',
  surface: '#FFFFFF',

  // Status Colors
  success: '#107C41',
  successLight: '#E6F4EA',
  danger: '#D93025',
  dangerLight: '#FCE8E6',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#0284C7',
  infoLight: '#E0F2FE',

  // Neutral & Typography Colors
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Elderly SOS Accent
  emergencyRed: '#DC2626',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
};

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  header: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  subheader: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  },
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: '#1060C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
};

export const layout = {
  minTouchTarget: 48,
  buttonHeight: 52,
  inputHeight: 52,
};
