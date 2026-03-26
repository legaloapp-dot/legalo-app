import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  caseStatusLabel,
  caseStatusIcon,
  type LegalCaseRow,
} from '../../lib/legalDashboard';
import { relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';

function caseActivityLine(c: LegalCaseRow): string {
  return c.last_activity?.trim()
    ? c.last_activity
    : `Última actividad: ${relativeTimeEs(c.last_activity_at)}`;
}

export default function LawyerCaseList({
  cases,
  onSelectCase,
  emptyHint,
}: {
  cases: LegalCaseRow[];
  onSelectCase: (c: LegalCaseRow) => void;
  emptyHint?: string;
}) {
  if (cases.length === 0) {
    return (
      <Text style={styles.empty}>
        {emptyHint ?? 'No tienes casos aún. Crea uno desde el panel o asigna clientes.'}
      </Text>
    );
  }

  return (
    <>
      {cases.map((c) => {
        const pill = caseStatusLabel(c.status);
        const iconName = caseStatusIcon(c.status);
        return (
          <TouchableOpacity
            key={c.id}
            style={styles.caseCard}
            onPress={() => onSelectCase(c)}
            activeOpacity={0.88}
          >
            <View style={styles.caseLeft}>
              <View
                style={[
                  styles.caseIconCircle,
                  c.status === 'paid' && { backgroundColor: colors.secondaryContainer },
                  c.status === 'drafting' && { backgroundColor: colors.surfaceContainerHighest },
                  c.status === 'active' && { backgroundColor: colors.secondaryContainer },
                  c.status === 'in_court' && { backgroundColor: colors.tertiaryContainer + '55' },
                  (c.status === 'consulting' || c.status === 'closed' || c.status === 'pending') && {
                    backgroundColor: colors.primaryContainer,
                  },
                  c.status === 'pending_approval' && { backgroundColor: colors.tertiaryContainer },
                  (c.status === 'rejected_by_lawyer' || c.status === 'reassignment_pending') && {
                    backgroundColor: colors.errorContainer,
                  },
                ]}
              >
                <Ionicons
                  name={iconName as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={
                    c.status === 'drafting' || c.status === 'in_court'
                      ? colors.outline
                      : colors.primary
                  }
                />
              </View>
              <View style={styles.caseTextCol}>
                <Text style={styles.caseTitle}>{c.title}</Text>
                {c.client_display_name ? (
                  <Text style={styles.caseClient}>Cliente: {c.client_display_name}</Text>
                ) : null}
                <Text style={styles.caseActivity}>{caseActivityLine(c)}</Text>
              </View>
            </View>
            <View style={styles.caseRight}>
              <View style={[styles.casePill, pill.tone === 'success' && styles.casePillSuccess]}>
                <Text
                  style={[styles.casePillText, pill.tone === 'success' && styles.casePillTextSuccess]}
                >
                  {pill.text}
                </Text>
              </View>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 14,
    color: colors.outline,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  caseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '22',
  },
  caseLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  caseIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseTextCol: { flex: 1 },
  caseTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  caseClient: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 4 },
  caseActivity: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
  caseRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  casePill: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  casePillSuccess: { backgroundColor: '#d1fae5' },
  casePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  casePillTextSuccess: { color: '#047857' },
});
