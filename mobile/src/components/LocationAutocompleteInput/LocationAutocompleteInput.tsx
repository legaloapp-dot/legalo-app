import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Keyboard,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { searchPlacesAutocomplete, type PlaceSuggestion } from '../../lib/placesAutocomplete';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { VARIANT_STYLES, type Variant } from './types';
import { styles } from './styles';

export default function LocationAutocompleteInput({
  value,
  onChangeText,
  onPickSuggestion,
  variant,
  placeholder,
  accessibilityLabel,
  inputStyle,
  wrapperStyle,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** Al elegir una sugerencia de la lista (incluye coordenadas si las necesitas). */
  onPickSuggestion?: (s: PlaceSuggestion) => void;
  variant: Variant;
  placeholder?: string;
  accessibilityLabel?: string;
  inputStyle?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = VARIANT_STYLES[variant];
  const debounced = useDebouncedValue(value, 420);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Evita una nueva búsqueda justo después de elegir una sugerencia (mismo texto). */
  const skipSearchForLabelRef = useRef<string | null>(null);

  useEffect(() => {
    const q = debounced.trim();
    if (skipSearchForLabelRef.current !== null && q === skipSearchForLabelRef.current) {
      skipSearchForLabelRef.current = null;
      setSuggestions([]);
      setListOpen(false);
      setLoading(false);
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setListOpen(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    void searchPlacesAutocomplete(q, ac.signal)
      .then((rows) => {
        if (ac.signal.aborted) return;
        setSuggestions(rows);
        setListOpen(rows.length > 0);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setSuggestions([]);
        setListOpen(false);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [debounced]);

  const onSelect = useCallback(
    (s: PlaceSuggestion) => {
      const label = s.label.trim();
      skipSearchForLabelRef.current = label;
      if (onPickSuggestion) {
        onPickSuggestion(s);
      } else {
        onChangeText(s.label);
      }
      setSuggestions([]);
      setListOpen(false);
      Keyboard.dismiss();
    },
    [onChangeText, onPickSuggestion]
  );

  const showDropdown = listOpen && suggestions.length > 0;
  const ph = placeholder ?? 'Escribe dirección o ciudad…';
  const listData = useMemo(() => suggestions, [suggestions]);

  return (
    <View style={[styles.wrap, wrapperStyle]}>
      <View style={styles.inputRow}>
        <TextInput
          testID={testID}
          style={[v.input, inputStyle]}
          value={value}
          onChangeText={(t) => {
            skipSearchForLabelRef.current = null;
            onChangeText(t);
            if (t.trim().length >= 2) setListOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setListOpen(true);
          }}
          placeholder={ph}
          placeholderTextColor={v.placeholder}
          accessibilityLabel={accessibilityLabel}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? <ActivityIndicator size="small" color={v.loading} style={styles.spinner} /> : null}
      </View>

      {showDropdown ? (
        <View style={[styles.dropdown, { backgroundColor: v.dropdownBg, borderColor: v.rowBorder }]}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={listData}
            keyExtractor={(item) => item.id}
            scrollEnabled={listData.length > 4}
            style={styles.flatMax}
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionRow, { borderBottomColor: v.rowBorder }]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={v.suggestionText} numberOfLines={3}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}
