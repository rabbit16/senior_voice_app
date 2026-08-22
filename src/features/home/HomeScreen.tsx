import React, {useRef, useState} from 'react';
import * as ReactNative from 'react-native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {text} from '../../shared/i18n/messages';
import {
  askAudioStream,
  askTextStream,
  clearQaContext,
  sanitizeQaSpokenText,
  type QaAskDone,
  type QaAskHandlers,
  type QaPhase,
} from '../../services/qaApi';
import {ApiError} from '../../services/http';
import {getAccessToken} from '../../services/session';
import {ensureMicPermission, voiceRecorder} from '../../services/voiceRecorder';
import {moderateScale} from '../../theme/layout';
import {colors, radius, spacing, typography} from '../../theme/tokens';
import ResultCard from './components/ResultCard';
import VoiceInputButton from './components/VoiceInputButton';

type InputMode = 'voice' | 'text';

const quickQuestions = ['quickWeather', 'quickHealth', 'quickFamily'] as const;
const MIN_VOICE_MS = 600;

function isDemoToken(token: string | null): boolean {
  return !token || token.startsWith('demo-');
}

function mapVoiceError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : '';

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError'
  ) {
    return text('zh', 'voiceMicDenied');
  }
  if (name === 'InsecureContextError') {
    return text('zh', 'voiceNeedHttps');
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return text('zh', 'voiceNoMic');
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return text('zh', 'voiceMicBusy');
  }
  if (name === 'UnsupportedError' || name === 'NativeModuleMissing') {
    return message || text('zh', 'voiceRecordFailed');
  }
  return message || text('zh', 'voiceRecordFailed');
}

