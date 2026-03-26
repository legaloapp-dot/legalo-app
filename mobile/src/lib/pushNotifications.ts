/**
 * Punto de entrada para el registro de push del abogado.
 * No importa `expo-notifications` aquí para que Metro pueda empaquetar aunque falle
 * la resolución de módulos nativos en algunos entornos (p. ej. caché en Windows).
 *
 * La lógica completa está en `pushNotifications.expo.ts` (no enlazada al bundle por defecto).
 * Ver comentarios al inicio de ese archivo para activar push.
 */
export async function registerAndSaveLawyerPushToken(_userId: string): Promise<void> {
  // No-op hasta activar la re-exportación desde pushNotifications.expo.ts
}
