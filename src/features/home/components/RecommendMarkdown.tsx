import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {moderateScale} from '../../../theme/layout';
import {colors, spacing, typography} from '../../../theme/tokens';

type Span = {
  text: string;
  bold?: boolean;
  danger?: boolean;
};

type Block =
  | {kind: 'heading'; spans: Span[]; danger?: boolean}
  | {kind: 'paragraph'; spans: Span[]}
  | {kind: 'list'; ordered: boolean; index: number; spans: Span[]};

const DANGER_RE = /急诊|120|立刻|立即|危险|冷汗|喘不上气|意识不清/;

function isDanger(text: string): boolean {
  return DANGER_RE.test(text);
}

/** 去掉检索角标、链接，保留给老人看的句子 */
export function prepareRecommendMarkdown(raw: string): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\[\d+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSpans(line: string): Span[] {
  const spans: Span[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(line);
  while (match) {
    if (match.index > last) {
      spans.push({text: line.slice(last, match.index)});
    }
    const boldText = match[1] || match[2] || '';
    spans.push({text: boldText, bold: true, danger: isDanger(boldText)});
    last = match.index + match[0].length;
    match = pattern.exec(line);
  }
  const rest = line.slice(last);
  if (rest) {
    const dangling = rest.match(/^\*\*([^*]*)\*?$/);
    if (dangling) {
      spans.push({text: dangling[1], bold: true, danger: isDanger(dangling[1])});
    } else {
      spans.push({text: rest, danger: isDanger(rest)});
    }
  }
  return spans.filter(span => span.text);
}

function looksLikeHeading(spans: Span[], source: string): boolean {
  const plain = spans.map(span => span.text).join('').trim();
  if (plain.length <= 18 && spans.some(span => span.bold)) {
    return true;
  }
  return /紧急程度|建议科室|去哪看|医院|医生|注意事项|温馨提示/.test(source);
}

export function parseRecommendBlocks(raw: string): Block[] {
  const text = prepareRecommendMarkdown(raw);
  if (!text) {
    return [];
  }
  const blocks: Block[] = [];
  let listIndex = 0;

  for (const original of text.split('\n')) {
    const line = original.trim();
    if (!line || /^[-*]{3,}$/.test(line)) {
      listIndex = 0;
      continue;
    }

    const headingMark = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMark) {
      listIndex = 0;
      const spans = parseSpans(headingMark[1]);
      blocks.push({kind: 'heading', spans, danger: isDanger(headingMark[1])});
      continue;
    }

    const numbered = line.match(/^(\d+)[.)）]\s*(.*)$/);
    if (numbered) {
      const body = numbered[2];
      const spans = parseSpans(body);
      if (looksLikeHeading(spans, body)) {
        listIndex = 0;
        blocks.push({kind: 'heading', spans, danger: isDanger(body)});
      } else {
        listIndex += 1;
        blocks.push({kind: 'list', ordered: true, index: Number(numbered[1]) || listIndex, spans});
      }
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      listIndex += 1;
      blocks.push({kind: 'list', ordered: false, index: listIndex, spans: parseSpans(bullet[1])});
      continue;
    }

    listIndex = 0;
    blocks.push({kind: 'paragraph', spans: parseSpans(line)});
  }

  return blocks;
}

function RichLine({spans, style}: {spans: Span[]; style: object}) {
  return (
    <Text selectable style={style}>
      {spans.map((span, index) => (
        <Text
          key={`${index}-${span.text.slice(0, 8)}`}
          style={[
            span.bold && styles.bold,
            span.danger && styles.danger,
          ]}>
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

type Props = {
  content: string;
};

/** 把 RAG 的 Markdown 收成适老化大字：加粗、分段、条目，不展示 * 和文献角标 */
export default function RecommendMarkdown({content}: Props) {
  const blocks = parseRecommendBlocks(content);
  if (!blocks.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <View
              key={`h-${index}`}
              style={[styles.headingWrap, block.danger && styles.headingDanger]}>
              <RichLine spans={block.spans} style={styles.heading} />
            </View>
          );
        }
        if (block.kind === 'list') {
          const mark = block.ordered ? `${block.index}.` : '•';
          return (
            <View key={`l-${index}`} style={styles.listRow}>
              <Text style={styles.bullet}>{mark}</Text>
              <View style={styles.listBody}>
                <RichLine spans={block.spans} style={styles.body} />
              </View>
            </View>
          );
        }
        return (
          <View key={`p-${index}`} style={styles.paragraph}>
            <RichLine spans={block.spans} style={styles.body} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginTop: spacing.sm, gap: spacing.sm},
  headingWrap: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headingDanger: {
    backgroundColor: colors.dangerSoft,
  },
  heading: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    fontSize: moderateScale(18),
    lineHeight: moderateScale(28),
  },
  paragraph: {paddingHorizontal: 2},
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: 2,
  },
  bullet: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
    fontSize: moderateScale(18),
    lineHeight: moderateScale(28),
    minWidth: moderateScale(22),
  },
  listBody: {flex: 1},
  body: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    lineHeight: moderateScale(28),
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  danger: {
    fontWeight: '700',
    color: colors.dangerText,
  },
});
