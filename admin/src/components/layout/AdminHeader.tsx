export function AdminHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8 border-b border-slate-200/80 pb-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      ) : null}
    </header>
  );
}
