"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function VendorPurchaseOrderPage() {
  const [user, setUser] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Get current user (expects cookie-based auth handled by /api/auth/me)
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) throw new Error(`HTTP ${meRes.status}`);
        const meData = await meRes.json();
        const currentUser = meData?.user ?? null;

        if (!currentUser) {
          if (mounted) setError("Unauthorized: please login as vendor.");
          return;
        }

        if (currentUser.role !== "vendor") {
          if (mounted) setError("Access denied: this page is for vendor users only.");
          return;
        }

        if (mounted) setUser(currentUser);

        // Load all purchase orders and filter by vendor id
        const poRes = await fetch("/api/purchase-order");
        if (!poRes.ok) throw new Error(`HTTP ${poRes.status}`);
        const poData = await poRes.json();

        const vid = currentUser.vendor_id ?? currentUser.vendor?.id;
        const filtered = Array.isArray(poData)
          ? poData.filter((p) => {
              const vendorId = p.vendor_id ?? p.vendor?.id ?? p.vendor?.id;
              return vendorId != null && String(vendorId) === String(vid);
            })
          : [];

        if (mounted) setPurchaseOrders(filtered);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => (mounted = false);
  }, []);

  function displayPoId(po) {
    return po.po_number ?? "-";
  }

  function formatDate(d) {
    try {
      return new Date(d).toLocaleDateString("id-ID");
    } catch {
      return d || "-";
    }
  }

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Purchase Order</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar PO yang diterima dari PPIC EPSON</p>
      </div>

      <div className="space-y-4 mt-6">
        {loading && <div className="text-sm text-slate-500">Memuat Purchase Orders...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {!loading && !error && purchaseOrders.length === 0 && (
          <div className="text-sm text-slate-500">Tidak ada Purchase Order untuk vendor Anda.</div>
        )}

        {!loading && !error && purchaseOrders.map((po, index) => {
          const poId = po.po_number ?? "-";
          const status = po.status ?? "-";
          const vendorName = po.vendor?.name ?? po.vendor_name ?? "-";
          const amount = po.total_amount ? `${po.total_amount} ${po.currency ?? "IDR"}` : null;
          const date = formatDate(po.date ?? po.created_at ?? po.date_created);

          return (
            <Link
              key={po.id ?? index}
              href={`/vendor/buat-shipment?po=${encodeURIComponent(po.po_number ?? po.id ?? "")}`}
              className="bg-white rounded-xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center transition-colors group-hover:bg-blue-100 shadow-inner border border-blue-100">
                  <img 
                    src="/ic_listblue.jpg" 
                    alt="PO Icon" 
                    className="w-8 h-8 object-contain opacity-100 transition-transform group-hover:scale-110" 
                  />
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-900 text-lg">{poId}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        (status === "shipped") ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-500"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 font-medium">
                    {vendorName} • {amount ?? "-"} • {date}
                  </div>
                </div>
              </div>
              
              <div className="mr-2 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                <img 
                  src="/ic_arrow.jpg" 
                  alt="Arrow Right" 
                  className="w-6 h-6 object-contain" 
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  );
}