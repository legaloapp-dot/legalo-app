"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";

export type TransactionRow = {
  id: string;
  client_id: string | null;
  lawyer_id: string | null;
  amount: number | null;
  status: string;
  receipt_url: string | null;
  created_at: string;
  client_name: string | null;
  lawyer_name: string | null;
  client_email: string;
  receipt_signed_url: string | null;
};

export async function listTransactionsEnriched(): Promise<TransactionRow[]> {
  await requireAdmin();
  const admin = createServiceClient();

  const { data: simple, error: e2 } = await admin
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (e2) throw new Error(e2.message);

  const ids = new Set<string>();
  (simple ?? []).forEach((t: { client_id?: string | null; lawyer_id?: string | null }) => {
    if (t.client_id) ids.add(t.client_id);
    if (t.lawyer_id) ids.add(t.lawyer_id);
  });

  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", [...ids]);

  const nameById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));

  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const emailById = Object.fromEntries(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const enriched: TransactionRow[] = await Promise.all(
    (simple ?? []).map(async (t: Record<string, unknown>) => {
      const cid = t.client_id as string | null;
      const lid = t.lawyer_id as string | null;
      let receipt_signed_url: string | null = null;
      const path = t.receipt_url as string | null;
      if (path && typeof path === "string") {
        const { data: s } = await admin.storage.from("receipts").createSignedUrl(path, 3600);
        receipt_signed_url = s?.signedUrl ?? null;
      }
      return {
        id: t.id as string,
        client_id: cid,
        lawyer_id: lid,
        amount: t.amount as number | null,
        status: t.status as string,
        receipt_url: path,
        created_at: t.created_at as string,
        client_name: cid ? (nameById[cid] ?? null) : null,
        lawyer_name: lid ? (nameById[lid] ?? null) : null,
        client_email: cid ? (emailById[cid] ?? "—") : "—",
        receipt_signed_url,
      };
    })
  );
  return enriched;
}

export async function setTransactionStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "approved" | "rejected" | "pending";
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    throw new Error("Datos inválidos");
  }

  const admin = createServiceClient();
  const { error } = await admin.from("transactions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/pagos");
}
