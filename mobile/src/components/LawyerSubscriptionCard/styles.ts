import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '88',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  planLine: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 6 },
  line: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 20 },
  lineMuted: { fontSize: 12, color: colors.outline, marginTop: 8 },
  muted: { fontSize: 13, color: colors.outline, fontStyle: 'italic' },
});
