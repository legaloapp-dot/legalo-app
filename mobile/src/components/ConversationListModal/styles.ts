import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
  },
  sheetWrap: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: colors.chatSurface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.chatPrimary,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.chatSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  newBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.chatSurface,
  },
  loader: {
    marginTop: 16,
  },
  empty: {
    fontSize: 14,
    color: colors.chatOutline,
    textAlign: 'center',
    marginTop: 16,
  },
  list: {
    maxHeight: 320,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: colors.chatSecondaryContainer,
    borderColor: colors.chatSecondary + '33',
  },
  itemIcon: {
    width: 28,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  itemTitleActive: {
    color: colors.chatSecondary,
  },
  itemDate: {
    fontSize: 11,
    color: colors.chatOutline,
    marginTop: 2,
  },
});
