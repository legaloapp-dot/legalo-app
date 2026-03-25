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
      const [cases, leads, activity] = await Promise.all([
        fetchLawyerCases(lawyerId),
        fetchLawyerLeads(lawyerId),
        fetchLawyerActivity(lawyerId),
      ]);
      setState({
        loading: false,
        error: null,
        cases,
        leads,
        activity,
        activeCaseCount: countActiveCases(cases),
        newLeadsCount: leads.filter((l) => l.status === 'new').length,
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
