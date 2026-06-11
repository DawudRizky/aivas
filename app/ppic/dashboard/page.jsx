"use client";
import { useEffect, useMemo, useState } from "react";

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 10) / 10}%`;
}

function formatTicketLabel(ticket) {
  return `Ticket #${ticket?.id || "-"}`;
}

function getTicketStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "returned") return "bg-emerald-50 text-emerald-600";
  if (value === "recount") return "bg-amber-50 text-amber-600";
  if (value === "open") return "bg-rose-50 text-rose-600";
  return "bg-slate-100 text-slate-600";
}

function getSeverityClass(severity) {
  const value = String(severity || "").toLowerCase();
  if (value === "high") return "bg-rose-50 text-rose-600";
  if (value === "medium") return "bg-amber-50 text-amber-600";
  if (value === "low") return "bg-blue-50 text-blue-600";
  return "bg-slate-100 text-slate-600";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Gagal memuat ${url}`);
  }
  return data;
}

export default function PpicDashboardPage() {
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [discrepancyTickets, setDiscrepancyTickets] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    Promise.all([
      fetchJson('/api/delivery-order'),
      fetchJson('/api/discrepancy-ticket'),
      fetchJson('/api/vendor'),
    ]).then(([dos, tickets, vends]) => {
      if (!mounted) return;
      setDeliveryOrders(Array.isArray(dos) ? dos : []);
      setDiscrepancyTickets(Array.isArray(tickets) ? tickets : []);
      setVendors(Array.isArray(vends) ? vends : []);
      setLoading(false);
    }).catch((fetchError) => {
      if (!mounted) return;
      setError(fetchError?.message || "Gagal memuat dashboard.");
      setLoading(false);
    });

    return () => { mounted = false };
  }, []);

  const totalShipments = deliveryOrders.length;
  const verifiedCount = deliveryOrders.filter(d => ['verified','received','delivered'].includes((d.status || '').toLowerCase())).length;
  const ticketCount = discrepancyTickets.length;
  const matchRate = totalShipments > 0 ? Math.round(((totalShipments - ticketCount) / totalShipments) * 1000) / 10 : 0;
  const openTickets = discrepancyTickets.filter(t => String(t.status || "").toLowerCase() === 'open').length;
  const pendingShipments = totalShipments - verifiedCount;

  const ticketStatusDistribution = useMemo(() => {
    const counts = discrepancyTickets.reduce((acc, ticket) => {
      const key = String(ticket.status || "unknown").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const entries = [
      { key: "open", label: "Open", color: "bg-rose-500" },
      { key: "recount", label: "Recount", color: "bg-amber-400" },
      { key: "returned", label: "Returned", color: "bg-emerald-500" },
    ];

    return ticketCount === 0 ? [] : entries
      .map((entry) => {
        const count = counts[entry.key] || 0;
        const percent = ticketCount > 0 ? (count / ticketCount) * 100 : 0;
        return { ...entry, count, percent };
      })
      .filter((entry) => entry.count > 0);
  }, [discrepancyTickets, ticketCount]);

  const vendorPerformance = useMemo(() => {
    return vendors.map((vendor) => {
      const vendorId = Number(vendor.id);
      const shipments = deliveryOrders.filter((deliveryOrder) => Number(deliveryOrder.vendor?.id || deliveryOrder.vendor_id || 0) === vendorId);
      const tickets = discrepancyTickets.filter((ticket) => {
        const ticketVendorId = Number(ticket?.inbound_scan?.qr_code?.delivery_order?.vendor?.id || 0);
        return ticketVendorId === vendorId;
      });
      const matches = Math.max(0, shipments.length - tickets.length);
      const score = shipments.length > 0 ? Math.round((matches / shipments.length) * 100) : null;

      return {
        id: vendor.id,
        name: vendor.name,
        shipments: shipments.length,
        discrepancies: tickets.length,
        matches,
        score,
      };
    }).filter((vendor) => vendor.shipments > 0 || vendor.discrepancies > 0);
  }, [deliveryOrders, discrepancyTickets, vendors]);

  const recentTickets = useMemo(() => discrepancyTickets.slice(0, 5), [discrepancyTickets]);

  return (
    <div className="space-y-6 text-black">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Monitoring performa supply chain & discrepancy secara real-time</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    
      {/* 4 Cards (Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {vendors.length} vendor
            </div>
          </div>
            <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? "..." : totalShipments}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Total Shipment</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-emerald-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {pendingShipments} pending
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? "..." : verifiedCount}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Terverifikasi</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-emerald-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {ticketCount} ticket
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? "..." : `${matchRate}%`}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Match Rate</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] relative overflow-hidden group hover:border-rose-200 transition-colors">
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
            </div>
            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {ticketCount} total
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{loading ? "..." : openTickets}</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Open Tickets</p>
          </div>
        </div>
      </div>

      {/* Grid Bawah: Verifikasi Overview & Distribusi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel Kiri: Distribusi Discrepancy */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-6">
           <div className="flex items-center gap-2 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <h3 className="text-base font-bold text-slate-800">Distribusi Status Ticket</h3>
          </div>

          <div className="space-y-5">
            {ticketStatusDistribution.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data discrepancy ticket di database.</p>
            ) : ticketStatusDistribution.map((entry) => (
              <div key={entry.key}>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-sm font-semibold text-slate-700">{entry.label}</span>
                  <span className="text-sm font-bold text-slate-800">
                    {entry.count} <span className="text-xs text-slate-400 font-medium">({formatPercent(entry.percent)})</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`${entry.color} h-2 rounded-full`} style={{ width: `${entry.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Kanan: Vendor Performance Scorecard */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-6 flex flex-col h-full">
           <div className="flex items-center gap-2 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            <h3 className="text-base font-bold text-slate-800">Vendor Performance</h3>
          </div>

              <div className="space-y-4 flex-1">
            {vendorPerformance.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada performa vendor yang bisa dihitung dari data shipment dan discrepancy.</p>
            ) : vendorPerformance.map((vendor) => (
                <div key={vendor.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex justify-between items-center mb-2 gap-3">
                    <span className="text-sm font-bold text-slate-800">{vendor.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vendor.score === null ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-600"}`}>
                      {vendor.score === null ? "Belum ada shipment" : `Score: ${vendor.score}%`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${vendor.score || 0}%` }}></div>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-500 font-medium">
                    <span>{vendor.shipments} shipment</span>
                    <span className="text-emerald-500">{vendor.matches} match</span>
                    <span className="text-rose-500">{vendor.discrepancies} discrepancy</span>
                  </div>
                </div>
            ))}
          </div>
        </div>

      </div>

      {/* Full Width Bawah: Ticket Discrepancy Terbaru */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-amber-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-base font-bold text-slate-800">Ticket Discrepancy Terbaru</h3>
        </div>
        <div className="p-2 space-y-1">
          {recentTickets.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">Belum ada discrepancy ticket di database.</div>
          ) : recentTickets.map((ticket) => {
            const vendorName = ticket?.inbound_scan?.qr_code?.delivery_order?.vendor?.name || "";
            const doNumber = ticket?.inbound_scan?.qr_code?.delivery_order?.do_number || "";
            const itemName = ticket?.inbound_scan?.qr_code?.item?.name || "";
            const severity = ticket?.severity ? String(ticket.severity) : "";
            const status = ticket?.status ? String(ticket.status) : "";
            const metaLine = [vendorName, doNumber].filter(Boolean).join(" • ");

            return (
              <div key={ticket.id} className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-800">{formatTicketLabel(ticket)}</h4>
                  {metaLine ? <p className="text-[11px] text-slate-400 mt-0.5 truncate">{metaLine}</p> : null}
                  {itemName ? <p className="text-[11px] text-slate-500 mt-1 truncate">{itemName}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {severity ? <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide uppercase ${getSeverityClass(severity)}`}>{severity}</span> : null}
                  {status ? <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide uppercase ${getTicketStatusClass(status)}`}>{status}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
