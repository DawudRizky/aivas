"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const statusOrder = {
  acknowledged: 0,
  shipped: 1,
  received: 2,
};

const getVendorInitials = (vendorName) => {
  const initials = String(vendorName || "Vendor")
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "V";
};

const getMonthYearToken = (dateValue = new Date()) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${year}`;
};

const getDeliveryOrderSequence = (prefix, deliveryOrders = []) => {
  const pattern = new RegExp(`^${prefix}-(\\d{4})$`);

  return deliveryOrders.reduce((highestSequence, deliveryOrder) => {
    const match = String(deliveryOrder?.do_number || "").match(pattern);
    if (!match) return highestSequence;

    const sequence = Number(match[1]);
    return Number.isFinite(sequence) && sequence > highestSequence ? sequence : highestSequence;
  }, 0);
};

const buildDoNumber = (purchaseOrder, deliveryOrders = []) => {
  const vendorInitials = getVendorInitials(purchaseOrder?.vendor?.name || purchaseOrder?.vendor_name);
  const monthYearToken = getMonthYearToken(new Date());
  const prefix = `DO-${vendorInitials}-${monthYearToken}`;
  const nextSequence = String(getDeliveryOrderSequence(prefix, deliveryOrders) + 1).padStart(4, "0");

  return `${prefix}-${nextSequence}`;
};

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

const createItemLookup = (items = []) => new Map(items.map((item) => [String(item.id), item]));

const hydratePurchaseOrders = (purchaseOrders = [], itemLookup = new Map()) =>
  purchaseOrders.map((purchaseOrder) => ({
    ...purchaseOrder,
    purchase_order_item: (purchaseOrder.purchase_order_item || []).map((orderItem) => ({
      ...orderItem,
      item: orderItem.item || itemLookup.get(String(orderItem.item_id)) || null,
    })),
  }));

const hydrateDeliveryOrders = (deliveryOrders = [], itemLookup = new Map()) =>
  deliveryOrders.map((deliveryOrder) => ({
    ...deliveryOrder,
    delivery_order_item: (deliveryOrder.delivery_order_item || []).map((orderItem) => ({
      ...orderItem,
      item: orderItem.item || itemLookup.get(String(orderItem.item_id)) || null,
    })),
  }));

const resolveOrderItem = (orderItem, itemLookup = new Map()) => {
  const resolvedItem = orderItem?.item || itemLookup.get(String(orderItem?.item_id)) || null;

  return {
    name: resolvedItem?.name || orderItem?.name || `Item ${orderItem?.item_id || "-"}`,
    sku: resolvedItem?.sku || orderItem?.sku || "-",
    unit: resolvedItem?.unit || orderItem?.unit || "pcs",
  };
};

const sumQuantityByItem = (entries = [], qtyKey = "quantity") => {
  const summary = new Map();

  entries.forEach((entry) => {
    const itemId = Number(entry?.item_id);
    const quantity = Number(entry?.[qtyKey] ?? 0);

    if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(quantity) || quantity < 0) {
      return;
    }

    summary.set(itemId, (summary.get(itemId) || 0) + quantity);
  });

  return summary;
};

export default function ShipmentClient() {
  const searchParams = useSearchParams();
  const initialPoNumber = searchParams.get("po") || "";
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePurchaseOrderId, setActivePurchaseOrderId] = useState(null);
  const [expandedEntryId, setExpandedEntryId] = useState(null);
  const [doNumber, setDoNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dismissedAutoOpenPoRef = useRef("");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [purchaseOrderResponse, deliveryOrderResponse, itemResponse] = await Promise.all([
          fetch("/api/purchase-order?include_all=1", { cache: "no-store" }),
          fetch("/api/delivery-order", { cache: "no-store" }),
          fetch("/api/item", { cache: "no-store" }),
        ]);

        const [purchaseOrderData, deliveryOrderData, itemData] = await Promise.all([
          purchaseOrderResponse.json().catch(() => []),
          deliveryOrderResponse.json().catch(() => []),
          itemResponse.json().catch(() => []),
        ]);

        if (!mounted) return;

        const normalizedItems = Array.isArray(itemData) ? itemData : [];
        const itemLookup = createItemLookup(normalizedItems);

        setItems(normalizedItems);
        setPurchaseOrders(hydratePurchaseOrders(Array.isArray(purchaseOrderData) ? purchaseOrderData : [], itemLookup));
        setDeliveryOrders(hydrateDeliveryOrders(Array.isArray(deliveryOrderData) ? deliveryOrderData : [], itemLookup));
      } catch {
        if (!mounted) return;
        setPurchaseOrders([]);
        setDeliveryOrders([]);
        setItems([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((purchaseOrder) => Number(purchaseOrder.id) === Number(activePurchaseOrderId)) || null,
    [activePurchaseOrderId, purchaseOrders]
  );

  const itemLookup = useMemo(() => {
    return new Map(items.map((item) => [String(item.id), item]));
  }, [items]);

  const selectedDeliveryOrder = useMemo(() => {
    if (!selectedPurchaseOrder) return null;
    return deliveryOrders.find((deliveryOrder) => Number(deliveryOrder.purchase_order_id) === Number(selectedPurchaseOrder.id)) || null;
  }, [deliveryOrders, selectedPurchaseOrder]);

  const selectedPurchaseOrderItems = useMemo(() => selectedPurchaseOrder?.purchase_order_item || [], [selectedPurchaseOrder]);

  const purchaseOrderItemById = useMemo(() => {
    const lookup = new Map();

    selectedPurchaseOrderItems.forEach((orderItem) => {
      const itemId = Number(orderItem?.item_id ?? orderItem?.item?.id);
      if (!Number.isFinite(itemId) || itemId <= 0) return;

      lookup.set(itemId, {
        item_id: itemId,
        quantity_ordered: Number(orderItem.quantity_ordered || 0),
        ...resolveOrderItem(orderItem, itemLookup),
      });
    });

    return lookup;
  }, [itemLookup, selectedPurchaseOrderItems]);

  const combinedEntries = useMemo(() => {
    const entries = [];

    purchaseOrders.forEach((purchaseOrder) => {
      const deliveryOrder = deliveryOrders.find((item) => Number(item.purchase_order_id) === Number(purchaseOrder.id)) || null;
      const status = String(deliveryOrder?.status || purchaseOrder.status || "submitted").toLowerCase();

      if (!["acknowledged", "shipped", "received"].includes(status) && !deliveryOrder) {
        return;
      }

      entries.push({
        id: `po-${purchaseOrder.id}`,
        status,
        purchaseOrder,
        deliveryOrder,
        sortOrder: statusOrder[status] ?? 99,
        createdAt: deliveryOrder?.shipped_at || purchaseOrder.date || deliveryOrder?.created_at || null,
      });
    });

    return entries.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      const leftDate = new Date(left.createdAt || 0).getTime();
      const rightDate = new Date(right.createdAt || 0).getTime();
      return rightDate - leftDate;
    });
  }, [deliveryOrders, purchaseOrders]);

  useEffect(() => {
    if (!initialPoNumber || activePurchaseOrderId) return;
    if (dismissedAutoOpenPoRef.current === initialPoNumber) return;

    const match = purchaseOrders.find((purchaseOrder) => purchaseOrder.po_number === initialPoNumber && purchaseOrder.status === "acknowledged");
    if (match) {
      setActivePurchaseOrderId(match.id);
    }
  }, [activePurchaseOrderId, initialPoNumber, purchaseOrders]);

  useEffect(() => {
    if (!initialPoNumber) return;

    dismissedAutoOpenPoRef.current = "";
  }, [initialPoNumber]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setDoNumber("");
      setCarrier("");
      setTrackingNumber("");
      setDeliveryItems([]);
      return;
    }

    setDoNumber(selectedDeliveryOrder?.do_number || buildDoNumber(selectedPurchaseOrder, deliveryOrders));
    setCarrier(selectedDeliveryOrder?.carrier || "");
    setTrackingNumber(selectedDeliveryOrder?.tracking_number || "");
    setSubmitError("");
    setSubmitSuccess("");

    setDeliveryItems(
      (selectedPurchaseOrder.purchase_order_item || []).map((orderItem, index) => ({
        key: orderItem.id || `${selectedPurchaseOrder.id}-${index}`,
        item_id: orderItem.item_id ?? orderItem.item?.id ?? null,
        qty: String(orderItem.quantity_ordered ?? 0),
      }))
    );
  }, [itemLookup, selectedDeliveryOrder, selectedPurchaseOrder]);

  const openPurchaseOrderPopup = (purchaseOrder) => {
    setActivePurchaseOrderId(purchaseOrder.id);
    setSubmitError("");
    setSubmitSuccess("");
  };

  const closePurchaseOrderPopup = (keepSuccess = false) => {
    if (submitting) return;

    if (initialPoNumber) {
      dismissedAutoOpenPoRef.current = initialPoNumber;
    }

    setActivePurchaseOrderId(null);
    setDoNumber("");
    setCarrier("");
    setTrackingNumber("");
    setDeliveryItems([]);
    setSubmitError("");
    if (!keepSuccess) {
      setSubmitSuccess("");
    }
  };

  const handleQtyChange = (index, value) => {
    setDeliveryItems((currentItems) =>
      currentItems.map((item, itemIndex) => (itemIndex === index ? { ...item, qty: value } : item))
    );
  };

  const handleAddBox = () => {
    if (!selectedPurchaseOrderItems.length) return;

    const defaultItemId = Number(selectedPurchaseOrderItems[0]?.item_id ?? selectedPurchaseOrderItems[0]?.item?.id ?? 0) || null;

    setDeliveryItems((currentItems) => {
      return [
        ...currentItems,
        {
          key: `box-${Date.now()}-${currentItems.length}`,
          item_id: defaultItemId,
          qty: "1",
        },
      ];
    });
  };

  const handleRemoveBox = (index) => {
    setDeliveryItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleItemChange = (index, value) => {
    const itemId = Number(value);

    setDeliveryItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              item_id: Number.isFinite(itemId) && itemId > 0 ? itemId : null,
            }
          : item
      )
    );
  };

  const poQtyByItem = useMemo(
    () => sumQuantityByItem(selectedPurchaseOrderItems, "quantity_ordered"),
    [selectedPurchaseOrderItems]
  );

  const doQtyByItem = useMemo(
    () =>
      sumQuantityByItem(
        deliveryItems.map((item) => ({
          item_id: item.item_id,
          quantity: Number(item.qty || 0),
        }))
      ),
    [deliveryItems]
  );

  const poTotalQty = useMemo(
    () => Array.from(poQtyByItem.values()).reduce((sum, qty) => sum + qty, 0),
    [poQtyByItem]
  );

  const doTotalQty = useMemo(
    () => Array.from(doQtyByItem.values()).reduce((sum, qty) => sum + qty, 0),
    [doQtyByItem]
  );

  const quantityValidation = useMemo(() => {
    if (!selectedPurchaseOrder) {
      return { isValid: false, message: "Pilih purchase order terlebih dahulu." };
    }

    if (deliveryItems.length === 0) {
      return { isValid: false, message: "Minimal harus ada 1 box di delivery order." };
    }

    const hasInvalidBox = deliveryItems.some((item) => {
      const itemId = Number(item.item_id);
      const qty = Number(item.qty || 0);

      return !Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(qty) || qty <= 0;
    });

    if (hasInvalidBox) {
      return { isValid: false, message: "Setiap box wajib punya item dan qty lebih dari 0." };
    }

    const orderedItemIds = new Set(Array.from(poQtyByItem.keys()));
    const shippedItemIds = new Set(Array.from(doQtyByItem.keys()));

    if (orderedItemIds.size !== shippedItemIds.size) {
      return { isValid: false, message: "Daftar item DO harus sama dengan item pada PO." };
    }

    for (const itemId of orderedItemIds) {
      if (!shippedItemIds.has(itemId)) {
        return { isValid: false, message: "Daftar item DO harus sama dengan item pada PO." };
      }

      const orderedQty = Number(poQtyByItem.get(itemId) || 0);
      const shippedQty = Number(doQtyByItem.get(itemId) || 0);

      if (orderedQty !== shippedQty) {
        return { isValid: false, message: "Qty per item pada DO harus sama persis dengan PO." };
      }
    }

    if (poTotalQty !== doTotalQty) {
      return { isValid: false, message: "Total qty DO harus sama dengan total qty PO." };
    }

    return { isValid: true, message: "Qty DO sudah sesuai dengan PO." };
  }, [deliveryItems, doQtyByItem, doTotalQty, poQtyByItem, poTotalQty, selectedPurchaseOrder]);

  const handleCreateDeliveryOrder = async (event) => {
    event.preventDefault();
    if (!selectedPurchaseOrder || selectedDeliveryOrder) return;

    if (!quantityValidation.isValid) {
      setSubmitError(quantityValidation.message);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/delivery-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          do_number: doNumber,
          purchase_order_id: selectedPurchaseOrder.id,
          vendor_id: selectedPurchaseOrder.vendor_id,
          carrier,
          tracking_number: trackingNumber,
          items: deliveryItems.map((item, index) => ({
            box_number: index + 1,
            item_id: item.item_id ?? item.id ?? null,
            quantity: Number(item.qty || 0),
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat delivery order");
      }

      const createdDeliveryOrder = Array.isArray(data.data) ? data.data[0] : null;
      if (createdDeliveryOrder) {
        const hydratedDeliveryOrder = {
          ...createdDeliveryOrder,
          delivery_order_item: deliveryItems.map((item, index) => ({
            id: `${createdDeliveryOrder.id}-${item.item_id ?? item.id ?? index}-${index}`,
            box_number: index + 1,
            item_id: item.item_id ?? item.id ?? null,
            quantity: Number(item.qty || 0),
            item: {
              id: item.item_id ?? item.id ?? null,
              name: purchaseOrderItemById.get(Number(item.item_id ?? item.id))?.name || `Item ${item.item_id ?? item.id}`,
              sku: purchaseOrderItemById.get(Number(item.item_id ?? item.id))?.sku || "-",
              unit: purchaseOrderItemById.get(Number(item.item_id ?? item.id))?.unit || "pcs",
            },
          })),
        };

        setDeliveryOrders((currentOrders) => [
          hydratedDeliveryOrder,
          ...currentOrders.filter((order) => Number(order.id) !== Number(createdDeliveryOrder.id)),
        ]);
      }

      setSubmitSuccess("Delivery order berhasil dibuat.");
      closePurchaseOrderPopup(true);
    } catch (err) {
      setSubmitError(err?.message || "Gagal membuat delivery order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-black relative">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mt-2">Delivery Orders</h1>
        <p className="text-sm text-slate-500 mt-2">
          Menampilkan DO yang sudah terbentuk dari PO yang telah di-acknowledge.
        </p>
      </div>

      {submitSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {submitSuccess}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            <div className="h-24 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            <div className="h-24 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          </div>
        ) : combinedEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Belum ada delivery order yang dibuat.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {combinedEntries.map((entry) => {
              const purchaseOrder = entry.purchaseOrder;
              const deliveryOrder = entry.deliveryOrder;
              const isAcknowledged = entry.status === "acknowledged" && !deliveryOrder;
              const isExpanded = expandedEntryId === entry.id;
              const itemCount = purchaseOrder.purchase_order_item?.length || 0;
              const entryItemLookup = new Map(
                (purchaseOrder.purchase_order_item || []).map((orderItem) => [String(orderItem.item_id), orderItem.item || null])
              );

              return isAcknowledged ? (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openPurchaseOrderPopup(purchaseOrder)}
                  className="w-full p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-900 text-lg">{purchaseOrder.po_number}</h3>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          acknowledged
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {purchaseOrder.vendor?.name || "Vendor"} • {formatDate(purchaseOrder.date)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {itemCount} ordered item
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <div key={entry.id} className="p-5">
                  <button
                    type="button"
                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-900 text-lg">
                          {deliveryOrder?.do_number || purchaseOrder.po_number}
                        </h3>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          {entry.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        PO {purchaseOrder.po_number} • {purchaseOrder.vendor?.name || "Vendor"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatDate(entry.createdAt)} • {itemCount} item
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-500 sm:text-right">
                      <div>
                        <div className="font-semibold text-slate-800">{deliveryOrder?.delivery_order_item?.length || itemCount} box</div>
                        <div>{deliveryOrder?.carrier || "No carrier"}</div>
                      </div>
                      <svg className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">DO Number</div>
                          <div className="mt-1 font-semibold text-slate-900">{deliveryOrder?.do_number || "Belum ada DO"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Status</div>
                          <div className="mt-1 font-semibold text-slate-900 capitalize">{entry.status}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Carrier</div>
                          <div className="mt-1 font-semibold text-slate-900">{deliveryOrder?.carrier || "-"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Tracking</div>
                          <div className="mt-1 font-semibold text-slate-900 break-all">{deliveryOrder?.tracking_number || "-"}</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Detail Item</div>
                        <div className="divide-y divide-slate-200">
                          {(deliveryOrder?.delivery_order_item || purchaseOrder.purchase_order_item || []).map((item, index) => (
                            <div key={item.id || `${entry.id}-${index}`} className="flex items-start justify-between gap-4 p-4 text-sm">
                              <div>
                                <div className="font-semibold text-slate-900">{resolveOrderItem(item, entryItemLookup).name}</div>
                                <div className="text-slate-500">{resolveOrderItem(item, entryItemLookup).sku} • {resolveOrderItem(item, entryItemLookup).unit}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-slate-900">{item.quantity_shipped ?? item.quantity_received ?? item.quantity_ordered ?? item.quantity ?? "-"}</div>
                                <div className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Qty</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedPurchaseOrder ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm px-4 py-6 flex items-center justify-center lg:left-64 lg:w-[calc(100vw-16rem)]"
          onClick={closePurchaseOrderPopup}
        >
          <div
            className="w-full max-w-6xl rounded-[2rem] bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create DO</h2>
              </div>
              <button
                type="button"
                onClick={closePurchaseOrderPopup}
                className="h-10 w-10 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                aria-label="Close modal"
              >
                X
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
              <section className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-6 md:p-8">
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Status</div>
                      <div className="text-slate-900 font-semibold mt-1 capitalize">{selectedPurchaseOrder.status}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total</div>
                      <div className="text-slate-900 font-semibold mt-1">{formatCurrency(selectedPurchaseOrder.total_amount)}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4 sm:col-span-2">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Vendor</div>
                      <div className="text-slate-900 font-semibold mt-1">{selectedPurchaseOrder.vendor?.name || "Vendor"}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">PO Number</div>
                      <div className="text-slate-900 font-semibold mt-1">{selectedPurchaseOrder.po_number}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Date</div>
                      <div className="text-slate-900 font-semibold mt-1">{formatDate(selectedPurchaseOrder.date)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Ordered items</div>
                    <div className="divide-y divide-slate-200">
                      {(selectedPurchaseOrder.purchase_order_item || []).map((item) => (
                        <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-900">{resolveOrderItem(item, itemLookup).name}</div>
                            <div className="text-sm text-slate-500">{resolveOrderItem(item, itemLookup).sku} • {resolveOrderItem(item, itemLookup).unit}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">{item.quantity_ordered}</div>
                            <div className="text-sm text-slate-500">Ordered</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="p-6 md:p-8 bg-white">
                <form onSubmit={handleCreateDeliveryOrder} className="space-y-5">
                  {submitError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  ) : null}

                  {selectedDeliveryOrder ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      DO untuk PO ini sudah dibuat: {selectedDeliveryOrder.do_number}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">DO Number</span>
                    <input
                      type="text"
                      value={doNumber}
                      readOnly
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Carrier</span>
                      <input
                        type="text"
                        value={carrier}
                        onChange={(event) => setCarrier(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Tracking Number</span>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(event) => setTrackingNumber(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Boxes</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBox}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#38bdf8] hover:text-[#0284c7]"
                      >
                        + Add Box
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                      {deliveryItems.map((item, index) => (
                        <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <img src="/ic_boxblue.jpg" alt="Box Icon" className="w-5 h-5 object-contain mix-blend-multiply" />
                              <div className="font-semibold text-slate-800">BOX-{String(index + 1).padStart(3, "0")}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveBox(index)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.7fr]">
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item</span>
                              <select
                                value={item.item_id || ""}
                                onChange={(event) => handleItemChange(index, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                              >
                                <option value="">Pilih item</option>
                                {selectedPurchaseOrderItems.map((orderItem) => {
                                  const optionItemId = Number(orderItem.item_id ?? orderItem.item?.id);
                                  const optionItem = purchaseOrderItemById.get(optionItemId);

                                  return (
                                    <option key={`${orderItem.id}-${optionItemId}`} value={optionItemId}>
                                      {optionItem?.name || `Item ${optionItemId}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU / Unit</span>
                              <input
                                type="text"
                                value={`${purchaseOrderItemById.get(Number(item.item_id))?.sku || "-"} • ${purchaseOrderItemById.get(Number(item.item_id))?.unit || "pcs"}`}
                                readOnly
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</span>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={item.qty}
                                onChange={(event) => handleQtyChange(index, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <div className="border-b border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Qty Validation (PO vs DO)
                      </div>
                      <div className="divide-y divide-slate-200 text-sm">
                        {selectedPurchaseOrderItems.map((orderItem) => {
                          const itemId = Number(orderItem.item_id ?? orderItem.item?.id);
                          const itemMeta = purchaseOrderItemById.get(itemId);
                          const orderedQty = Number(poQtyByItem.get(itemId) || 0);
                          const doQty = Number(doQtyByItem.get(itemId) || 0);
                          const matched = orderedQty === doQty;

                          return (
                            <div key={`summary-${orderItem.id}-${itemId}`} className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.5fr] gap-3 px-4 py-3 items-center">
                              <div className="font-medium text-slate-800 truncate" title={itemMeta?.name || `Item ${itemId}`}>
                                {itemMeta?.name || `Item ${itemId}`}
                              </div>
                              <div className="text-right text-slate-600">PO: {orderedQty}</div>
                              <div className="text-right text-slate-600">DO: {doQty}</div>
                              <div className={`text-right text-xs font-bold uppercase ${matched ? "text-emerald-600" : "text-rose-600"}`}>
                                {matched ? "OK" : "Mismatch"}
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.5fr] gap-3 px-4 py-3 items-center bg-slate-50">
                          <div className="font-semibold text-slate-900">Total Qty</div>
                          <div className="text-right font-semibold text-slate-700">PO: {poTotalQty}</div>
                          <div className="text-right font-semibold text-slate-700">DO: {doTotalQty}</div>
                          <div className={`text-right text-xs font-bold uppercase ${poTotalQty === doTotalQty ? "text-emerald-600" : "text-rose-600"}`}>
                            {poTotalQty === doTotalQty ? "OK" : "Mismatch"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${quantityValidation.isValid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {quantityValidation.message}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || Boolean(selectedDeliveryOrder) || !quantityValidation.isValid}
                    className="w-full rounded-xl bg-[#38bdf8] px-4 py-3 text-sm font-bold text-white hover:bg-[#0284c7] disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Delivery Order"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
