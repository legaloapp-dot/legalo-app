import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  iconPad: { padding: 6 },
  notifBadge: {
    position: 'absolute',
    right: -6,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
  },
});
