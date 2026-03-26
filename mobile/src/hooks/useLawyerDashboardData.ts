import { useCallback, useEffect, useState } from 'react';
import {
  fetchLawyerActivity,
  fetchLawyerCases,
  fetchLawyerLeads,
  countActiveCases,
  type LegalCaseRow,
  type LeadRow,
  type LawyerActivityRow,
} from '../lib/legalDashboard';

export interface LawyerDashboardState {
  loading: boolean;
  error: string | null;
  cases: LegalCaseRow[];
  leads: LeadRow[];
  activity: LawyerActivityRow[];
  activeCaseCount: number;
  newLeadsCount: number;
}

export function useLawyerDashboardData(lawyerId: string | undefined) {
  const [state, setState] = useState<LawyerDashboardState>({
    loading: true,
    error: null,
    cases: [],
    leads: [],
    activity: [],
    activeCaseCount: 0,
    newLeadsCount: 0,
  });

  const load = useCallback(async () => {
    if (!lawyerId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [c, l, a] = await Promise.allSettled([
        fetchLawyerCases(lawyerId),
        fetchLawyerLeads(lawyerId),
        fetchLawyerActivity(lawyerId),
      ]);

      const cases = c.status === 'fulfilled' ? c.value : [];
      const leads = l.status === 'fulfilled' ? l.value : [];
      const activity = a.status === 'fulfilled' ? a.value : [];

      const parts: string[] = [];
      if (c.status === 'rejected') {
        parts.push(
          `Casos: ${c.reason instanceof Error ? c.reason.message : String(c.reason)}`
        );
      }
      if (l.status === 'rejected') {
        parts.push(
          `Leads: ${l.reason instanceof Error ? l.reason.message : String(l.reason)}`
        );
      }
      if (a.status === 'rejected') {
        parts.push(
          `Actividad: ${a.reason instanceof Error ? a.reason.message : String(a.reason)}`
        );
      }

      setState({
        loading: false,
        error: parts.length > 0 ? parts.join(' · ') : null,
        cases,
        leads,
        activity,
        activeCaseCount: countActiveCases(cases),
        newLeadsCount: leads.filter((x) => x.status === 'new').length,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Error al cargar datos',
      }));
    }
  }, [lawyerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
