/**
 * Implementación real de push (Expo). No importar este archivo desde App ni desde el
 * entry: Metro lo empaquetaría y volvería a exigir `expo-notifications` resuelto.
 *
 * Para activar push en el abogado:
 * 1) En `pushNotifications.ts`, reemplaza el cuerpo por:
 *    `export { registerAndSaveLawyerPushToken } from './pushNotifications.expo';`
 * 2) En `App.tsx`, añade: `import './src/lib/pushNotifications.expo';` (efecto: setNotificationHandler)
 * 3) `npx expo install expo-notifications expo-device expo-constants` y `npm install` en `mobile/`
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerAndSaveLawyerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let st = existing;
  if (existing !== 'granted') {
    const r = await Notifications.requestPermissionsAsync();
    st = r.status;
  }
  if (st !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Falta extra.eas.projectId en app.json');
    return;
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes.data;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) {
    console.warn('[push]', error.message);
  }
}
