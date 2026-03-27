import { AdminHeader } from "@/components/layout/AdminHeader";
import { listTransactionsEnriched } from "@/actions/payments";
import { PagosTableClient } from "@/components/payments/PagosTableClient";

export default async function PagosPage() {
  const rows = await listTransactionsEnriched();

  return (
    <>
      <AdminHeader
        title="Pagos"
        description="Comprobantes de pago móvil: fee de contacto cliente–abogado y suscripciones Premium de abogados. Aprueba o rechaza para activar el flujo correspondiente."
      />

      <PagosTableClient rows={rows} />
    </>
  );
}
