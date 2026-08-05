import {Dimensions, Platform} from 'react-native';

const window = Dimensions.get('window');

/** 设计稿参考宽度（常见真机逻辑宽） */
const BASE_WIDTH = 390;
/** 设计稿参考高度 */
const BASE_HEIGHT = 844;

export const screen = {
  width: window.width,
  height: window.height,
  /** 雷电 720x1280 @ DPI320 ≈ 360dp，属于偏窄屏 */
  isNarrow: window.width < 380,
  isShort: window.height < 700,
  isWeb: Platform.OS === 'web',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 按屏宽缩放，限制幅度避免过大过小 */
export function scale(size: number): number {
  const ratio = clamp(screen.width / BASE_WIDTH, 0.82, 1.12);
  return Math.round(size * ratio);
}

/** 按屏高缩放（用于上下留白、大按钮） */
export function vScale(size: number): number {
  const ratio = clamp(screen.height / BASE_HEIGHT, 0.78, 1.08);
  return Math.round(size * ratio);
}

/** 温和缩放：字号更适合用这个，变化更小 */
export function moderateScale(size: number, factor = 0.4): number {
  return Math.round(size + (scale(size) - size) * factor);
}