export default function HomeScreen() {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [micPreparing, setMicPreparing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [symptomText, setSymptomText] = useState('');
  const [contextId, setContextId] = useState<string | null>(null);
  const [forceNewContext, setForceNewContext] = useState(false);
  const [phase, setPhase] = useState<QaPhase | undefined>(undefined);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recordingRef = useRef(false);
  const holdingRef = useRef(false);
  const startingRef = useRef(false);

  async function requestAndroidMicPermission(): Promise<boolean> {
    const permissionsAndroid =
      'PermissionsAndroid' in ReactNative ? ReactNative.PermissionsAndroid : undefined;
    if (Platform.OS !== 'android' || !permissionsAndroid) {
      return true;
    }
    const permission = await permissionsAndroid.request(
      permissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: text('zh', 'permissionTitle'),
        message: text('zh', 'permissionMessage'),
        buttonPositive: text('zh', 'allow'),
        buttonNegative: text('zh', 'cancel'),
      },
    );
    return permission === permissionsAndroid.RESULTS.GRANTED;
  }

  async function prepareVoiceMode() {
    setError('');
    const token = getAccessToken();
    if (isDemoToken(token)) {
      setError(text('zh', 'askNeedLogin'));
      return false;
    }

    setMicPreparing(true);
    try {
      if (!(await requestAndroidMicPermission())) {
        setError(text('zh', 'voiceMicDenied'));
        return false;
      }
      await ensureMicPermission();
      return true;
    } catch (err) {
      setError(mapVoiceError(err));
      return false;
    } finally {
      setMicPreparing(false);
    }
  }

  function applyAskDone(final: QaAskDone, streamedSpoken: string) {
    setContextId(final.context_id);
    setForceNewContext(false);
    if (final.phase) {
      setPhase(final.phase);
    }
    setIntakeComplete(
      Boolean(final.intake_complete || final.phase === 'diagnosis' || final.phase === 'emergency'),
    );
    const spoken = sanitizeQaSpokenText(final.answer_text) || streamedSpoken;
    if (spoken) {
      setResult(spoken);
    }
    setSymptomText('');
  }

  function createAskHandlers(state: {
    streamed: {raw: string};
    fromVoice: boolean;
  }): QaAskHandlers {
    return {
      onMeta: meta => {
        setContextId(meta.context_id);
        setForceNewContext(false);
        if (state.fromVoice && meta.question_text) {
          setSymptomText(meta.question_text);
        }
      },
      onPhase: nextPhase => {
        setPhase(nextPhase);
        setIntakeComplete(nextPhase === 'diagnosis' || nextPhase === 'emergency');
      },
      onToken: delta => {
        state.streamed.raw += delta;
        const spoken = sanitizeQaSpokenText(state.streamed.raw);
        if (spoken) {
          setResult(spoken);
          setProcessing(false);
        }
      },
      onDone: final => {
        applyAskDone(final, sanitizeQaSpokenText(state.streamed.raw));
      },
    };
  }

  async function switchToVoiceMode() {
    setInputMode('voice');
    await prepareVoiceMode();
  }

  async function startRecording() {
    if (processing || recordingRef.current || startingRef.current || micPreparing) {
      return;
    }

    holdingRef.current = true;
    startingRef.current = true;

    const token = getAccessToken();
    if (isDemoToken(token)) {
      startingRef.current = false;
      setError(text('zh', 'askNeedLogin'));
      return;
    }

    setError('');
    setShowRecommendation(false);

    try {
      // 若尚未预授权，这里会弹出权限框；松手时 holdingRef=false，授权后自动取消避免卡死
      if (Platform.OS === 'android') {
        if (!(await requestAndroidMicPermission())) {
          setError(text('zh', 'voiceMicDenied'));
          return;
        }
      }
      await voiceRecorder.start();

      if (!holdingRef.current) {
        await voiceRecorder.cancel();
        setError(text('zh', 'voiceHoldHint'));
        return;
      }

      recordingRef.current = true;
      setRecording(true);
    } catch (err) {
      recordingRef.current = false;
      setRecording(false);
      if (holdingRef.current) {
        setError(mapVoiceError(err));
      }
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecording() {
    holdingRef.current = false;

    if (startingRef.current) {
      // start 还在走（常见于权限弹窗）；等 start 里检测到松手后自行 cancel
      return;
    }

    if (!recordingRef.current) {
      setRecording(false);
      return;
    }

    recordingRef.current = false;
    setRecording(false);

    let audio;
    try {
      audio = await voiceRecorder.stop();
    } catch (err) {
      setError(mapVoiceError(err));
      return;
    }

    if (audio.durationMs < MIN_VOICE_MS) {
      setError(text('zh', 'voiceTooShort'));
      return;
    }

    const token = getAccessToken();
    if (isDemoToken(token)) {
      setError(text('zh', 'askNeedLogin'));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setShowRecommendation(false);
    setProcessing(true);
    setResult('');

    const streamed = {raw: ''};
    try {
      const file =
        audio.blob ||
        ({
          uri: audio.uri!,
          type: audio.mimeType,
          name: audio.name,
        } as const);

      const done = await askAudioStream(
        token!,
        {
          file,
          fileName: audio.name,
          lang: 'zh',
          ...(forceNewContext ? {new_context: true} : {}),
          audio_format: audio.format,
        },
        createAskHandlers({streamed, fromVoice: true}),
        controller.signal,
      );
      applyAskDone(done, sanitizeQaSpokenText(streamed.raw));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'timeout' && controller.signal.aborted) {
        return;
      }
      setError(err instanceof ApiError ? err.message : text('zh', 'askFailed'));
      if (!sanitizeQaSpokenText(streamed.raw)) {
        setResult('');
      }
    } finally {
      setProcessing(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  async function submitSymptom() {
    const value = symptomText.trim();
    if (!value || processing) {
      return;
    }

    const token = getAccessToken();
    if (isDemoToken(token)) {
      setError(text('zh', 'askNeedLogin'));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setShowRecommendation(false);
    setProcessing(true);
    setResult('');

    const streamed = {raw: ''};
    try {
      const done = await askTextStream(
        token!,
        {
          question: value,
          lang: 'zh',
          ...(forceNewContext ? {new_context: true} : {}),
        },
        createAskHandlers({streamed, fromVoice: false}),
        controller.signal,
      );
      applyAskDone(done, sanitizeQaSpokenText(streamed.raw));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'timeout' && controller.signal.aborted) {
        return;
      }
      setError(err instanceof ApiError ? err.message : text('zh', 'askFailed'));
      if (!sanitizeQaSpokenText(streamed.raw)) {
        setResult('');
      }
    } finally {
      setProcessing(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function handleContinue() {
    setShowRecommendation(false);
    setError('');
    setForceNewContext(false);
    setInputMode('text');
  }

  async function handleNewQuestion() {
    setShowRecommendation(false);
    setResult('');
    setError('');
    setSymptomText('');
    setForceNewContext(true);
    setContextId(null);
    setPhase(undefined);
    setIntakeComplete(false);
    setInputMode('text');

    const token = getAccessToken();
    if (!isDemoToken(token)) {
      try {
        await clearQaContext(token!);
      } catch {
        // 本地已切到新问题即可
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundWarm} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{text('zh', 'welcome')}</Text>
        <Text style={styles.title}>{text('zh', 'title')}</Text>
        <Text style={styles.subtitle}>{text('zh', 'subtitle')}</Text>

        <View style={styles.quickList}>
          {quickQuestions.map((key, index) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => {
                setSymptomText(text('zh', key));
                setInputMode('text');
                setError('');
              }}
              style={[styles.quickChip, index === 1 && styles.quickChipGreen]}>
              <Text style={styles.quickText}>{text('zh', key)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputPanel}>
          <View style={styles.modeSwitch} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{selected: inputMode === 'voice'}}
              onPress={switchToVoiceMode}
              style={[styles.modeButton, inputMode === 'voice' && styles.modeActive]}>
              <Text style={[styles.modeText, inputMode === 'voice' && styles.modeActiveText]}>
                {text('zh', 'voiceMode')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{selected: inputMode === 'text'}}
              onPress={() => setInputMode('text')}
              style={[styles.modeButton, inputMode === 'text' && styles.modeActive]}>
              <Text style={[styles.modeText, inputMode === 'text' && styles.modeActiveText]}>
                {text('zh', 'textMode')}
              </Text>
            </Pressable>
          </View>

          {inputMode === 'voice' ? (
            <View style={styles.voiceArea}>
              <Text style={styles.panelText}>
                {micPreparing
                  ? text('zh', 'voicePreparing')
                  : text('zh', phase === 'followup' ? 'followupVoiceHint' : 'instruction')}
              </Text>
              <VoiceInputButton
                lang="zh"
                recording={recording}
                disabled={processing || micPreparing}
                onPressIn={startRecording}
                onPressOut={stopRecording}
              />
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.status, recording && styles.recordingStatus]}>
                {text('zh', recording ? 'recording' : 'holdHint')}
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                accessibilityLabel={text('zh', 'symptomInputTitle')}
                multiline
                value={symptomText}
                onChangeText={setSymptomText}
                placeholder={text(
                  'zh',
                  phase === 'followup' ? 'followupPlaceholder' : 'symptomInputPlaceholder',
                )}
                placeholderTextColor={colors.textMuted}
                style={styles.symptomInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text('zh', phase === 'followup' ? 'submitFollowup' : 'submitSymptom')}
                disabled={processing}
                onPress={submitSymptom}
                style={[styles.submitButton, processing && styles.disabledButton]}>
                {processing ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.submitText}>
                    {text('zh', phase === 'followup' ? 'submitFollowup' : 'submitSymptom')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        {error ? (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {processing && !result ? (
          <View style={styles.processing} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>
              {text('zh', phase === 'followup' ? 'processingFollowup' : 'processing')}
            </Text>
          </View>
        ) : result ? (
          <>
            <ResultCard key={contextId ?? 'qa-result'} lang="zh" content={result} phase={phase} />
            {phase === 'followup' ? (
              <Text style={styles.followupCue}>{text('zh', 'followupCue')}</Text>
            ) : null}
            {phase !== 'followup' && phase !== 'emergency' ? (
              <View style={styles.resultActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleContinue}
                  style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionText}>{text('zh', 'continueInquiry')}</Text>
                </Pressable>
                {phase === 'diagnosis' || intakeComplete || !phase ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowRecommendation(true)}
                    style={styles.primaryAction}>
                    <Text style={styles.primaryActionText}>{text('zh', 'medicalRecommend')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={handleNewQuestion}
              style={styles.newQuestionButton}>
              <Text style={styles.newQuestionText}>{text('zh', 'newQuestion')}</Text>
            </Pressable>
            {showRecommendation && phase !== 'followup' && phase !== 'emergency' ? (
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationTitle}>{text('zh', 'recommendationTitle')}</Text>
                <Text style={styles.recommendationBody}>{text('zh', 'recommendationBody')}</Text>
              </View>
            ) : null}
          </>
        ) : !processing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{text('zh', 'emptyTitle')}</Text>
            <Text style={styles.emptyText}>{text('zh', 'emptyText')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {paddingHorizontal: spacing.page, paddingTop: spacing.xl, paddingBottom: 34},
  eyebrow: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: moderateScale(24),
    lineHeight: moderateScale(32),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  quickList: {gap: spacing.sm, marginTop: spacing.lg},
  quickChip: {
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  quickChipGreen: {backgroundColor: colors.surfaceGreen},
  quickText: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    color: colors.textPrimary,
  },
  inputPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  modeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeActive: {backgroundColor: colors.primary},
  modeText: {...typography.bodyStrong, color: colors.primaryDark, fontSize: moderateScale(16)},
  modeActiveText: {color: colors.surface},
  panelText: {
    ...typography.bodyLarge,
    color: colors.blueTextSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: moderateScale(16),
  },
  symptomInput: {
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundWarm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  submitButton: {
    minHeight: 50,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {...typography.action, color: colors.surface, fontSize: moderateScale(18)},
  disabledButton: {opacity: 0.7},
  voiceArea: {alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm},
  status: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: moderateScale(17),
  },
  recordingStatus: {color: colors.dangerText},
  errorText: {
    marginTop: spacing.md,
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
    color: colors.dangerText,
    textAlign: 'center',
  },
  processing: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  processingText: {fontSize: moderateScale(17), color: colors.textSecondary, marginTop: spacing.md},
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    fontSize: moderateScale(19),
    lineHeight: moderateScale(28),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {...typography.bodyLarge, color: colors.textSecondary, marginTop: 6, fontSize: moderateScale(16)},
  followupCue: {
    marginTop: spacing.sm,
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resultActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md},
  secondaryAction: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  secondaryActionText: {
    ...typography.bodyStrong,
    color: colors.success,
    textAlign: 'center',
    fontSize: moderateScale(17),
  },
  primaryAction: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  primaryActionText: {
    ...typography.bodyStrong,
    color: colors.surface,
    textAlign: 'center',
    fontSize: moderateScale(17),
  },
  newQuestionButton: {
    minHeight: 44,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newQuestionText: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
    fontWeight: '700',
    color: colors.primaryDark,
  },
  recommendationCard: {
    backgroundColor: colors.surfacePurple,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  recommendationTitle: {...typography.cardTitle, color: colors.textPrimary, fontSize: moderateScale(20)},
  recommendationBody: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: moderateScale(16),
  },
});
