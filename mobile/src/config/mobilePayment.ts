/**
 * Datos de pago móvil (Venezuela) — sustituir por los reales de LÉGALO.
 * Opcional: EXPO_PUBLIC_FEE_USD en .env
 */
const rawFee = process.env.EXPO_PUBLIC_FEE_USD;
export const DEFAULT_FEE_USD =
  rawFee != null && rawFee !== '' && !Number.isNaN(Number(rawFee)) ? Number(rawFee) : 25;

export const PAYMENT_INSTRUCTIONS = {
  title: 'Pago móvil',
  lines: [
    'Realiza el pago del fee de contacto al número corporativo de LÉGALO.',
    'Usa el monto indicado y guarda el comprobante para subirlo aquí.',
    'Cuando el administrador confirme el pago, en el directorio «Crear caso» abrirá la solicitud. WhatsApp con el abogado se habilita cuando tengas un caso en curso aceptado por él.',
  ],
  /** Placeholder — reemplazar con datos reales */
  bank: 'Banco de Venezuela',
  phonePm: '0414-0000000',
  rif: 'J-00000000-0',
  beneficiary: 'LÉGALO APP C.A.',
} as const;

/** Suscripción Premium abogado (directorio con prioridad). */
export const LAWYER_PREMIUM_FEE_USD = 20;

export const SUBSCRIPTION_PAYMENT_INSTRUCTIONS = {
  title: 'Pago móvil',
  lines: [
    'Realiza el pago de USD 20.00 por la suscripción Premium al número corporativo de LÉGALO.',
    'Usa exactamente el monto indicado y guarda el comprobante para subirlo aquí.',
    'Cuando el administrador apruebe el comprobante en el panel, tu plan Premium se activará en la app.',
  ],
  bank: PAYMENT_INSTRUCTIONS.bank,
  phonePm: PAYMENT_INSTRUCTIONS.phonePm,
  rif: PAYMENT_INSTRUCTIONS.rif,
  beneficiary: PAYMENT_INSTRUCTIONS.beneficiary,
} as const;
