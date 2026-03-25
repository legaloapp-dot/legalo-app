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
    'Cuando el administrador confirme el pago, podrás usar «Contactar» para abrir WhatsApp con el abogado.',
  ],
  /** Placeholder — reemplazar con datos reales */
  bank: 'Banco de Venezuela',
  phonePm: '0414-0000000',
  rif: 'J-00000000-0',
  beneficiary: 'LÉGALO APP C.A.',
} as const;
