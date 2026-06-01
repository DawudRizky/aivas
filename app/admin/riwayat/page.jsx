"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "match") return "bg-emerald-100 text-emerald-700";
  if (key === "hold") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function getScanLabel(row) {
  const doNumber = row?.qr_code?.delivery_order?.do_number;
  const boxNumber = row?.qr_code?.box_number;
  const itemName = row?.qr_code?.item?.name;
  const itemSku = row?.qr_code?.item?.sku;

  if (doNumber || boxNumber || itemName) {
    const left = doNumber ? `${doNumber}` : `SCAN-${row?.id || "-"}`;
    const mid = boxNumber !== undefined && boxNumber !== null ? `BOX-${boxNumber}` : null;
    const right = itemName || (itemSku ? `ITEM ${itemSku}` : null);
    return [left, mid, right].filter(Boolean).join(" / ");
  }

  const rawCode = row?.qr_code?.code;
  const code = String(rawCode || "").trim();
  if (!code) return `SCAN-${row?.id || "-"}`;

  if (code.includes("|") && code.includes(":")) {
    const parts = code.split("|");
    const map = {};
    for (const part of parts) {
      const idx = part.indexOf(":");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim().toUpperCase();
      const value = part.slice(idx + 1).trim();
      if (key) map[key] = value;
    }
    const doNum = map.DO || map.DONO || map["DO_NUMBER"];
    const boxNum = map.BOX || map.BOXNO || map["BOX_NUMBER"];
    const itemCode = map.ITEM || map.ITEMID;

    if (doNum && boxNum) return `${doNum} / BOX-${boxNum}`;
    if (doNum) return doNum;
    if (itemCode) return `ITEM-${itemCode}`;
  }

  return code.length > 36 ? `${code.slice(0, 36)}...` : code;
}

export default function AdminRiwayatPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleSidebarToggle = () => {
    window.dispatchEvent(new Event("aivas-toggle-admin-sidebar"));
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/inbound-scan", { cache: "no-store" });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (mounted) setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (mounted) setError(err?.message || "Gagal memuat riwayat.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        qrCode: getScanLabel(row),
        status: String(row.status || "unknown").toUpperCase(),
        scannedAt: formatDate(row.scanned_at),
      })),
    [rows]
  );

  return (
    <div className="h-full w-full overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="h-full overflow-y-auto p-3">
        <div className="mb-3 rounded-2xl bg-white p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSidebarToggle}
              className="flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1.5"
              aria-label="Buka atau tutup sidebar"
            >
              <img src="/logo.png" alt="AIVAS Logo" className="h-6 w-auto object-contain" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">AIVAS</span>
            </button>
            <div className="h-6 w-px bg-slate-300" />
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">
              Riwayat Scan
            </h1>
          </div>
        </div>

        {loading && <div className="text-[12px] text-slate-500">Memuat data...</div>}
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="text-[12px] text-slate-500">Belum ada aktivitas scan.</div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold">{item.qrCode}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{item.scannedAt}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black tracking-wider ${statusStyle(item.status)}`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
