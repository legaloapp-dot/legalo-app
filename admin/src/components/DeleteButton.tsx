"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({
  label,
  id,
  action,
}: {
  label: string;
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿${label}? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
          const fd = new FormData();
          fd.set("id", id);
          await action(fd);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "…" : "Eliminar"}
    </button>
  );
}
