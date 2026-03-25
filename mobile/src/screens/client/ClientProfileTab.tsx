import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/profile';
import { colors } from '../../theme/colors';

export default function ClientProfileTab({
  profile,
  email,
}: {
  profile: Profile | null;
  email: string;
}) {
  const signOut = () => {
    Alert.alert('Cerrar sesión', '¿Salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void supabase.auth.signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={48} color={colors.chatSecondary} />
      </View>
      <Text style={styles.name}>{profile?.full_name?.trim() || 'Usuario'}</Text>
      <Text style={styles.email}>{email}</Text>

      <View style={styles.block}>
        <Text style={styles.label}>Teléfono</Text>
        <Text style={styles.value}>{profile?.phone || '—'}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Rol</Text>
        <Text style={styles.value}>
          {profile?.role === 'client' ? 'Cliente' : profile?.role ?? '—'}
        </Text>
      </View>

      <TouchableOpacity style={styles.outBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={styles.outText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40, alignItems: 'center' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.chatContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 22, fontWeight: '800', color: colors.chatPrimary },
  email: { fontSize: 14, color: colors.chatOutline, marginTop: 6, marginBottom: 24 },
  block: {
    alignSelf: 'stretch',
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.chatOutline,
    marginBottom: 6,
  },
  value: { fontSize: 16, fontWeight: '600', color: colors.chatOnSurface },
  outBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  outText: { fontSize: 16, fontWeight: '600', color: colors.error },
});
