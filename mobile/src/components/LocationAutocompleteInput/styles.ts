import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  spinner: { marginRight: 4 },
  dropdown: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 220,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  flatMax: { maxHeight: 220 },
  suggestionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
