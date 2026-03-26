"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import type { CaseRow } from "@/lib/caseConstants";
import { isValidStatus } from "@/lib/caseConstants";

export async function listCasesEnriched(): Promise<CaseRow[]> {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: rows, error } = await admin
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  (rows ?? []).forEach((r: { client_id?: string; lawyer_id?: string }) => {
    if (r.client_id) ids.add(r.client_id);
    if (r.lawyer_id) ids.add(r.lawyer_id);
  });
  if (ids.size === 0) return [];

  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", [...ids]);

  const nameById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));

  return (rows ?? []).map((r: Record<string, unknown>) => {
    const cid = r.client_id as string;
    const lid = r.lawyer_id as string;
    return {
      id: r.id as string,
      client_id: cid,
      lawyer_id: lid,
      title: String(r.title ?? ""),
      description: r.description != null ? String(r.description) : null,
      client_display_name: r.client_display_name != null ? String(r.client_display_name) : null,
      status: String(r.status ?? "active"),
      last_activity: r.last_activity != null ? String(r.last_activity) : null,
      last_activity_at: r.last_activity_at != null ? String(r.last_activity_at) : null,
      created_at: String(r.created_at ?? ""),
      client_name: nameById[cid] ?? null,
      lawyer_name: nameById[lid] ?? null,
    };
  });
}

export async function getCaseById(id: string) {
  await requireAdmin();
  const admin = createServiceClient();
  const { data: row, error } = await admin.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", [row.client_id, row.lawyer_id]);

  const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));

  return {
    ...row,
    client_name: byId[row.client_id as string] ?? null,
    lawyer_name: byId[row.lawyer_id as string] ?? null,
  } as Record<string, unknown> & {
    id: string;
    client_id: string;
    lawyer_id: string;
    title: string;
    description: string | null;
    client_display_name: string | null;
    status: string;
    last_activity: string | null;
    last_activity_at: string | null;
    created_at: string;
    client_name: string | null;
    lawyer_name: string | null;
  };
}

export async function createCaseAction(formData: FormData) {
  await requireAdmin();
  const client_id = String(formData.get("client_id") ?? "").trim();
  const lawyer_id = String(formData.get("lawyer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const client_display_name = String(formData.get("client_display_name") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active").trim();
  const last_activity = String(formData.get("last_activity") ?? "").trim() || null;

  if (!client_id || !lawyer_id || !title) {
    throw new Error("Cliente, abogado y título son obligatorios.");
  }
  if (!isValidStatus(status)) throw new Error("Estado inválido.");

  const admin = createServiceClient();
  const { data: c } = await admin
    .from("profiles")
    .select("id")
    .eq("id", client_id)
    .eq("role", "client")
    .maybeSingle();
  const { data: l } = await admin
    .from("profiles")
    .select("id")
    .eq("id", lawyer_id)
    .eq("role", "lawyer")
    .maybeSingle();
  if (!c || !l) throw new Error("Cliente o abogado no encontrado o rol incorrecto.");

  const now = new Date().toISOString();
  const { error } = await admin.from("cases").insert({
    client_id,
    lawyer_id,
    title,
    description,
    client_display_name,
    status,
    last_activity: last_activity ?? "Caso creado desde panel admin",
    last_activity_at: now,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/casos");
}

export async function updateCaseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID requerido.");

  const client_id = String(formData.get("client_id") ?? "").trim();
  const lawyer_id = String(formData.get("lawyer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const client_display_name = String(formData.get("client_display_name") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim();
  const last_activity = String(formData.get("last_activity") ?? "").trim() || null;

  if (!client_id || !lawyer_id || !title) {
    throw new Error("Cliente, abogado y título son obligatorios.");
  }
  if (!isValidStatus(status)) throw new Error("Estado inválido.");

  const admin = createServiceClient();
  const { data: c } = await admin
    .from("profiles")
    .select("id")
    .eq("id", client_id)
    .eq("role", "client")
    .maybeSingle();
  const { data: lw } = await admin
    .from("profiles")
    .select("id")
    .eq("id", lawyer_id)
    .eq("role", "lawyer")
    .maybeSingle();
  if (!c || !lw) throw new Error("Cliente o abogado no encontrado o rol incorrecto.");

  const now = new Date().toISOString();
  const { error } = await admin
    .from("cases")
    .update({
      client_id,
      lawyer_id,
      title,
      description,
      client_display_name,
      status,
      last_activity,
      last_activity_at: now,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/casos");
  revalidatePath(`/dashboard/casos/${id}`);
}

export async function deleteCaseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID requerido.");

  const admin = createServiceClient();
  const { error } = await admin.from("cases").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/casos");
  redirect("/dashboard/casos");
}
