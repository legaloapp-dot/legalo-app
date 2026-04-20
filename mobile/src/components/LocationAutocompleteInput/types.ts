import type { TextStyle } from 'react-native';

export type Variant = 'lawyer' | 'directory';

export const VARIANT_STYLES: Record<
  Variant,
  {
    input: TextStyle;
    placeholder: string;
    suggestionText: TextStyle;
    rowBorder: string;
    dropdownBg: string;
    loading: string;
  }
> = {
  lawyer: {
    input: {
      flex: 1,
      fontSize: 16,
      color: '#191c1e',
      padding: 0,
    },
    placeholder: '#757682',
    suggestionText: { fontSize: 14, color: '#191c1e', fontWeight: '600' },
    rowBorder: '#c5c6d255',
    dropdownBg: '#ffffff',
    loading: '#001237',
  },
  directory: {
    input: {
      flex: 1,
      fontSize: 15,
      color: '#000209',
      padding: 0,
    },
    placeholder: '#75768299',
    suggestionText: { fontSize: 14, color: '#000209', fontWeight: '600' },
    rowBorder: '#C4C6CF44',
    dropdownBg: '#FFFFFF',
    loading: '#005CAB',
  },
};
