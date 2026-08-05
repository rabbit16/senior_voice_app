import {moderateScale, scale, screen, vScale} from './layout';

export const colors = {
  backgroundWarm: '#F0F9FF',
  backgroundCream: '#FFF8EA',
  surface: '#FFFFFF',
  surfaceBlue: '#E6F4FF',
  surfaceGreen: '#E8F7EF',
  surfaceAmber: '#FFF2D6',
  surfacePurple: '#F0E8FF',
  surfaceOrange: '#FFF0E6',
  primary: '#0C66A3',
  primaryDark: '#0B4F7F',
  primarySoft: '#CDEBFF',
  accent: '#067A55',
  accentSoft: '#D9F4E7',
  textPrimary: '#102033',
  textSecondary: '#355065',
  textMuted: '#607184',
  blueText: '#0B4F7F',
  blueTextSecondary: '#1E5D87',
  blueBorder: '#A7D8F5',
  borderNeutral: '#D2E4EF',
  success: '#285B28',
  successBorder: '#78A66A',
  danger: '#B8322C',
  dangerText: '#A52520',
  dangerSoft: '#F5D4D1',
  purpleBorder: '#CDB8F4',
  orangeBorder: '#F0B88A',
} as const;

const pagePad = screen.isNarrow ? scale(14) : scale(20);

export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
  xxxl: scale(32),
  page: pagePad,
};

export const radius = {
  sm: scale(11),
  md: scale(16),
  lg: scale(22),
  xl: scale(28),
  circle: 999,
};

export const typography = {
  eyebrow: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    fontWeight: '600' as const,
  },
  title: {
    fontSize: moderateScale(screen.isNarrow ? 26 : 31),
    lineHeight: moderateScale(screen.isNarrow ? 34 : 39),
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: moderateScale(18),
    lineHeight: moderateScale(28),
    fontWeight: '500' as const,
  },
  cardTitle: {
    fontSize: moderateScale(21),
    lineHeight: moderateScale(30),
    fontWeight: '700' as const,
  },
  bodyLarge: {
    fontSize: moderateScale(17),
    lineHeight: moderateScale(26),
    fontWeight: '400' as const,
  },
  bodyStrong: {
    fontSize: moderateScale(18),
    lineHeight: moderateScale(28),
    fontWeight: '700' as const,
  },
  label: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '700' as const,
  },
  action: {
    fontSize: moderateScale(19),
    lineHeight: moderateScale(26),
    fontWeight: '700' as const,
  },
};

const voiceSize = Math.min(vScale(176), Math.round(screen.width * 0.42));

export const touch = {
  minimum: Math.max(44, scale(48)),
  voiceButtonSize: Math.max(140, voiceSize),
  tabHeight: Math.max(56, vScale(68)),
};
