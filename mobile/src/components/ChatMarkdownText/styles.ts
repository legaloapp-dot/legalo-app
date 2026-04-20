import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
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
