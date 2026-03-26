"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";

export type LawyerListFilters = {
  plan?: string;
  paidFrom?: string;
  paidTo?: string;
};

export async function listLawyersWithEmail(filters?: LawyerListFilters) {
  await requireAdmin();
  const admin = createServiceClient();
  let q = admin.from("profiles").select("*").eq("role", "lawyer");

  const plan = filters?.plan?.trim();
  if (plan && plan !== "all" && ["trial", "premium", "basic"].includes(plan)) {
    q = q.eq("plan", plan);
  }

  const paidFrom = filters?.paidFrom?.trim();
  const paidTo = filters?.paidTo?.trim();
  if (paidFrom) {
    q = q.gte("subscription_paid_at", `${paidFrom}T00:00:00.000Z`);
  }
  if (paidTo) {
    q = q.lte("subscription_paid_at", `${paidTo}T23:59:59.999Z`);
  }

  const { data: profiles, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: authData, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  if (listErr) throw new Error(listErr.message);

  const emailById = Object.fromEntries(
    (authData.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailById[p.id] ?? "—",
  }));
}

export async function getLawyerById(id: string) {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "lawyer")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const { data: userData } = await admin.auth.admin.getUserById(id);
  const email = userData.user?.email ?? "—";

  let inpreUrl: string | null = null;
  let cedulaUrl: string | null = null;

  if (profile.lawyer_inpre_card_path) {
    const { data: s } = await admin.storage
      .from("lawyer-cards")
      .createSignedUrl(profile.lawyer_inpre_card_path, 3600);
    inpreUrl = s?.signedUrl ?? null;
  }
  if (profile.lawyer_cedula_path) {
    const { data: s } = await admin.storage
      .from("lawyer-cards")
      .createSignedUrl(profile.lawyer_cedula_path, 3600);
    cedulaUrl = s?.signedUrl ?? null;
  }

  return { profile, email, inpreUrl, cedulaUrl };
}

export async function createLawyerAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email || !password) throw new Error("Email y contraseña son obligatorios");

  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || email,
      role: "lawyer",
    },
  });
  if (error) throw new Error(error.message);

  if (data.user) {
    await admin
      .from("profiles")
      .update({
        specialty,
        phone,
        lawyer_onboarding_step: 5,
      })
      .eq("id", data.user.id);
  }

  revalidatePath("/dashboard/abogados");
}

export async function updateLawyerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const inpre_number = String(formData.get("inpre_number") ?? "").trim() || null;
  const professional_bio = String(formData.get("professional_bio") ?? "").trim() || null;
  const acceptingRaw = formData.get("accepting_cases");
  const accepting_cases = acceptingRaw === "on" || acceptingRaw === "true";

  if (!id) throw new Error("ID inválido");

  const admin = createServiceClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name,
      phone,
      specialty,
      inpre_number,
      professional_bio,
      accepting_cases,
    })
    .eq("id", id)
    .eq("role", "lawyer");

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/abogados");
  revalidatePath(`/dashboard/abogados/${id}`);
}

/** Suscripción (plan, vigencia, fecha de pago registrada por admin). */
export async function updateLawyerSubscriptionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const plan = String(formData.get("plan") ?? "").trim();
  const expiresRaw = String(formData.get("subscription_expires_at") ?? "").trim();
  const paidRaw = String(formData.get("subscription_paid_at") ?? "").trim();

  if (!id) throw new Error("ID inválido");
  if (!["trial", "premium", "basic"].includes(plan)) throw new Error("Plan inválido");

  const admin = createServiceClient();
  const payload: Record<string, unknown> = { plan };

  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha de vigencia inválida");
    payload.subscription_expires_at = d.toISOString();
  } else {
    payload.subscription_expires_at = null;
  }

  if (paidRaw) {
    payload.subscription_paid_at = `${paidRaw}T12:00:00.000Z`;
  } else {
    payload.subscription_paid_at = null;
  }

  const { error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .eq("role", "lawyer");

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/abogados");
  revalidatePath(`/dashboard/abogados/${id}`);
}

/** Aprobar o rechazar verificación de abogado (`verification_action`: approve | reject). */
export async function setLawyerVerificationAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("verification_action") ?? "") as "approve" | "reject";
  if (!id) throw new Error("ID inválido");
  if (!["approve", "reject"].includes(action)) throw new Error("Acción inválida");

  const admin = createServiceClient();
  if (action === "approve") {
    const { error } = await admin
      .from("profiles")
      .update({
        is_verified: true,
        lawyer_verification_rejected_at: null,
      })
      .eq("id", id)
      .eq("role", "lawyer");
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from("profiles")
      .update({
        is_verified: false,
        lawyer_verification_rejected_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("role", "lawyer");
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/abogados");
  revalidatePath(`/dashboard/abogados/${id}`);
}

export async function deleteLawyerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ID inválido");

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/abogados");
  revalidatePath("/dashboard");
}
