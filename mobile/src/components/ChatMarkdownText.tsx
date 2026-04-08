import React, { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

type Segment = { text: string; bold: boolean };

/** Parte `**negrita**` en segmentos (contenido puede ser multilínea). */
function parseBoldSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, m.index), bold: false });
    }
    segments.push({ text: m[1], bold: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  if (segments.length === 0) {
    segments.push({ text, bold: false });
  }
  return segments;
}

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

/** Líneas `* ítem` o `- ítem` (Markdown) → bloques de lista; el resto son párrafos. */
function splitIntoBlocks(raw: string): Block[] {
  const lines = raw.split('\n');
  const blocks: Block[] = [];
  const paraLines: string[] = [];
  let listItems: string[] | null = null;

  const flushPara = () => {
    if (paraLines.length > 0) {
      blocks.push({ kind: 'paragraph', text: paraLines.join('\n') });
      paraLines.length = 0;
    }
  };

  const flushList = () => {
    if (listItems && listItems.length > 0) {
      blocks.push({ kind: 'list', items: listItems });
      listItems = null;
    }
  };

  /** `* texto` / `- texto` (asterisco o guión + espacio + contenido). */
  const listLine = /^\s*[\*\-]\s+(.+)$/;

  for (const line of lines) {
    const m = line.match(listLine);
    if (m) {
      flushPara();
      if (!listItems) listItems = [];
      listItems.push(m[1].trimEnd());
    } else {
      flushList();
      paraLines.push(line);
    }
  }
  flushPara();
  flushList();

  return blocks;
}

function BoldInline({
  text,
  baseStyle,
  boldStyle,
}: {
  text: string;
  baseStyle?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
}) {
  const parts = parseBoldSegments(text);
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) =>
        p.bold ? (
          <Text key={i} style={[baseStyle, boldStyle ?? { fontWeight: '700' }]}>
            {p.text}
          </Text>
        ) : (
          <Fragment key={`t-${i}`}>{p.text}</Fragment>
        ),
      )}
    </Text>
  );
}

type Props = {
  children: string;
  baseStyle?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
};

/**
 * Markdown mínimo en burbujas: `**negrita**` y listas con `*` o `-` al inicio de línea.
 */
export default function ChatMarkdownText({ children, baseStyle, boldStyle }: Props) {
  const blocks = splitIntoBlocks(children);

  if (blocks.length === 0) {
    return <Text style={baseStyle} />;
  }

  return (
    <View style={styles.root}>
      {blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <BoldInline key={`p-${i}`} text={block.text} baseStyle={baseStyle} boldStyle={boldStyle} />
        ) : (
          <View key={`l-${i}`} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.listRow}>
                <Text style={[baseStyle, styles.bullet]}>•{'\u00A0'}</Text>
                <View style={styles.listItemBody}>
                  <BoldInline text={item} baseStyle={baseStyle} boldStyle={boldStyle} />
                </View>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    gap: 6,
  },
  list: {
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    marginRight: 2,
    lineHeight: 22,
  },
  listItemBody: {
    flex: 1,
    minWidth: 0,
  },
});
