import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/profile';
import { colors } from '../../theme/colors';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function ClientProfileTab({
  profile,
  email,
  clientId,
  refreshProfile,
}: {
  profile: Profile | null;
  email: string;
  clientId: string | undefined;
  refreshProfile: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name?.trim() ?? '');
    setPhone(profile.phone?.trim() ?? '');
  }, [profile]);

  const pickAndUploadAvatar = async () => {
    if (!clientId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a la galería para subir tu foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === 'ios',
      ...(Platform.OS === 'ios' ? { aspect: [1, 1] as [number, number] } : {}),
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const path = `${clientId}/avatar.${ext}`;

    setAvatarUploading(true);
    try {
      const { data: existing } = await supabase.storage.from('avatars').list(clientId);
      if (existing?.length) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map((f) => `${clientId}/${f.name}`));
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const buffer = base64ToArrayBuffer(base64);
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, buffer, {
        upsert: true,
        contentType: mime,
        cacheControl: '3600',
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', clientId);
      if (dbErr) throw dbErr;
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const confirmRemoveAvatar = () => {
    if (!clientId || !profile?.avatar_url) return;
    Alert.alert('Quitar foto', '¿Eliminar tu foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void removeAvatar() },
    ]);
  };

  const removeAvatar = async () => {
    if (!clientId) return;
    setAvatarUploading(true);
    try {
      const { data: files } = await supabase.storage.from('avatars').list(clientId);
      if (files?.length) {
        const { error: rmErr } = await supabase.storage
          .from('avatars')
          .remove(files.map((f) => `${clientId}/${f.name}`));
        if (rmErr) throw rmErr;
      }
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', clientId);
      if (error) throw error;
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar la foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('id', clientId);

      if (error) throw error;
      await refreshProfile();
      Alert.alert('Guardado', 'Tu perfil se actualizó correctamente.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    Alert.alert('Cerrar sesión', '¿Salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void supabase.auth.signOut() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Mi perfil</Text>
        <Text style={styles.screenSub}>
          Actualiza tu foto y datos de contacto. Los abogados con los que trabajes verán el nombre que indiques.
        </Text>

        <View style={styles.photoSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => void pickAndUploadAvatar()}
            disabled={avatarUploading || !clientId}
            activeOpacity={0.85}
            accessibilityLabel="Cambiar foto de perfil"
          >
            {avatarUploading ? (
              <ActivityIndicator color={colors.chatSecondary} />
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={52} color={colors.chatSecondary} />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={colors.chatSurface} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Toca para cambiar foto</Text>
          {profile?.avatar_url ? (
            <TouchableOpacity onPress={confirmRemoveAvatar} disabled={avatarUploading}>
              <Text style={styles.removePhoto}>Quitar foto</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos personales</Text>
          <Text style={styles.fieldLabel}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.chatOutline + '99'}
            autoCapitalize="words"
          />
          <Text style={styles.fieldLabel}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+58 412 0000000"
            placeholderTextColor={colors.chatOutline + '99'}
            keyboardType="phone-pad"
          />
          <Text style={styles.fieldLabel}>Correo electrónico</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>{email || '—'}</Text>
            <Text style={styles.readonlyNote}>El correo se gestiona desde la cuenta de acceso.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving || !clientId}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color={colors.chatSurface} />
          ) : (
            <>
              <Ionicons name="save-outline" size={22} color={colors.chatSurface} />
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.chatSecondary} />
          <Text style={styles.infoText}>
            Tus datos se usan para contactarte y mostrar tu nombre en solicitudes de casos. No compartimos tu
            información con terceros ajenos a LÉGALO.
          </Text>
        </View>

        <TouchableOpacity style={styles.outBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.outText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.chatPrimary,
    marginBottom: 8,
  },
  screenSub: {
    fontSize: 14,
    color: colors.chatOutline,
    lineHeight: 20,
    marginBottom: 24,
  },
  photoSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.chatContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chatOutlineVariant + '55',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chatSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.chatSurface,
  },
  avatarHint: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.chatOutline },
  removePhoto: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.error },
  card: {
    backgroundColor: colors.chatSurface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.chatPrimary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.chatOutline,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '99',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.chatOnSurface,
    marginBottom: 14,
    backgroundColor: colors.chatContainer + '88',
  },
  readonlyBox: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  readonlyText: { fontSize: 15, fontWeight: '600', color: colors.chatOnSurface },
  readonlyNote: { fontSize: 12, color: colors.chatOutline, marginTop: 6, lineHeight: 16 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.chatSecondary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.75 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: colors.chatSurface },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.chatPrimaryContainer,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.chatOnSurface, lineHeight: 19 },
  outBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  outText: { fontSize: 16, fontWeight: '600', color: colors.error },
});
