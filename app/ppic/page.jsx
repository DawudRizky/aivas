"use client";

import { useEffect, useState } from "react";

export default function PpicPurchaseOrderPage() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // require authenticated ppic user
        const meRes = await fetch('/api/auth/me')
        if (!meRes.ok) throw new Error(`HTTP ${meRes.status}`)
        const meData = await meRes.json()
        const currentUser = meData?.user ?? null

        if (!currentUser) {
          if (mounted) setError('Unauthorized: please login as PPIC.')
          return
        }

        if (currentUser.role !== 'ppic') {
          if (mounted) setError('Access denied: this page is for PPIC users only.')
          return
        }

        if (mounted) setUser(currentUser)

        const res = await fetch("/api/purchase-order");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setPurchaseOrders(data || []);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function formatDate(d) {
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString();
    } catch {
      return d || "-";
    }
  }

  return (
    <div className="space-y-6 text-black">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Order</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola Dokumen Purchase Order</p>
        </div>
        <button className="flex items-center gap-2 bg-[#38bdf8] hover:bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Buat PO Baru
        </button>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-500">Memuat Purchase Orders...</div>}
        {error && <div className="text-sm text-red-500">Error: {error}</div>}

        {!loading && !error && purchaseOrders.length === 0 && (
          <div className="text-sm text-slate-500">Belum ada Purchase Order.</div>
        )}

        {purchaseOrders.map((po) => {
          const poId = po.po_number ?? (po.id ? `PO-${po.id}` : "-" );
          const status = po.status ?? "-";
          const vendorName = po.vendor?.name ?? "-";
          const amount = po.total_amount ? `${po.total_amount} ${po.currency ?? "IDR"}` : null;
          const date = formatDate(po.date || po.created_at || po.date_created);

          return (
            <div
              key={po.id ?? poId}
              className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#38bdf8" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
                </svg>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-slate-800 text-sm">{poId}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${
                      status === "submitted"
                        ? "bg-blue-50 text-blue-500"
                        : status === "acknowledged"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-yellow-50 text-yellow-500"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-medium">
                  {vendorName} • {amount ?? "-"} • {date}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
