import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { lawyerNeedsOnboarding, lawyerPendingVerification } from '../types/profile';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ClientChatScreen from '../screens/ClientChatScreen';
import LawyerDashboardScreen from '../screens/LawyerDashboardScreen';
import LawyerOnboardingFlow from '../screens/lawyer-onboarding/LawyerOnboardingFlow';
import LawyerPendingVerificationScreen from '../screens/lawyer-onboarding/LawyerPendingVerificationScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { session, profile } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          {lawyerPendingVerification(profile) && (
            <Stack.Screen name="LawyerPendingVerification" component={LawyerPendingVerificationScreen} />
          )}
          {lawyerNeedsOnboarding(profile) && (
            <Stack.Screen name="LawyerOnboarding" component={LawyerOnboardingFlow} />
          )}
          {profile?.role === 'lawyer' && profile.is_verified && (
            <Stack.Screen name="LawyerDashboard" component={LawyerDashboardScreen} />
          )}
          <Stack.Screen name="ClientDashboard" component={ClientChatScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
