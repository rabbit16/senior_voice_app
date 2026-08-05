import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radius, spacing, touch, typography} from '../../theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
};

/** 全局返回按钮：左侧 ⬅️ + 文案 */
export default function BackButton({label, onPress}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.arrowBox}>
        <Text style={styles.arrow}>⬅️</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: {opacity: 0.85},
  arrowBox: {
    minWidth: touch.minimum,
    minHeight: touch.minimum,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 20,
    lineHeight: 24,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
