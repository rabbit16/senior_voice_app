import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Lang, text} from '../../../shared/i18n/messages';
import {colors, touch, typography} from '../../../theme/tokens';

type Props = {
  lang: Lang;
  recording: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

export default function VoiceInputButton({
  lang,
  recording,
  disabled,
  onPressIn,
  onPressOut,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(lang, recording ? 'recording' : 'holdToSpeak')}
      accessibilityHint={text(lang, 'voiceHint')}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({pressed}) => [
        styles.touchArea,
        (pressed || recording) && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View style={[styles.button, recording && styles.recordingButton]}>
        <View style={styles.mic}>
          <View style={styles.micHead} />
          <View style={styles.micStem} />
          <View style={styles.micBase} />
        </View>
        <Text style={styles.label}>{text(lang, recording ? 'release' : 'holdToSpeak')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchArea: {borderRadius: touch.voiceButtonSize / 2},
  pressed: {opacity: 0.88},
  disabled: {opacity: 0.55},
  button: {
    width: touch.voiceButtonSize,
    height: touch.voiceButtonSize,
    borderRadius: touch.voiceButtonSize / 2,
    backgroundColor: colors.primary,
    borderWidth: Math.max(5, Math.round(touch.voiceButtonSize * 0.045)),
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  recordingButton: {backgroundColor: colors.danger, borderColor: colors.dangerSoft},
  mic: {
    width: Math.round(touch.voiceButtonSize * 0.26),
    height: Math.round(touch.voiceButtonSize * 0.33),
    alignItems: 'center',
  },
  micHead: {
    width: Math.round(touch.voiceButtonSize * 0.14),
    height: Math.round(touch.voiceButtonSize * 0.2),
    borderRadius: Math.round(touch.voiceButtonSize * 0.08),
    backgroundColor: colors.surface,
  },
  micStem: {
    width: Math.max(4, Math.round(touch.voiceButtonSize * 0.03)),
    height: Math.round(touch.voiceButtonSize * 0.07),
    backgroundColor: colors.surface,
  },
  micBase: {
    width: Math.round(touch.voiceButtonSize * 0.16),
    height: Math.max(4, Math.round(touch.voiceButtonSize * 0.03)),
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  label: {...typography.action, color: colors.surface, marginTop: 8},
});
