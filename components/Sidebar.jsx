"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";
import useCurrentUser, { getUserSubtitle } from "../lib/useCurrentUser";

export default function Sidebar({ forceMobile = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading } = useCurrentUser();

  let role = "vendor";
  if (pathname.startsWith("/supervisor")) role = "supervisor";
  if (pathname.startsWith("/ppic")) role = "ppic";
  if (pathname.startsWith("/admin")) role = "admin";
  if (pathname.startsWith("/it")) role = "it";

  const config = {
    vendor: {
      title: "AIVAS",
      subtitle: "Vendor Portal",
      menuItems: [
        { name: "Purchase Orders", icon: "/ic_list.jpg", path: "/vendor" },
        { name: "Delivery Orders", icon: "/ic_truck.jpg", path: "/vendor/buat-shipment" },
        { name: "QR Viewer", icon: "/ic_qr.jpg", path: "/vendor/qr-code" },
      ],
    },
    supervisor: {
      title: "AIVAS",
      subtitle: "Supervisor",
      menuItems: [
        { name: "Dashboard", icon: "/ic_barchart.jpg", path: "/supervisor" },
        { name: "Discrepancy", icon: "/ic_alert.jpg", path: "/supervisor/discrepancy" },
        { name: "Shipments", icon: "/ic_truck.jpg", path: "/supervisor/shipments" },
      ],
    },
    ppic: {
      title: "AIVAS",
      subtitle: "PPIC Portal",
      menuItems: [
        { name: "Purchase Order", icon: "/ic_list.jpg", path: "/ppic" },
        { name: "Inventory", icon: "/ic_barchart.jpg", path: "/ppic/inventory" },
        { name: "Dashboard", icon: "/ic_barchart.jpg", path: "/ppic/dashboard" },
      ],
    },
    admin: {
      title: "AIVAS",
      subtitle: "Inbound Scanner",
      menuItems: [
        { name: "Scan & Verifikasi", icon: "/ic_qr.jpg", path: "/admin" },
        { name: "Riwayat Verifikasi", icon: "/ic_list.jpg", path: "/admin/riwayat" },
      ],
    },
    it: {
      title: "AIVAS",
      subtitle: "IT Portal",
      menuItems: [
        { name: "User Management", icon: "/ic_list.jpg", path: "/it" },
      ],
    },
  };

  const currentConfig = config[role];

  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen((current) => !current);

    window.addEventListener("aivas-toggle-admin-sidebar", handleToggle);
    return () => window.removeEventListener("aivas-toggle-admin-sidebar", handleToggle);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    router.replace("/login?loggedOut=1");
    router.refresh();
  };

  return (
    <>
      {/* OVERLAY GELAP SAAT SIDEBAR TERBUKA DI MOBILE */}
      {isMobileMenuOpen && (
        <div className={`${forceMobile ? "" : "lg:hidden "}fixed inset-0 bg-slate-900/60 z-[50] transition-opacity`} onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR ASLI (Sembunyi di kiri saat mode mobile, muncul saat diklik) */}
      <aside className={`${forceMobile ? "fixed" : "fixed lg:static"} top-0 left-0 h-full z-[55] w-64 bg-gradient-to-br from-[#1a2f4c] to-[#0a4b9c] text-white flex flex-col border-r border-white/10 shrink-0 transform transition-transform duration-300 ease-in-out shadow-2xl ${forceMobile ? "" : "lg:shadow-none"} ${isMobileMenuOpen ? "translate-x-0" : forceMobile ? "-translate-x-full" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo & Header Sidebar */}
        <div className={`p-6 pb-2 mt-2 ${forceMobile ? "" : "lg:mt-0 hidden lg:block"}`}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AIVAS Logo" className="h-10 w-auto object-contain mix-blend-screen" />
            <h1 className="text-[25px] font-bold tracking-tight leading-none">AIVAS</h1>
          </div>
        </div>

        <div className={`px-6 mb-2 ${forceMobile ? "mt-4" : "mt-20 lg:mt-2"} text-[11px] font-bold text-blue-200/60 uppercase tracking-wider`}>
          {currentConfig.subtitle}
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 px-4 mt-2 space-y-1">
          {currentConfig.menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive ? "bg-white/10 border border-white/20 text-white" : "text-blue-100/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`flex items-center justify-center transition-all ${isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}>
                  <img src={item.icon} alt={item.name} className="w-5 h-5 object-contain mix-blend-screen" />
                </div>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bagian Bawah: Info & Keluar */}
        <div className="p-4 border-t border-white/10">
          {loading ? (
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-white/15 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-white/15 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 mb-4">
              <UserAvatar className="h-8 w-8 border-white/30 bg-white/20 text-white" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white leading-none truncate">{user?.name ?? 'Not signed in'}</p>
                <p className="text-[9px] text-blue-200 mt-1 truncate">{getUserSubtitle(user)}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 w-full text-red-600 hover:text-red-300 hover:bg-red-700/10 py-2 rounded-lg text-sm font-medium transition-all group"
          >
            <div className="flex items-center justify-center transition-transform group-hover:scale-110 opacity-80 group-hover:opacity-100">
              <img src="/ic_logout.jpg" alt="Logout" className="w-5 h-5 object-contain mix-blend-screen" />
            </div>
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
