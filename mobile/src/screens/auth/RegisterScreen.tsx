import React, { useState, useRef, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Verificación por código OTP (sin salir de la app):
 * En Supabase → Authentication → Email Templates → "Confirm signup",
 * incluye el código en el cuerpo del correo, p. ej.:
 *   Tu código: {{ .Token }}
 * Usa solo {{ .Token }} (OTP corto). No uses {{ .TokenHash }} en el correo: es muy largo y no es el código a teclear.
 */

type RegisterNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

type Role = 'client' | 'lawyer';

const RESEND_COOLDOWN_SEC = 60;
/** Supabase suele enviar 6 dígitos; algunos proyectos permiten 8–10. No acortar el código al pegar. */
const OTP_MIN_LEN = 6;
const OTP_MAX_LEN = 12;

function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('too many requests') || raw.includes('429')) {
    return 'Demasiados correos o intentos. Espera unos minutos o una hora, o prueba con otro correo. En Supabase: Authentication → Rate Limits (o desactiva confirmación por email solo en desarrollo).';
  }
  return raw;
}

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterNavigationProp>();
  const { session, refreshProfile } = useAuth();
  const handoffSessionRef = useRef(false);
  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (handoffSessionRef.current && session) {
      handoffSessionRef.current = false;
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

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

      if (data.session) {
        handoffSessionRef.current = true;
        await refreshProfile();
        return;
      }

      setOtpCode('');
      setOtpStep(true);
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err: unknown) {
      handoffSessionRef.current = false;
      setError(formatAuthError(err));
    } finally {
      if (!handoffSessionRef.current) {
        setLoading(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.replace(/\D/g, '').slice(0, OTP_MAX_LEN);
    if (code.length < OTP_MIN_LEN || code.length > OTP_MAX_LEN) {
      setError(
        `Introduce el código completo (${OTP_MIN_LEN}–${OTP_MAX_LEN} dígitos, según el correo)`
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'signup',
      });
      if (verifyErr) throw verifyErr;

      handoffSessionRef.current = true;
      await refreshProfile();
    } catch (err: unknown) {
      handoffSessionRef.current = false;
      setError(formatAuthError(err));
    } finally {
      if (!handoffSessionRef.current) {
        setLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (resendErr) throw resendErr;
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromOtp = () => {
    setOtpStep(false);
    setOtpCode('');
    setError(null);
  };

  if (otpStep) {
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
            <TouchableOpacity style={styles.backRow} onPress={handleBackFromOtp} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={colors.primary} />
              <Text style={styles.backText}>Volver</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Logo size="large" style={{ marginBottom: 16 }} />
              <Text style={styles.title}>Verifica tu correo</Text>
              <Text style={styles.subtitle}>
                Escribe el código numérico que enviamos a{' '}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>CÓDIGO</Text>
              <TextInput
                style={styles.otpInput}
                placeholder={'•'.repeat(OTP_MIN_LEN)}
                placeholderTextColor={colors.outlineVariant + '99'}
                value={otpCode}
                onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, OTP_MAX_LEN))}
                keyboardType="number-pad"
                maxLength={OTP_MAX_LEN}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Confirmar código</Text>
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.onPrimary} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, resendCooldown > 0 && styles.secondaryButtonDisabled]}
                onPress={handleResendOtp}
                disabled={loading || resendCooldown > 0}
              >
                <Text style={styles.secondaryButtonText}>
                  {resendCooldown > 0
                    ? `Reenviar código (${resendCooldown}s)`
                    : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
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

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },

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
    paddingHorizontal: 8,
  },
  emailHighlight: {
    fontWeight: '700',
    color: colors.primary,
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
  otpInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 12,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.primary,
    textAlign: 'center',
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
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonDisabled: { opacity: 0.5 },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
    textDecorationLine: 'underline',
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
