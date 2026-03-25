"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";

export async function getClientById(id: string) {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "client")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;
  const { data: userData } = await admin.auth.admin.getUserById(id);
  return {
    profile,
    email: userData.user?.email ?? "",
  };
}

export async function listClientsWithEmail() {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });
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

export async function createClientAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email || !password) throw new Error("Email y contraseña son obligatorios");

  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || email,
      role: "client",
    },
  });
  if (error) throw new Error(error.message);

  if (data.user && phone) {
    await admin.from("profiles").update({ phone }).eq("id", data.user.id);
  }

  revalidatePath("/dashboard/clientes");
}

export async function updateClientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!id) throw new Error("ID inválido");

  const admin = createServiceClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name, phone })
    .eq("id", id)
    .eq("role", "client");

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/clientes");
}

export async function deleteClientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ID inválido");

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/clientes");
}
