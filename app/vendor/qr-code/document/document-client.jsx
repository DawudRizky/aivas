"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  chunkBySize,
  dedupeQrRows,
  resolveBoxLabel,
  resolveItemName,
  resolveQuantity,
} from "../qr-utils";

export default function VendorQrDocumentClient({ deliveryOrderId }) {
  const [qrRows, setQrRows] = useState([]);
  const [qrDataUrlsById, setQrDataUrlsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!deliveryOrderId) {
        setError("delivery_order_id wajib ada untuk generate dokumen");
        setQrRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/qr-code/document?delivery_order_id=${deliveryOrderId}`, { cache: "no-store" });
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(data?.error || "Gagal memuat QR codes");
        }

        if (!mounted) return;
        setQrRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Gagal memuat QR codes");
        setQrRows([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [deliveryOrderId]);

  const uniqueQrRows = useMemo(() => dedupeQrRows(qrRows), [qrRows]);
  const printablePages = useMemo(() => chunkBySize(uniqueQrRows, 6), [uniqueQrRows]);

  useEffect(() => {
    let cancelled = false;

    const generateQrImages = async () => {
      if (!uniqueQrRows.length) {
        setQrDataUrlsById({});
        return;
      }

      const entries = await Promise.all(
        uniqueQrRows.map(async (row) => {
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
      setQrDataUrlsById(Object.fromEntries(entries));
    };

    generateQrImages();

    return () => {
      cancelled = true;
    };
  }, [uniqueQrRows]);

  const handleDownloadPdf = () => {
    window.location.href = `/api/qr-code/document?delivery_order_id=${deliveryOrderId}`;
  };

  return (
    <div className="space-y-4 text-black relative">
      <div className="no-print flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">A4 QR Document</h1>
          <p className="text-sm text-slate-500">Portrait A4 dengan 2x3 grid. Setiap halaman memuat maksimal 6 QR.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={uniqueQrRows.length === 0}
            className="rounded-xl bg-[#38bdf8] px-4 py-3 text-sm font-bold text-white hover:bg-[#0284c7] disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">Loading QR document...</div>
      ) : uniqueQrRows.length === 0 ? (
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">Tidak ada QR untuk didokumentasikan.</div>
      ) : (
        <div className="space-y-6">
          {printablePages.map((pageRows, pageIndex) => (
            <section
              key={`a4-page-${pageIndex}`}
              className="a4-page bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
            >
              <div className="grid h-full grid-cols-2 grid-rows-3 gap-2 p-4">
                {pageRows.map((row, index) => {
                  const boxLabel = resolveBoxLabel(row, pageIndex * 6 + index);
                  const itemName = resolveItemName(row);
                  const quantity = resolveQuantity(row);

                  return (
                    <article
                      key={row.id || `${row.code}-${index}`}
                      className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-center"
                    >
                      <div className="flex h-32 w-32 items-center justify-center">
                        {qrDataUrlsById[String(row.id)] ? (
                          <img
                            src={qrDataUrlsById[String(row.id)]}
                            alt={`QR ${row.code}`}
                            className="h-32 w-32 object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="mt-3 text-xs font-semibold text-slate-900">{boxLabel}</div>
                      <div className="mt-1 text-xs font-medium text-slate-700">{itemName}</div>
                      <div className="text-xs text-slate-500">Qty: {quantity}</div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .a4-page {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
          }

          .a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
