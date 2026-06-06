"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";
import useCurrentUser, { getUserSubtitle } from "../lib/useCurrentUser";
import { markLoggedOutRedirect } from "../lib/logoutState";

function SidebarIcon({ type, className = "h-5 w-5" }) {
  const sharedProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (type) {
    case "person":
      return (
        <svg {...sharedProps}>
          <path d="M15 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9" cy="7" r="4" />
          <path d="M21 20v-1a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "office":
      return (
        <svg {...sharedProps}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 9h.01" />
          <path d="M9 13h.01" />
          <path d="M9 17h.01" />
          <path d="M15 9h.01" />
          <path d="M15 13h.01" />
          <path d="M15 17h.01" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...sharedProps}>
          <path d="M9 3h6" />
          <path d="M10 6h4" />
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "boxes":
      return (
        <svg {...sharedProps}>
          <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
          <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case "chart":
      return (
        <svg {...sharedProps}>
          <path d="M4 20h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V8" />
          <path d="M17 16v-3" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...sharedProps}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "expand":
      return (
        <svg {...sharedProps}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({ forceMobile = false }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
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
        { name: "Purchase Order", iconType: "clipboard", path: "/ppic" },
        { name: "Inventory", iconType: "boxes", path: "/ppic/inventory" },
        { name: "Dashboard", iconType: "chart", path: "/ppic/dashboard" },
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
        { name: "User Management", iconType: "person", path: "/it/users" },
        { name: "Vendor Management", iconType: "office", path: "/it/vendors" },
      ],
    },
  };

  const currentConfig = config[role];

  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen((current) => !current);
    const handleMobileToggle = () => setIsMobileMenuOpen((current) => !current);
    const handlePpicMobileToggle = () => setIsMobileMenuOpen((current) => !current);
    const handleVendorMobileToggle = () => setIsMobileMenuOpen((current) => !current);
    const handleSupervisorMobileToggle = () => setIsMobileMenuOpen((current) => !current);

    window.addEventListener("aivas-toggle-admin-sidebar", handleToggle);
    window.addEventListener("aivas-toggle-it-mobile-sidebar", handleMobileToggle);
    window.addEventListener("aivas-toggle-ppic-mobile-sidebar", handlePpicMobileToggle);
    window.addEventListener("aivas-toggle-vendor-mobile-sidebar", handleVendorMobileToggle);
    window.addEventListener("aivas-toggle-supervisor-mobile-sidebar", handleSupervisorMobileToggle);
    return () => {
      window.removeEventListener("aivas-toggle-admin-sidebar", handleToggle);
      window.removeEventListener("aivas-toggle-it-mobile-sidebar", handleMobileToggle);
      window.removeEventListener("aivas-toggle-ppic-mobile-sidebar", handlePpicMobileToggle);
      window.removeEventListener("aivas-toggle-vendor-mobile-sidebar", handleVendorMobileToggle);
      window.removeEventListener("aivas-toggle-supervisor-mobile-sidebar", handleSupervisorMobileToggle);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || forceMobile) return;

    const savedState = window.localStorage.getItem(`aivas-sidebar-collapsed:${role}`);
    if (savedState === "true") {
      setIsCollapsed(true);
    }
  }, [forceMobile, role]);

  useEffect(() => {
    if (typeof window === "undefined" || forceMobile) return;
    window.localStorage.setItem(`aivas-sidebar-collapsed:${role}`, String(isCollapsed));
  }, [forceMobile, isCollapsed, role]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    markLoggedOutRedirect();
    window.location.replace("/login");
  };

  const shouldCollapse = !forceMobile && isDesktopViewport && isCollapsed;

  return (
    <>
      {/* OVERLAY GELAP SAAT SIDEBAR TERBUKA DI MOBILE */}
      {isMobileMenuOpen && (
        <div className={`${forceMobile ? "" : "lg:hidden "}fixed inset-0 bg-slate-900/60 z-[50] transition-opacity`} onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside
        className={`${forceMobile ? "fixed" : "fixed lg:static"} top-0 left-0 h-full z-[55] ${
          shouldCollapse ? "lg:w-28" : "w-64"
        } overflow-hidden bg-gradient-to-br from-[#1a2f4c] to-[#0a4b9c] text-white flex flex-col border-r border-white/10 shrink-0 transform transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-2xl ${forceMobile ? "" : "lg:shadow-none"} ${isMobileMenuOpen ? "translate-x-0" : forceMobile ? "-translate-x-full" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo & Header Sidebar */}
        <div className={`p-6 pb-4 mt-2 ${forceMobile ? "" : "lg:mt-0"}`}>
          <div className={`flex items-center ${shouldCollapse ? "justify-center gap-1" : "gap-3"}`}>
            <img src="/logo.png" alt="AIVAS Logo" className="h-10 w-auto object-contain mix-blend-screen shrink-0" />
            <div
              className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                shouldCollapse ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[140px] opacity-100 translate-x-0"
              }`}
            >
              <h1 className="text-[25px] font-bold tracking-tight leading-none">AIVAS</h1>
            </div>
            {!forceMobile && !shouldCollapse && (
              <button
                type="button"
                onClick={() => setIsCollapsed((current) => !current)}
                className="ml-auto hidden items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-blue-100/90 transition hover:bg-white/10 hover:text-white lg:flex"
                aria-label="Collapse sidebar"
              >
                <SidebarIcon type="collapse" className="h-4 w-4" />
              </button>
            )}
            {!forceMobile && shouldCollapse && (
              <button
                type="button"
                onClick={() => setIsCollapsed((current) => !current)}
                className="hidden items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-blue-100/90 transition hover:bg-white/10 hover:text-white lg:flex"
                aria-label="Expand sidebar"
              >
                <SidebarIcon type="expand" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {role !== "it" && role !== "ppic" && role !== "vendor" && role !== "admin" && role !== "supervisor" && (
          <div className={`px-6 mb-2 ${forceMobile ? "mt-4" : "mt-20 lg:mt-2"} text-[11px] font-bold text-blue-200/60 uppercase tracking-wider ${shouldCollapse ? "lg:px-2 lg:text-center" : ""}`}>
            {!shouldCollapse ? currentConfig.subtitle : currentConfig.subtitle.split(" ")[0]}
          </div>
        )}

        {/* Menu Navigasi */}
        <nav className={`flex-1 px-4 ${role === "it" || role === "ppic" || role === "vendor" || role === "admin" || role === "supervisor" ? "mt-0" : "mt-2"} space-y-1`}>
          {currentConfig.menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  shouldCollapse ? "lg:justify-center lg:px-3 lg:gap-0" : ""
                } ${
                  isActive ? "bg-white/10 border border-white/20 text-white" : "text-blue-100/70 hover:bg-white/5 hover:text-white"
                }`}
                title={shouldCollapse ? item.name : undefined}
              >
                <div className={`flex items-center justify-center transition-all ${isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}>
                  {item.iconType ? <SidebarIcon type={item.iconType} className="h-5 w-5" /> : <img src={item.icon} alt={item.name} className="w-5 h-5 object-contain mix-blend-screen" />}
                </div>
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                    shouldCollapse ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[180px] opacity-100 translate-x-0"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bagian Bawah: Info & Keluar */}
        <div className="p-4 border-t border-white/10">
          {loading ? (
            <div className={`flex items-center px-2 mb-4 ${shouldCollapse ? "justify-center" : "gap-3"}`}>
              <div className="h-8 w-8 rounded-full bg-white/15 animate-pulse" />
              <div
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                  shouldCollapse ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[160px] opacity-100 translate-x-0"
                }`}
              >
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-white/15 animate-pulse" />
                  <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            </div>
          ) : (
            <div className={`flex items-center px-2 mb-4 ${shouldCollapse ? "justify-center" : "gap-3"}`}>
              <UserAvatar className="h-8 w-8 border-white/30 bg-white/20 text-white" />
              <div
                className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                  shouldCollapse ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[160px] opacity-100 translate-x-0"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white leading-none truncate">{user?.name ?? "Not signed in"}</p>
                  <p className="text-[9px] text-blue-200 mt-1 truncate">{getUserSubtitle(user)}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center px-2 w-full text-red-600 hover:text-red-300 hover:bg-red-700/10 py-2 rounded-lg text-sm font-medium transition-all group ${
              shouldCollapse ? "lg:justify-center" : "gap-1"
            }`}
            title={shouldCollapse ? "Keluar" : undefined}
          >
            <div className="flex items-center justify-center transition-transform group-hover:scale-110 opacity-80 group-hover:opacity-100">
              <img src="/ic_logout.jpg" alt="Logout" className="w-5 h-5 object-contain mix-blend-screen" />
            </div>
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                shouldCollapse ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[100px] opacity-100 translate-x-0"
              }`}
            >
              Keluar
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
