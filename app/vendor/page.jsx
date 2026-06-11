"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function VendorPurchaseOrderPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const itemLookup = new Map();

    fetch("/api/purchase-order", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return;

        if (Array.isArray(data)) {
          setPurchaseOrders(data);
          setError("");
        } else {
          setPurchaseOrders([]);
          setError(data?.error || "Gagal memuat purchase order");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError("Gagal memuat purchase order");
        setPurchaseOrders([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    fetch("/api/item", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return;

        const normalizedItems = Array.isArray(data) ? data : [];
        normalizedItems.forEach((item) => itemLookup.set(String(item.id), item));
        setItems(normalizedItems);
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? String(dateValue) : date.toLocaleDateString("id-ID");
  };

  const formatCurrency = (value) => {
    const numberValue = Number(value || 0);
    if (Number.isNaN(numberValue)) return String(value ?? "-");
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(numberValue);
  };

  const selectedPurchaseOrderItemLookup = useMemo(() => {
    const itemLookup = new Map(items.map((item) => [String(item.id), item]));

    return new Map(
      (selectedPurchaseOrder?.purchase_order_item || []).map((orderItem) => [String(orderItem.item_id), orderItem.item || itemLookup.get(String(orderItem.item_id)) || null])
    );
  }, [items, selectedPurchaseOrder]);

  const openPurchaseOrder = (purchaseOrder) => {
    setSelectedPurchaseOrder(purchaseOrder);
    setActionError("");
  };

  const closePurchaseOrder = () => {
    if (actionLoading) return;
    setSelectedPurchaseOrder(null);
    setActionError("");
  };

  const updatePurchaseOrderStatus = async (status) => {
    if (!selectedPurchaseOrder) return;

    setActionLoading(true);
    setActionError("");

    try {
      const response = await fetch("/api/purchase-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedPurchaseOrder.id, status }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal memperbarui purchase order");
      }

      if (status === "acknowledged") {
        closePurchaseOrder();
        router.push(`/vendor/buat-shipment?po=${selectedPurchaseOrder.po_number}`);
        return;
      }

      setPurchaseOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === selectedPurchaseOrder.id ? { ...order, status } : order
        )
      );
      setSelectedPurchaseOrder((currentOrder) => (currentOrder ? { ...currentOrder, status } : currentOrder));
    } catch (err) {
      setActionError(err?.message || "Gagal memperbarui purchase order");
    } finally {
      setActionLoading(false);
    }
  };

  const formatItemCount = (purchaseOrder) => {
    return purchaseOrder.purchase_order_item?.length || 0;
  };

  return (
    <div className="space-y-6 text-black relative">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Purchase Order</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar PO yang menunggu acknowledgement atau masih rejected</p>
      </div>

      {loading ? (
        <div className="space-y-4 mt-6">
          <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
          <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-6">
          {error}
        </div>
      ) : purchaseOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500 mt-6">
          Tidak ada purchase order untuk vendor ini.
        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {purchaseOrders.map((po) => (
          <button
            key={po.id}
            type="button"
            onClick={() => openPurchaseOrder(po)}
            className="w-full bg-white rounded-xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-5">
              {/* Icon Container */}
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center transition-colors group-hover:bg-blue-100 shadow-inner border border-blue-100">
                <img
                  src="/ic_listblue.jpg"
                  alt="PO Icon"
                  className="w-8 h-8 object-contain opacity-100 transition-transform group-hover:scale-110"
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-slate-900 text-lg">{po.po_number}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${po.status === "shipped"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-100 text-blue-500"
                      }`}
                  >
                    {po.status}
                  </span>
                </div>
                <div className="text-sm text-slate-400 font-medium">
                  {formatItemCount(po)} Item • {formatDate(po.date)}
                </div>
              </div>
            </div>

            {/* Arrow Icon */}
            <div className="mr-2 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
              <img
                src="/ic_arrow.jpg"
                alt="Arrow Right"
                className="w-6 h-6 object-contain"
              />
            </div>
          </button>
          ))}
        </div>
      )}

      {selectedPurchaseOrder && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6"
          onClick={closePurchaseOrder}
        >
          <div
            className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">PO Detail</h2>
              </div>
              <button
                type="button"
                onClick={closePurchaseOrder}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/60">
                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:col-span-2">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">PO Number</div>
                      <div className="text-slate-900 font-semibold mt-1">{selectedPurchaseOrder.po_number}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Vendor</div>
                      <div className="text-slate-900 font-semibold mt-1">{selectedPurchaseOrder.vendor?.name || 'Vendor'}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Status</div>
                      <div className="text-slate-900 font-semibold mt-1 capitalize">{selectedPurchaseOrder.status}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total</div>
                      <div className="text-slate-900 font-semibold mt-1">{formatCurrency(selectedPurchaseOrder.total_amount)}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:col-span-2">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Date</div>
                      <div className="text-slate-900 font-semibold mt-1">{formatDate(selectedPurchaseOrder.date)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Items</div>
                    <div className="divide-y divide-slate-200">
                      {(selectedPurchaseOrder.purchase_order_item || []).map((item) => (
                        <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-900">{item.item?.name || selectedPurchaseOrderItemLookup.get(String(item.item_id))?.name || `Item ${item.item_id}`}</div>
                            <div className="text-sm text-slate-500">{item.item?.sku || selectedPurchaseOrderItemLookup.get(String(item.item_id))?.sku || '-'} • {item.item?.unit || selectedPurchaseOrderItemLookup.get(String(item.item_id))?.unit || 'pcs'}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">{item.quantity_ordered}</div>
                            <div className="text-sm text-slate-500">Ordered</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {actionError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {actionError}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => updatePurchaseOrderStatus('rejected')}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => updatePurchaseOrderStatus('acknowledged')}
                      className="rounded-xl bg-[#38bdf8] px-4 py-3 font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Acknowledge'}
                    </button>
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
