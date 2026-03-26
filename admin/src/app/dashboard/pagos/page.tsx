import { AdminHeader } from "@/components/layout/AdminHeader";
import { listTransactionsEnriched } from "@/actions/payments";
import { PagosTableClient } from "@/components/payments/PagosTableClient";

export default async function PagosPage() {
  const rows = await listTransactionsEnriched();

  return (
    <>
      <AdminHeader
        title="Pagos"
        description="Comprobantes de pago móvil: aprueba o rechaza para desbloquear el contacto con el abogado."
      />

      <PagosTableClient rows={rows} />
    </>
  );
}
