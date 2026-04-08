import './src/lib/pushNotifications.expo';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ClientChatScreen from './src/screens/ClientChatScreen';
import LawyerOnboardingFlow from './src/screens/lawyer-onboarding/LawyerOnboardingFlow';
import LawyerPendingVerificationScreen from './src/screens/lawyer-onboarding/LawyerPendingVerificationScreen';
import LawyerDashboardScreen from './src/screens/LawyerDashboardScreen';
import {
  lawyerNeedsOnboarding,
  lawyerPendingVerification,
} from './src/types/profile';

function AppContent() {
  const { session, loading, profile, profileLoading } = useAuth();
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  const appReady = !loading && !(session != null && profileLoading);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (loading || (session != null && profileLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size='large' color='#001D3D' />
      </View>
    );
  }

  if (session) {
    if (profile && lawyerPendingVerification(profile)) {
      return <LawyerPendingVerificationScreen />;
    }
    if (profile && lawyerNeedsOnboarding(profile)) {
      return <LawyerOnboardingFlow />;
    }
    if (profile?.role === 'lawyer' && profile.is_verified) {
      return <LawyerDashboardScreen />;
    }
    return <ClientChatScreen />;
  }

  return screen === 'login' ? (
    <LoginScreen onNavigateToRegister={() => setScreen('register')} />
  ) : (
    <RegisterScreen onNavigateToLogin={() => setScreen('login')} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style='dark' />
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
