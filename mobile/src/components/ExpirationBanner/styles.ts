import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  icon: { marginTop: 2 },
  textCol: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: colors.onPrimary,
    lineHeight: 19,
    opacity: 0.95,
  },
});
