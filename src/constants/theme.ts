const palette = {
  ground: '#F1F0E9',
  surface: '#FFFFFF',
  ink: '#141414',
  inkMuted: '#4A4A45',
  line: '#141414',
  signYellow: '#FFC72C',
  onYellow: '#141414',
  signRed: '#C8102E',
  onRed: '#FFFFFF',
  signGreen: '#00753A',
  onGreen: '#FFFFFF',
  signBlue: '#0050A0',
  onBlue: '#FFFFFF',
  passedGround: '#ECECE6',
  passedInk: '#5C5C56',
};

export const colors = {
  ...palette,

  // Legacy aliases kept so existing imports keep compiling.
  background: palette.ground,
  text: palette.ink,
  muted: palette.inkMuted,
  border: palette.line,
  primary: palette.ink,
  danger: palette.signRed,
  success: palette.signGreen,
  warning: palette.signYellow,
  marker: palette.ink,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

const radii = {
  sign: 4,
  control: 4,
  pill: 999,
};

export const radius = {
  ...radii,

  // Legacy aliases kept so existing imports keep compiling.
  sm: radii.control,
  md: radii.control,
  lg: radii.control,
};

const typeScale = {
  label: 13,
  body: 16,
  title: 20,
  headline: 28,
  display: 40,
  eta: 64,
};

export const font = {
  ...typeScale,

  // Legacy aliases kept so existing imports keep compiling.
  sm: typeScale.label,
  md: typeScale.body,
  lg: typeScale.title,
  xl: typeScale.headline,
  xxl: typeScale.display,
};

export const fontFamily = {
  display: 'Anton_400Regular',
};
