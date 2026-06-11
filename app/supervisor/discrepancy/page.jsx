"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + " WIB";
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "returned") return "bg-emerald-100 text-emerald-700";
  if (s === "recount") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function DiscrepancyPage() {
  const [tickets, setTickets] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [geos, setGeos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [ticketRes, photoRes, geoRes] = await Promise.all([
        fetch("/api/discrepancy-ticket", { cache: "no-store" }),
        fetch("/api/photo_evidence", { cache: "no-store" }),
        fetch("/api/geo-tag", { cache: "no-store" }),
      ]);
      const [ticketData, photoData, geoData] = await Promise.all([
        ticketRes.json().catch(() => []),
        photoRes.json().catch(() => []),
        geoRes.json().catch(() => []),
      ]);
      if (!ticketRes.ok) throw new Error(ticketData?.error || `HTTP ${ticketRes.status}`);
      if (!photoRes.ok) throw new Error(photoData?.error || `HTTP ${photoRes.status}`);
      if (!geoRes.ok) throw new Error(geoData?.error || `HTTP ${geoRes.status}`);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      setPhotos(Array.isArray(photoData) ? photoData : []);
      setGeos(Array.isArray(geoData) ? geoData : []);
    } catch (err) {
      setError(err?.message || "Gagal memuat data discrepancy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const ticketsEnriched = useMemo(() => {
    return tickets.map((ticket) => {
      const inboundId = ticket?.inbound_scan?.id;
      const ticketPhotos = photos.filter((p) => p.inbound_scan_id === inboundId);
      const ticketGeos = geos.filter((g) => g.inbound_scan_id === inboundId);
      return {
        ...ticket,
        photo_count: ticketPhotos.length,
        geo_count: ticketGeos.length,
      };
    });
  }, [tickets, photos, geos]);

  const filtered = useMemo(() => {
    if (activeStatus === "all") return ticketsEnriched;
    return ticketsEnriched.filter((t) => String(t.status || "").toLowerCase() === activeStatus);
  }, [activeStatus, ticketsEnriched]);

  const counts = useMemo(() => {
    const map = { open: 0, returned: 0, recount: 0 };
    ticketsEnriched.forEach((t) => {
      const s = String(t.status || "").toLowerCase();
      if (map[s] !== undefined) map[s] += 1;
    });
    return map;
  }, [ticketsEnriched]);

  const updateStatus = async (ticket, status) => {
    setSavingId(ticket.id);
    try {
      const payload = {
        id: ticket.id,
        status,
        notes: ticket.notes || "",
        reopen_reason: status === "open" ? "Reopened by supervisor" : null,
      };
      const res = await fetch("/api/discrepancy-ticket", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal update status ticket");
      await loadAll();
    } catch (err) {
      setError(err?.message || "Gagal memperbarui status.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5 text-black">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Discrepancy Resolution</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeStatus === "all" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`} onClick={() => setActiveStatus("all")}>Semua ({ticketsEnriched.length})</button>
        <button className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeStatus === "open" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`} onClick={() => setActiveStatus("open")}>Open ({counts.open})</button>
        <button className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeStatus === "recount" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`} onClick={() => setActiveStatus("recount")}>Recount ({counts.recount})</button>
        <button className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeStatus === "returned" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`} onClick={() => setActiveStatus("returned")}>Returned ({counts.returned})</button>
      </div>

      {loading && <div className="text-sm text-slate-500">Memuat ticket...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-3">
        {!loading && filtered.map((ticket) => {
          const inbound = ticket.inbound_scan || {};
          const qr = inbound.qr_code || {};
          const doNum = qr?.delivery_order?.do_number || "-";
          const boxNum = qr?.box_number ?? "-";
          const itemName = qr?.item?.name || qr?.item?.sku || "-";
          const ticketStatus = String(ticket.status || "").toLowerCase();
          const canAct = ticketStatus === "open";
          return (
            <div key={ticket.id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">Ticket #{ticket.id}</p>
                  <p className="font-bold text-slate-900 mt-1">{doNum} / BOX-{boxNum}</p>
                  <p className="text-sm text-slate-600">{itemName}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeClass(ticket.status)}`}>
                  {String(ticket.status || "open")}
                </span>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Qty aktual: <span className="font-semibold text-slate-700">{inbound.qty_actual ?? "-"}</span> •
                Severity: <span className="font-semibold text-slate-700 ml-1">{ticket.severity || "-"}</span> •
                {` ${ticket.photo_count} foto / ${ticket.geo_count} geo`} •
                {` ${fmtDate(ticket.created_at)}`}
              </div>

              <p className="mt-2 text-sm text-slate-700">{ticket.notes || "-"}</p>

              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => setSelectedTicket(ticket)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">Lihat Evidence</button>
                {canAct ? (
                  <>
                    <button disabled={savingId === ticket.id} onClick={() => updateStatus(ticket, "returned")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Returned</button>
                    <button disabled={savingId === ticket.id} onClick={() => updateStatus(ticket, "recount")} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-50">Recount</button>
                  </>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold">
                    Ticket sudah ditindak
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTicket && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 mb-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
              <h2 className="text-lg font-bold text-slate-900">Evidence Ticket #{selectedTicket.id}</h2>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(photos.filter((p) => p.inbound_scan_id === selectedTicket.inbound_scan?.id)).map((p) => {
                  const src = p.signed_url || "";
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-2">
                      {src ? <img src={src} alt={`evidence-${p.id}`} className="w-full h-44 object-cover rounded-lg bg-slate-100" /> : <div className="h-44 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">{p.url}</div>}
                      <p className="mt-2 text-[11px] font-semibold text-slate-700">
                        Qty aktual scan: {selectedTicket?.inbound_scan?.qty_actual ?? "-"}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">{fmtDate(p.timestamp)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-bold text-slate-800">Geo Tag</h3>
                <div className="space-y-2">
                  {geos.filter((g) => g.inbound_scan_id === selectedTicket.inbound_scan?.id).map((g) => (
                    <div key={g.id} className="text-xs text-slate-600">
                      {g.latitude}, {g.longitude} • acc {g.accuracy ?? "-"} • {fmtDate(g.timestamp)}
                    </div>
                  ))}
                  {geos.filter((g) => g.inbound_scan_id === selectedTicket.inbound_scan?.id).length === 0 && (
                    <p className="text-xs text-slate-500">Tidak ada geo tag.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
