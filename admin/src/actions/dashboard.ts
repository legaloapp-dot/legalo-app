"use server";

import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";

export async function getDashboardStats() {
  await requireAdmin();
  const admin = createServiceClient();

  const [clients, lawyers, pendingPay, pendingLawyers] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "lawyer"),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "lawyer")
      .eq("is_verified", false),
  ]);

  return {
    clients: clients.count ?? 0,
    lawyers: lawyers.count ?? 0,
    pendingPayments: pendingPay.count ?? 0,
    lawyersPendingVerify: pendingLawyers.count ?? 0,
  };
}
