import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingrese correo y contraseña');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // Navegación se manejará por AuthContext → AppNavigator
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header / Branding */}
          <View style={styles.header}>
            <Logo size="medium" />
          </View>

          <View style={styles.hero}>
            <Text style={styles.headline}>
              Justicia{'\n'}
              <Text style={styles.headlineAccent}>al alcance</Text>
              {'\n'}de un click.
            </Text>
            <Text style={styles.description}>
              Acceda a la red legal más prestigiosa de Venezuela. Seguridad, transparencia y
              excelencia jurídica en un solo lugar.
            </Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Iniciar Sesión</Text>
              <Text style={styles.cardSubtitle}>Bienvenido de nuevo al atelier jurídico.</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={colors.outline} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="nombre@correo.com"
                  placeholderTextColor={colors.outline + '99'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.labelRow}>
                <Text style={styles.label}>CONTRASEÑA</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotLink}>¿OLVIDÓ SU CLAVE?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.outline} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.outline + '99'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Acceder al Sistema</Text>
                    <Text style={styles.primaryButtonIcon}>→</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.divider} />
              <Text style={styles.footerText}>¿Aún no tiene una cuenta?</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.secondaryButtonText}>Crear Cuenta en LÉGALO</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.outline + '99'} />
            <Text style={styles.securityText}>CONEXIÓN SEGURA ENCRIPTADA SSL</Text>
          </View>

          {/* Footer */}
          <View style={styles.pageFooter}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>MMXXIV • VENEZUELA</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  hero: { marginBottom: 32 },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  headlineAccent: { color: colors.secondary },
  description: {
    marginTop: 16,
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    maxWidth: 340,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: { marginBottom: 24 },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },

  form: { gap: 16 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 4,
  },
  forgotLink: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 14,
    color: colors.onSurface,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: -8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  primaryButtonDisabled: { opacity: 0.8 },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButtonIcon: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },

  cardFooter: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerLow,
    alignItems: 'center',
    gap: 16,
  },
  divider: { height: 1 },
  footerText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  securityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.outline + '99',
    textTransform: 'uppercase',
  },

  pageFooter: {
    marginTop: 32,
    alignItems: 'center',
    opacity: 0.5,
    gap: 16,
  },
  footerLine: {
    width: 1,
    height: 48,
    backgroundColor: colors.primary,
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 4,
    color: colors.primary,
  },
});
