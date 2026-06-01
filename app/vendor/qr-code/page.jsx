"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  dedupeQrRows,
  resolveBoxLabel,
  resolveDeliveryOrderOptions,
  resolveItemName,
  resolveQuantity,
} from "./qr-utils";

export default function VendorQrCodePage() {
  const [qrRows, setQrRows] = useState([]);
  const [selectedDeliveryOrderId, setSelectedDeliveryOrderId] = useState("");
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQrRows = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/qr-code", { cache: "no-store" });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.error || "Gagal memuat QR codes");
      }

      setQrRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Gagal memuat QR codes");
      setQrRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQrRows();
  }, []);

  const uniqueQrRows = useMemo(() => dedupeQrRows(qrRows), [qrRows]);

  const deliveryOrderOptions = useMemo(() => resolveDeliveryOrderOptions(uniqueQrRows), [uniqueQrRows]);

  useEffect(() => {
    if (!deliveryOrderOptions.length) {
      setSelectedDeliveryOrderId("");
      return;
    }

    setSelectedDeliveryOrderId((currentValue) => {
      if (!currentValue) return String(deliveryOrderOptions[0].id);

      const stillExists = deliveryOrderOptions.some((option) => String(option.id) === String(currentValue));
      return stillExists ? currentValue : String(deliveryOrderOptions[0].id);
    });
  }, [deliveryOrderOptions]);

  const selectedQrRows = useMemo(() => {
    const targetDoId = Number(selectedDeliveryOrderId);
    if (!Number.isFinite(targetDoId) || targetDoId <= 0) return [];

    return uniqueQrRows
      .filter((row) => Number(row?.delivery_order_id || row?.delivery_order?.id) === targetDoId)
      .sort((left, right) => {
        const leftBox = Number(left?.box_number || 0);
        const rightBox = Number(right?.box_number || 0);
        if (leftBox !== rightBox) return leftBox - rightBox;
        return Number(left?.id || 0) - Number(right?.id || 0);
      });
  }, [selectedDeliveryOrderId, uniqueQrRows]);

  useEffect(() => {
    let cancelled = false;

    const generateQrImages = async () => {
      if (!selectedQrRows.length) {
        setQrDataUrls({});
        return;
      }

      const entries = await Promise.all(
        selectedQrRows.map(async (row) => {
          const value = String(row?.code || "");
          if (!value) {
            return [String(row.id), ""];
          }

          const dataUrl = await QRCode.toDataURL(value, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: "M",
          });

          return [String(row.id), dataUrl];
        })
      );

      if (cancelled) return;
      setQrDataUrls(Object.fromEntries(entries));
    };

    generateQrImages();

    return () => {
      cancelled = true;
    };
  }, [selectedQrRows]);

  const handleGenerateDocument = () => {
    if (!selectedDeliveryOrderId) return;

    window.location.href = `/api/qr-code/document?delivery_order_id=${selectedDeliveryOrderId}`;
  };

  return (
    <div className="space-y-6 text-black relative">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mt-2">QR Viewer</h1>
        <p className="text-sm text-slate-500 mt-2">Pilih DO untuk melihat semua QR per box dan cetak dokumen A4 (6 QR per halaman).</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="block w-full md:max-w-md">
            <span className="text-sm font-semibold text-slate-700">Delivery Order</span>
            <select
              value={selectedDeliveryOrderId}
              onChange={(event) => setSelectedDeliveryOrderId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
            >
              {deliveryOrderOptions.length === 0 ? <option value="">Tidak ada DO dengan QR</option> : null}
              {deliveryOrderOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.doNumber} (PO {option.poNumber})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadQrRows}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-[#38bdf8] hover:text-[#0284c7]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleGenerateDocument}
              disabled={selectedQrRows.length === 0}
              className="rounded-xl bg-[#38bdf8] px-4 py-3 text-sm font-bold text-white hover:bg-[#0284c7] disabled:opacity-50"
            >
              Download PDF Document
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">Loading QR data...</div>
      ) : selectedQrRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">Tidak ada QR untuk DO yang dipilih.</div>
      ) : (
        <div className="space-y-6">
          <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]">
            <div className="mb-3 text-sm font-semibold text-slate-800">Web Viewer</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selectedQrRows.map((row, index) => {
                const itemName = resolveItemName(row);
                const boxLabel = resolveBoxLabel(row, index);
                const quantity = resolveQuantity(row);
                return (
                  <div key={row.id || `${row.code}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 text-center">
                      {qrDataUrls[String(row.id)] ? (
                        <img src={qrDataUrls[String(row.id)]} alt={`QR ${row.code}`} className="h-32 w-32 object-contain" />
                      ) : (
                        <div className="text-xs text-slate-400">Generating QR...</div>
                      )}
                      <div className="mt-3 text-xs font-semibold text-slate-900">{boxLabel}</div>
                      <div className="mt-1 text-xs font-medium text-slate-700">{itemName}</div>
                      <div className="text-xs text-slate-500">Qty: {quantity}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
