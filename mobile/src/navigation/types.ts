import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  LawyerOnboarding: undefined;
  LawyerPendingVerification: undefined;
  LawyerDashboard: undefined;
  ClientDashboard: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
