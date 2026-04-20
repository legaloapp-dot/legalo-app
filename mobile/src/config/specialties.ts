import { Ionicons } from '@expo/vector-icons';
import type { SpecialtyId } from '../types/lawyers';

export const LAWYER_SPECIALTY_OPTIONS: {
  id: SpecialtyId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'Laboral', label: 'Laboral', icon: 'briefcase-outline' },
  { id: 'Penal', label: 'Penal', icon: 'hammer-outline' },
  { id: 'Civil', label: 'Civil', icon: 'people-outline' },
  { id: 'Mercantil', label: 'Mercantil', icon: 'business-outline' },
  { id: 'Público', label: 'Público', icon: 'library-outline' },
  { id: 'Otro', label: 'Otro', icon: 'add' },
];
