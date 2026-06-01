"use client";

import { useEffect, useState } from "react";

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID");
}

const FLOW = ["submitted", "acknowledged", "shipped", "received"];

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "acknowledge") return "acknowledged";
  return s;
}

function statusLabel(status) {
  const s = normalizeStatus(status);
  if (s === "acknowledged") return "acknowledge";
  return s || "-";
}

function stepActive(step, status) {
  const s = normalizeStatus(status);
  if (!FLOW.includes(s)) return false;
  return FLOW.indexOf(step) <= FLOW.indexOf(s);
}

export default function ShipmentsPage() {
  const [orders, setOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [poRes, doRes] = await Promise.all([
          fetch("/api/purchase-order?include_all=1", { cache: "no-store" }),
          fetch("/api/delivery-order", { cache: "no-store" }),
        ]);
        const [poData, doData] = await Promise.all([
          poRes.json().catch(() => []),
          doRes.json().catch(() => []),
        ]);
        if (!poRes.ok) throw new Error(poData?.error || `HTTP ${poRes.status}`);
        if (!doRes.ok) throw new Error(doData?.error || `HTTP ${doRes.status}`);
        if (mounted) {
          setOrders(Array.isArray(poData) ? poData : []);
          setDeliveryOrders(Array.isArray(doData) ? doData : []);
        }
      } catch (err) {
        if (mounted) setError(err?.message || "Gagal memuat purchase order.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tracking Purchase Order</h1>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat PO...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {!loading && orders.map((po) => {
          const s = normalizeStatus(po.status);
          const isStopped = s === "rejected" || s === "cancelled";
          const relatedDO = deliveryOrders.filter((d) => Number(d.purchase_order_id) === Number(po.id));
          const boxCount = relatedDO.reduce((sum, d) => sum + (Array.isArray(d.delivery_order_item) ? d.delivery_order_item.length : 0), 0);
          return (
          <div key={po.id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{po.po_number || `PO-${po.id}`}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Vendor: {po?.vendor?.name || "-"}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isStopped ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
                {statusLabel(po.status)}
              </span>
            </div>

            {!isStopped ? (
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  <span>submitted</span>
                  <span>acknowledge</span>
                  <span>shipped</span>
                  <span>received</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {FLOW.map((step) => (
                    <div key={step} className={`h-2 rounded-full ${stepActive(step, po.status) ? "bg-blue-500" : "bg-slate-200"}`} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs font-semibold text-rose-600">
                PO berhenti di status: {statusLabel(po.status)}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
              Tanggal PO: {fmtDate(po.date)} • Item: {Array.isArray(po.purchase_order_item) ? po.purchase_order_item.length : 0} • Box: {boxCount}
            </div>
          </div>
        )})}
        {!loading && !error && orders.length === 0 && (
          <p className="text-sm text-slate-500">Belum ada purchase order.</p>
        )}
      </div>
    </div>
  );
}
