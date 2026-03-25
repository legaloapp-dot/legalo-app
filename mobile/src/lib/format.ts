/** Tiempo relativo en español (es-VE) */
export function relativeTimeEs(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `Hace ${days} d`;
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '$0';
  const n = Number(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** +58... → 58412... para wa.me */
export function digitsOnlyE164(phone: string): string {
  return phone.replace(/\D/g, '');
}
