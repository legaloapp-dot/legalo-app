import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh min-h-screen items-stretch bg-[#f1f4f9]">
      <AdminSidebar />
      <div className="flex min-h-dvh min-h-screen min-w-0 flex-1 flex-col">
        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
