import type { StyleProp, TextStyle } from 'react-native';

export type Segment = { text: string; bold: boolean };

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

export type Props = {
  children: string;
  baseStyle?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
};
