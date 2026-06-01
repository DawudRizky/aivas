"use client";

import { useEffect, useMemo, useState } from "react";

function fmtNum(v) {
  return Number(v || 0).toLocaleString("id-ID");
}

function dayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default function SupervisorDashboard() {
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [inbound, setInbound] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nowAnchor, setNowAnchor] = useState(null);

  useEffect(() => {
    setNowAnchor(Date.now());
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [poRes, doRes, inRes, invRes, tkRes] = await Promise.all([
          fetch("/api/purchase-order", { cache: "no-store" }),
          fetch("/api/delivery-order", { cache: "no-store" }),
          fetch("/api/inbound-scan", { cache: "no-store" }),
          fetch("/api/inventory-record", { cache: "no-store" }),
          fetch("/api/discrepancy-ticket", { cache: "no-store" }),
        ]);
        const [poData, doData, inData, invData, tkData] = await Promise.all([
          poRes.json().catch(() => []),
          doRes.json().catch(() => []),
          inRes.json().catch(() => []),
          invRes.json().catch(() => []),
          tkRes.json().catch(() => []),
        ]);
        if (!poRes.ok) throw new Error(poData?.error || `HTTP ${poRes.status}`);
        if (!doRes.ok) throw new Error(doData?.error || `HTTP ${doRes.status}`);
        if (!inRes.ok) throw new Error(inData?.error || `HTTP ${inRes.status}`);
        if (!invRes.ok) throw new Error(invData?.error || `HTTP ${invRes.status}`);
        if (!tkRes.ok) throw new Error(tkData?.error || `HTTP ${tkRes.status}`);
        if (mounted) {
          setOrders(Array.isArray(poData) ? poData : []);
          setShipments(Array.isArray(doData) ? doData : []);
          setInbound(Array.isArray(inData) ? inData : []);
          setInventory(Array.isArray(invData) ? invData : []);
          setTickets(Array.isArray(tkData) ? tkData : []);
        }
      } catch (err) {
        if (mounted) setError(err?.message || "Gagal memuat data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const ticketCounts = useMemo(() => {
    const c = { total: tickets.length, open: 0, hold: 0, resolved: 0 };
    tickets.forEach((t) => {
      const s = String(t.status || "").toLowerCase();
      if (s === "open") c.open += 1;
      else if (s === "hold") c.hold += 1;
      else if (s === "resolved") c.resolved += 1;
    });
    return c;
  }, [tickets]);

  const inboundCounts = useMemo(() => {
    const c = { total: inbound.length, match: 0, hold: 0 };
    inbound.forEach((s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "match") c.match += 1;
      if (st === "hold") c.hold += 1;
    });
    return c;
  }, [inbound]);

  const inventoryTotals = useMemo(() => {
    const totalQty = inventory.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalReserved = inventory.reduce((sum, r) => sum + Number(r.reserved_qty || 0), 0);
    return { rows: inventory.length, totalQty, totalReserved };
  }, [inventory]);

  const poCounts = useMemo(() => {
    const map = {};
    orders.forEach((po) => {
      const key = String(po.status || "unknown").toLowerCase();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [orders]);

  const shipmentCounts = useMemo(() => {
    const map = {};
    shipments.forEach((d) => {
      const key = String(d.status || "unknown").toLowerCase();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [shipments]);

  const inbound7Days = useMemo(() => {
    if (!nowAnchor) return [];
    const now = new Date(nowAnchor);
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }), value: 0 });
    }
    const index = new Map(days.map((d, i) => [d.key, i]));
    inbound.forEach((s) => {
      const k = dayKey(s.scanned_at);
      if (k && index.has(k)) days[index.get(k)].value += 1;
    });
    return days;
  }, [inbound]);

  const maxInbound7 = Math.max(1, ...inbound7Days.map((d) => d.value));

  const topVendorsByShipment = useMemo(() => {
    const map = new Map();
    shipments.forEach((s) => {
      const name = s?.vendor?.name || "Unknown Vendor";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [shipments]);

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Company Operations Dashboard</h1>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat data...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Orders</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{orders.length}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Orders</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{shipments.length}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inbound Scans</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{inboundCounts.total}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Discrepancy Tickets</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{ticketCounts.total}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stock Qty</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{fmtNum(inventoryTotals.totalQty)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Inbound (7 Hari)</h2>
          <div className="mt-4 space-y-2">
            {inbound7Days.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <div className="w-12 text-[11px] text-slate-500">{d.label}</div>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(d.value / maxInbound7) * 100}%` }} />
                </div>
                <div className="w-6 text-right text-[11px] font-semibold text-slate-700">{d.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Inbound Quality</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Match</span><span className="font-bold text-emerald-700">{inboundCounts.match}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Hold</span><span className="font-bold text-amber-700">{inboundCounts.hold}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Match Rate</span><span className="font-bold text-slate-900">{inboundCounts.total ? `${((inboundCounts.match / inboundCounts.total) * 100).toFixed(1)}%` : "0%"}</span></div>
            <div className="pt-2 border-t border-slate-100 flex justify-between"><span className="text-slate-600">Open Tickets</span><span className="font-bold text-rose-700">{ticketCounts.open}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Hold Tickets</span><span className="font-bold text-amber-700">{ticketCounts.hold}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Resolved Tickets</span><span className="font-bold text-emerald-700">{ticketCounts.resolved}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">PO Status</h2>
          <div className="mt-4 space-y-2 text-sm">
            {Object.entries(poCounts).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-slate-600 capitalize">{k}</span><span className="font-bold text-slate-900">{v}</span></div>
            ))}
            {Object.keys(poCounts).length === 0 && <p className="text-slate-500 text-sm">Belum ada data PO.</p>}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Shipment Status</h2>
          <div className="mt-4 space-y-2 text-sm">
            {Object.entries(shipmentCounts).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-slate-600 capitalize">{k}</span><span className="font-bold text-slate-900">{v}</span></div>
            ))}
            {Object.keys(shipmentCounts).length === 0 && <p className="text-slate-500 text-sm">Belum ada data shipment.</p>}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Top Vendors by Shipment</h2>
          <div className="mt-4 space-y-2 text-sm">
            {topVendorsByShipment.map((v, idx) => (
              <div key={v.name} className="flex justify-between">
                <span className="text-slate-600">{idx + 1}. {v.name}</span>
                <span className="font-bold text-slate-900">{v.count}</span>
              </div>
            ))}
            {topVendorsByShipment.length === 0 && <p className="text-slate-500 text-sm">Belum ada data vendor shipment.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
