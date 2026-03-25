import React from 'react';
import { StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import LawyerOnboardingStep1Screen from './LawyerOnboardingStep1Screen';
import LawyerOnboardingStep2Screen from './LawyerOnboardingStep2Screen';
import LawyerOnboardingStep3Screen from './LawyerOnboardingStep3Screen';

/** Pasos 1–3 del registro abogado. El paso 4 (espera de aprobación) está en `LawyerPendingVerificationScreen`. */
export default function LawyerOnboardingFlow() {
  const { session, profile, profileLoading, refreshProfile } = useAuth();

  const step = profile?.lawyer_onboarding_step ?? 1;
  const userId = session?.user?.id;

  const handleBackFromStep1 = () => {
    void supabase.auth.signOut();
  };

  const handleBackToStep1 = () => {
    if (!userId) return;
    Alert.alert(
      'Volver',
      '¿Volver al paso anterior? Los archivos seleccionados en este paso no se guardarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Volver',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ lawyer_onboarding_step: 1 })
              .eq('id', userId);
            if (!error) await refreshProfile();
          },
        },
      ]
    );
  };

  const handleBackToStep2 = () => {
    if (!userId) return;
    Alert.alert(
      'Volver',
      '¿Volver al paso anterior? Puedes volver a editar la verificación de documentos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Volver',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ lawyer_onboarding_step: 2 })
              .eq('id', userId);
            if (!error) await refreshProfile();
          },
        },
      ]
    );
  };

  if (profileLoading || !userId) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (step === 1) {
    return (
      <LawyerOnboardingStep1Screen
        userId={userId}
        onContinue={refreshProfile}
        onBack={handleBackFromStep1}
      />
    );
  }

  if (step === 2) {
    return (
      <LawyerOnboardingStep2Screen
        userId={userId}
        initialInpreNumber={profile?.inpre_number}
        onComplete={refreshProfile}
        onBack={handleBackToStep1}
      />
    );
  }

  if (step === 3) {
    return (
      <LawyerOnboardingStep3Screen
        userId={userId}
        initialPhone={profile?.phone}
        onComplete={refreshProfile}
        onBack={handleBackToStep2}
      />
    );
  }

  // Paso ≥4: pantalla de espera la maneja `App` vía `lawyerPendingVerification`
  return null;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
