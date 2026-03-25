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
import { Ionicons } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type Role = 'client' | 'lawyer';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export default function RegisterScreen({ onNavigateToLogin }: RegisterScreenProps) {
  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Complete todos los campos');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), role },
        },
      });
      if (signUpError) throw signUpError;
      // El trigger en Supabase crea el perfil automáticamente
      onNavigateToLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
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
          {/* Header */}
          <View style={styles.header}>
            <Logo size="large" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Únete a LÉGALO</Text>
            <Text style={styles.subtitle}>
              El estándar de excelencia en servicios legales digitales.
            </Text>
          </View>

          {/* Role Selection */}
          <Text style={styles.sectionLabel}>SELECCIONA TU PERFIL</Text>
          <View style={styles.roleCards}>
            <TouchableOpacity
              style={[styles.roleCard, role === 'client' && styles.roleCardSelected]}
              onPress={() => setRole('client')}
              activeOpacity={0.8}
            >
              <View style={styles.roleIcon}>
                <Ionicons name="people" size={28} color={colors.primary} />
              </View>
              <View style={styles.roleContent}>
                <Text style={styles.roleTitle}>Busco Asesoría Legal</Text>
                <Text style={styles.roleDesc}>Accede a los mejores abogados certificados.</Text>
              </View>
              {role === 'client' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} style={styles.roleCheck} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === 'lawyer' && styles.roleCardSelected]}
              onPress={() => setRole('lawyer')}
              activeOpacity={0.8}
            >
              <View style={styles.roleIcon}>
                <Ionicons name="briefcase" size={28} color={colors.primary} />
              </View>
              <View style={styles.roleContent}>
                <Text style={styles.roleTitle}>Soy Profesional del Derecho</Text>
                <Text style={styles.roleDesc}>Gestiona tus casos y expande tu firma.</Text>
              </View>
              {role === 'lawyer' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} style={styles.roleCheck} />
              )}
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>NOMBRE COMPLETO</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Carlos Eduardo Rodríguez"
              placeholderTextColor={colors.outlineVariant + '99'}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <TextInput
              style={styles.input}
              placeholder="carlos.rodriguez@email.com"
              placeholderTextColor={colors.outlineVariant + '99'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••••••"
                placeholderTextColor={colors.outlineVariant + '99'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.outline}
                />
              </TouchableOpacity>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Crear mi Cuenta</Text>
                  <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={styles.loginLink}>
            <Text style={styles.loginLinkText}>¿Ya tienes una cuenta? </Text>
            <TouchableOpacity onPress={onNavigateToLogin}>
              <Text style={styles.loginLinkBold}>Inicia Sesión</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.terms}>
            AL UNIRTE A LÉGALO ACEPTAS NUESTROS TÉRMINOS DE SERVICIO Y POLÍTICAS DE PRIVACIDAD Y
            PROTECCIÓN DE DATOS.
          </Text>
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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    fontWeight: '500',
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  roleCards: { gap: 12, marginBottom: 24 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roleCardSelected: {
    borderColor: colors.secondary,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleContent: { flex: 1 },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  roleCheck: { position: 'absolute', top: 16, right: 16 },

  form: { gap: 16, marginBottom: 24 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  passwordWrapper: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    padding: 8,
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
    paddingVertical: 18,
    borderRadius: 12,
    gap: 12,
  },
  primaryButtonDisabled: { opacity: 0.8 },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },

  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  loginLinkText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  loginLinkBold: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  terms: {
    fontSize: 10,
    color: colors.outline,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 14,
    paddingHorizontal: 16,
  },
});
