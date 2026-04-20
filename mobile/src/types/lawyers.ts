export type SpecialtyId = 'Laboral' | 'Penal' | 'Civil' | 'Mercantil' | 'Público' | 'Otro';

export interface DirectoryLawyer {
  id: string;
  full_name: string | null;
  specialty: string | null;
  phone: string | null;
  is_verified: boolean;
  avatar_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  /** premium primero en lista; basic al final tras prueba vencida */
  plan?: string | null;
}
