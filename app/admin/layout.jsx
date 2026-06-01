"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import TopbarUser from "../../components/TopbarUser";

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const forceMobileShell = useMemo(
    () => pathname === "/admin" || pathname === "/admin/riwayat",
    [pathname]
  );

  if (forceMobileShell) {
    return (
      <div className="flex h-[100dvh] w-[100dvw] overflow-hidden bg-[#050b16]">
        <Sidebar forceMobile />
        <main className="h-full w-full overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#f8fafc] font-sans text-slate-800 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center" />
          <TopbarUser />
        </header>
        <main className="flex-1 min-h-0 overflow-hidden lg:overflow-y-auto p-0 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
