"use client";

import Sidebar from "./Sidebar";
import TopbarUser from "./TopbarUser";

export default function VendorLayoutShell({ children }) {
  const handleMobileSidebarToggle = () => {
    window.dispatchEvent(new CustomEvent("aivas-toggle-vendor-mobile-sidebar"));
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-6 shrink-0 z-10">
          <div className="flex w-10 items-center lg:w-0">
            <button
              type="button"
              onClick={handleMobileSidebarToggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
              aria-label="Buka sidebar"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="ml-auto">
            <TopbarUser />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
