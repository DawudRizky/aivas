"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

const PO_STATUS_GROUPS = [
  {
    key: "pending",
    label: "Pending",
    description: "PO baru dibuat dan menunggu vendor",
    className: "bg-slate-100 text-slate-700",
  },
  {
    key: "in_progress",
    label: "In Progress",
    description: "Vendor sudah menerima dan sedang memproses",
    className: "bg-blue-100 text-blue-700",
  },
  {
    key: "received",
    label: "Received",
    description: "Barang sudah diterima inbound",
    className: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "needs_attention",
    label: "Needs Attention",
    description: "PO bermasalah, dibatalkan, atau ditolak",
    className: "bg-rose-100 text-rose-700",
  },
];

const PO_STATUS_DEFINITIONS = [
  { key: "submitted", label: "Submitted", group: "pending" },
  { key: "acknowledged", label: "Acknowledged", group: "in_progress" },
  { key: "shipped", label: "Shipped", group: "in_progress" },
  { key: "received", label: "Received", group: "received" },
  { key: "rejected", label: "Rejected", group: "needs_attention" },
  { key: "cancelled", label: "Cancelled", group: "needs_attention" },
];

const PO_STATUS_ALIASES = {
  draft: "submitted",
  created: "submitted",
  open: "submitted",
  pending: "submitted",
  submitted: "submitted",
  sent: "submitted",
  sent_to_vendor: "submitted",
  acknowledged: "acknowledged",
  confirmed: "acknowledged",
  accepted: "acknowledged",
  approved: "acknowledged",
  shipped: "shipped",
  in_transit: "shipped",
  dispatched: "shipped",
  on_way: "shipped",
  received: "received",
  completed: "received",
  closed: "received",
  verified: "received",
  done: "received",
  rejected: "rejected",
  declined: "rejected",
  refused: "rejected",
  cancelled: "cancelled",
  canceled: "cancelled",
  void: "cancelled",
};

function normalizePoStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return PO_STATUS_ALIASES[value] || "submitted";
}

function getPoStatusMeta(status) {
  const key = normalizePoStatus(status);
  const definition = PO_STATUS_DEFINITIONS.find((group) => group.key === key) || PO_STATUS_DEFINITIONS[0];
  const group = PO_STATUS_GROUPS.find((item) => item.key === definition.group) || PO_STATUS_GROUPS[0];

  return {
    ...definition,
    className: group.className,
    groupLabel: group.label,
  };
}

function formatPoPeriod(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}-${year}`;
}

function getVendorInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  const initials = parts.map((part) => part[0]).join("").toUpperCase();
  const fallback = String(name || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  return initials || fallback || "V";
}

function buildModalItemRow(id) {
  return {
    id,
    item_id: "",
    sku: "",
    item_name: "",
    item_query: "",
    qty: "",
    unit_price: "",
    source_id: "",
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getVendorItemCandidates(items, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return items;

  const exactMatches = items.filter((item) => {
    const label = normalizeText(item.label);
    const sku = normalizeText(item.sku);
    const name = normalizeText(item.item_name);
    return label === normalizedQuery || sku === normalizedQuery || name === normalizedQuery;
  });

  if (exactMatches.length > 0) return exactMatches;

  return items.filter((item) => {
    const label = normalizeText(item.label);
    const sku = normalizeText(item.sku);
    const name = normalizeText(item.item_name);
    return label.includes(normalizedQuery) || sku.includes(normalizedQuery) || name.includes(normalizedQuery);
  });
}

function getNextPoNumber(orders, vendorName, date = new Date()) {
  const initials = getVendorInitials(vendorName);
  const period = formatPoPeriod(date);
  const prefix = `PO-${initials}-${period}-`;
  const pattern = new RegExp(`^PO-${initials}-${period}-(\\d{4})$`, "i");

  const nextSequence = orders.reduce((highest, order) => {
    const match = String(order?.po_number || "").match(pattern);
    if (!match) return highest;

    const parsedSequence = Number(match[1]);
    return Number.isFinite(parsedSequence) ? Math.max(highest, parsedSequence) : highest;
  }, 0);

  return `${prefix}${String(nextSequence + 1).padStart(4, "0")}`;
}

export default function PpicPurchaseOrderPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [vendorsMaster, setVendorsMaster] = useState([]);
  const [itemSources, setItemSources] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeItemPickerId, setActiveItemPickerId] = useState(null);
  const nextModalItemIdRef = useRef(2);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isVendorOpen, setIsVendorOpen] = useState(false);
  const [modalItems, setModalItems] = useState([buildModalItemRow("item-1")]);
  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState(null);
  const vendorRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (vendorRef.current && !vendorRef.current.contains(event.target)) setIsVendorOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch('/api/vendor').then((r) => r.json()).catch(() => []),
      fetch('/api/purchase-order').then((r) => r.json()).catch(() => []),
      fetch('/api/item-source').then((r) => r.json()).catch(() => []),
      fetch('/api/purchase-order-item').then((r) => r.json()).catch(() => []),
    ]).then(([vendors, purchaseOrders, sources, poItems]) => {
      if (!mounted) return;
      setVendorsMaster(Array.isArray(vendors) ? vendors : []);
      setOrders(Array.isArray(purchaseOrders) ? purchaseOrders : []);
      setItemSources(Array.isArray(sources) ? sources : []);
      setPurchaseOrderItems(Array.isArray(poItems) ? poItems : []);
      if (Array.isArray(vendors) && vendors.length > 0 && !selectedVendor) setSelectedVendor(vendors[0]);
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const formatRupiah = (number) => new Intl.NumberFormat("id-ID").format(number);
  const selectedVendorItems = useMemo(() => {
    if (!selectedVendor?.id) return [];

    return itemSources
      .filter((source) => Number(source.vendor?.id || source.vendor_id) === Number(selectedVendor.id))
      .map((source) => ({
        source_id: source.id,
        item_id: source.item?.id || source.item_id,
        sku: source.item?.sku || "",
        item_name: source.item?.name || "",
        label: `${source.item?.name || ""}${source.item?.sku ? ` • ${source.item.sku}` : ""}`,
        unit: source.item?.unit || "pcs",
        unit_price: Number(source.unit_price || source.item?.unit_price || 0),
      }))
      .filter((row) => row.item_id)
      .sort((left, right) => String(left.item_name).localeCompare(String(right.item_name)));
  }, [itemSources, selectedVendor]);

  const generatedPoNumber = useMemo(() => {
    if (!selectedVendor?.name) return "PO-XXXX-mm-yyyy-0001";
    return getNextPoNumber(orders, selectedVendor.name, new Date());
  }, [orders, selectedVendor]);

  const editingPurchaseOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(editingPurchaseOrderId)) || null,
    [orders, editingPurchaseOrderId],
  );

  const displayedPoNumber = editingPurchaseOrder?.po_number || generatedPoNumber;

  const totalAmount = modalItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unit_price || 0), 0);
  const selectedItemIds = useMemo(() => new Set(modalItems.map((item) => String(item.item_id || "")).filter(Boolean)), [modalItems]);

  const statusSummary = useMemo(() => {
    const initialCounts = PO_STATUS_GROUPS.reduce((accumulator, group) => {
      accumulator[group.key] = 0;
      return accumulator;
    }, {});

    const counts = orders.reduce((accumulator, order) => {
      const key = normalizePoStatus(order?.status);
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {
      submitted: 0,
      acknowledged: 0,
      shipped: 0,
      received: 0,
      rejected: 0,
      cancelled: 0,
    });

    const pending = counts.submitted;
    const inProgress = counts.acknowledged + counts.shipped;
    const completed = counts.received;
    const needsAttention = counts.rejected + counts.cancelled;

    return {
      total: orders.length,
      pending,
      inProgress,
      completed,
      needsAttention,
      counts,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const statusKey = normalizePoStatus(order?.status);
      const vendorName = order?.vendor && typeof order.vendor === 'object' ? String(order.vendor.name || '') : String(order?.vendor || '');
      const searchTarget = [order?.po_number, order?.id, vendorName, order?.date, order?.status].join(' ').toLowerCase();
      const matchesSearch = !query || searchTarget.includes(query);
      const matchesStatus = statusFilter === 'all' || statusKey === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const handleVendorSelect = (vendor) => {
    if (editingPurchaseOrderId !== null) return;
    setSelectedVendor(vendor);
    setIsVendorOpen(false);
    nextModalItemIdRef.current = 2;
    setModalItems([buildModalItemRow("item-1")]);
    setActiveItemPickerId(null);
  };

  const openCreateModal = () => {
    setEditingPurchaseOrderId(null);
    setSelectedVendor(vendorsMaster[0] || null);
    nextModalItemIdRef.current = 2;
    setModalItems([buildModalItemRow("item-1")]);
    setActiveItemPickerId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (purchaseOrder) => {
    if (!purchaseOrder) return;

    const normalizedStatus = normalizePoStatus(purchaseOrder.status);
    if (!(normalizedStatus === "submitted")) {
      return;
    }

    const vendor = vendorsMaster.find((entry) => Number(entry.id) === Number(purchaseOrder.vendor_id)) || purchaseOrder.vendor || null;
    const orderItems = purchaseOrderItems.filter((row) => Number(row.purchase_order_id) === Number(purchaseOrder.id));

    setEditingPurchaseOrderId(purchaseOrder.id);
    setSelectedVendor(vendor || null);
    nextModalItemIdRef.current = Math.max(2, orderItems.length + 1);
    setModalItems(
      orderItems.length > 0
        ? orderItems.map((row, index) => ({
            id: `item-${index + 1}`,
            item_id: String(row.item?.id || row.item_id || ""),
            sku: row.item?.sku || "",
            item_name: row.item?.name || "",
            item_query: `${row.item?.name || ""}${row.item?.sku ? ` • ${row.item.sku}` : ""}`,
            qty: String(row.quantity_ordered ?? ""),
            unit_price: Number(row.unit_price ?? row.item?.unit_price ?? 0),
            source_id: "",
          }))
        : [buildModalItemRow("item-1")],
    );
    setActiveItemPickerId(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchaseOrderId(null);
    setActiveItemPickerId(null);
  };

  const handleAddItem = () => {
    if (!selectedVendor?.id) {
      alert("Pilih vendor terlebih dahulu.");
      return;
    }

    setModalItems((current) => [...current, buildModalItemRow(`item-${nextModalItemIdRef.current++}`)]);
  };

  const handleRemoveItem = (id) => setModalItems(modalItems.filter((item) => item.id !== id));
  const handleItemChange = (id, field, value) => {
    setModalItems((current) => {
      if (field === "item_query") {
        return current.map((item) => (item.id === id ? {
          ...item,
          item_query: value,
          item_id: "",
          source_id: "",
          sku: "",
          item_name: "",
          unit_price: "",
        } : item));
      }

      if (field === "qty") {
        if (value === "") {
          return current.map((item) => (item.id === id ? { ...item, qty: "" } : item));
        }

        const parsedQty = Number(value);
        return current.map((item) => (item.id === id ? { ...item, qty: Number.isFinite(parsedQty) && parsedQty > 0 ? String(parsedQty) : item.qty } : item));
      }

      return current.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    });
  };

  const handleItemSelect = (id, option) => {
    setModalItems((current) => {
      const duplicateSelection = current.some((item) => String(item.id) !== String(id) && String(item.item_id || "") === String(option.item_id));
      if (duplicateSelection) {
        alert("Item ini sudah dipilih di baris lain.");
        return current;
      }

      return current.map((item) => (item.id === id ? {
        ...item,
        item_id: String(option.item_id),
        source_id: option.source_id || "",
        sku: option.sku || "",
        item_name: option.item_name || "",
        item_query: option.label || "",
        unit_price: option.unit_price ?? "",
      } : item));
    });
  };

  const handleSubmitPO = (e) => {
    e.preventDefault();
    if (!selectedVendor?.id) {
      alert("Vendor wajib dipilih.");
      return;
    }

    const validItems = modalItems
      .filter((item) => String(item.item_id || "").trim() !== "")
      .map((item) => ({
        item_id: Number(item.item_id),
        quantity_ordered: Number(item.qty || 0),
        unit_price: Number(item.unit_price || 0),
      }))
      .filter((item) => Number.isFinite(item.item_id) && item.quantity_ordered > 0 && item.unit_price >= 0);

    if (validItems.length === 0) {
      alert("Minimal 1 item vendor harus dipilih.");
      return;
    }

    const payload = {
      id: editingPurchaseOrder?.id || null,
      po_number: displayedPoNumber,
      vendor_id: selectedVendor?.id,
      total_amount: totalAmount,
      items: validItems,
    };

    fetch('/api/purchase-order', {
      method: editingPurchaseOrder ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || d.message || 'Gagal membuat PO');
        return d;
      })
      .then((res) => {
        const inserted = res?.data && Array.isArray(res.data) ? res.data[0] : null;
        const today = new Date();
        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

        const newOrder = inserted
          ? {
              id: inserted.po_number || inserted.id || payload.po_number,
              status: inserted.status || 'submitted',
              vendor: selectedVendor?.name || '',
              items: validItems.length,
              date: inserted.date ? new Date(inserted.date).toLocaleDateString('id-ID') : formattedDate,
            }
          : {
              id: payload.po_number,
              status: 'submitted',
              vendor: selectedVendor?.name || '',
              items: validItems.length,
              date: formattedDate,
            };

        setOrders((prev) => {
          if (editingPurchaseOrder) {
            return prev.map((order) => (String(order.id) === String(editingPurchaseOrder.id) ? { ...order, ...newOrder } : order));
          }
          return [newOrder, ...prev];
        });
        closeModal();
        nextModalItemIdRef.current = 2;
        setModalItems([buildModalItemRow("item-1")]);
      })
      .catch((err) => {
        alert(err?.message || 'Gagal membuat PO');
      });
  };

  const handleDeletePO = async (purchaseOrder) => {
    if (!purchaseOrder) return;

    const normalizedStatus = normalizePoStatus(purchaseOrder.status);
    if (normalizedStatus !== "submitted") {
      alert("PO hanya bisa dihapus saat status Pending/Submitted.");
      return;
    }

    if (!window.confirm(`Hapus PO ${purchaseOrder.po_number || purchaseOrder.id}?`)) return;

    try {
      const response = await fetch('/api/purchase-order', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: purchaseOrder.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || 'Gagal menghapus PO');

      setOrders((prev) => prev.filter((order) => String(order.id) !== String(purchaseOrder.id)));
    } catch (error) {
      alert(error?.message || 'Gagal menghapus PO');
    }
  };

  return (
    <div className="space-y-6 text-black">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Order</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola Dokumen Purchase Order</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#38bdf8] hover:bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Buat PO Baru
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{statusSummary.pending}</p>
            <p className="mt-1 text-xs text-slate-500">Submitted dan menunggu vendor</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">In progress</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{statusSummary.inProgress}</p>
            <p className="mt-1 text-xs text-blue-600/80">Acknowledged dan shipped</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Received</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{statusSummary.completed}</p>
            <p className="mt-1 text-xs text-emerald-600/80">Sudah masuk inbound</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Needs attention</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{statusSummary.needsAttention}</p>
            <p className="mt-1 text-xs text-rose-600/80">Rejected dan cancelled</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Search</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor PO, vendor, status, atau tanggal"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
            />
          </div>
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Detailed status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
            >
              <option value="all">All statuses</option>
              {PO_STATUS_GROUPS.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((po) => {
          const statusMeta = getPoStatusMeta(po.status);
          const normalizedStatus = normalizePoStatus(po.status);
          const vendorName = po.vendor && (po.vendor.name || typeof po.vendor === 'string') ? (po.vendor.name || po.vendor) : '';
          const canManage = normalizedStatus === 'submitted';

          return (
            <div
              key={po.id}
              className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#38bdf8" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h3 className="font-bold text-slate-800 text-sm">{po.po_number || po.id}</h3>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium truncate">
                  {vendorName}
                  {po.items ? ` • ${po.items} item` : ''} {po.date ? ` • ${po.date}` : ''}
                </p>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(po)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePO(po)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
            Tidak ada PO yang cocok dengan pencarian atau filter saat ini.
          </div>
        )}
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans text-slate-800">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col max-h-[95vh] shadow-2xl relative animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-[#0f8bfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-xl font-bold text-slate-800">{editingPurchaseOrder ? 'Edit Purchase Order' : 'Buat Purchase Order Baru'}</h2>
                </div>
                  <p className="text-sm text-slate-500">
                    {editingPurchaseOrder
                      ? 'Perbarui item yang tersedia untuk vendor ini. PO hanya bisa diedit saat status Pending/Submitted.'
                      : 'Pilih vendor, lalu item yang tersedia untuk vendor tersebut. Nomor PO dibuat otomatis.'}
                  </p>
              </div>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 text-[#0f8bfd] rounded-lg flex items-center justify-center font-bold text-lg">#</div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5">Nomor PO (auto-generated)</p>
                      <p className="text-[15px] font-bold text-blue-700 tracking-wide break-all">{displayedPoNumber}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100/50 text-[#0f8bfd] text-xs font-semibold rounded-full">Auto</span>
                </div>

              <div className="space-y-2 relative" ref={vendorRef}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Vendor
                </label>
                  <div
                    onClick={() => {
                      if (editingPurchaseOrderId !== null) return;
                      setIsVendorOpen(!isVendorOpen);
                    }}
                    className={`w-full border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-white ${editingPurchaseOrderId !== null ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-blue-400'}`}
                  >
                    <div className="text-[15px] font-medium text-slate-800">{selectedVendor ? selectedVendor.name : 'Pilih vendor...'}</div>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isVendorOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>

                  {isVendorOpen && editingPurchaseOrderId === null && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                      {vendorsMaster.map((vendor) => (
                        <div
                          key={vendor.id}
                          onClick={() => handleVendorSelect(vendor)}
                          className={`px-4 py-2.5 cursor-pointer text-sm hover:bg-slate-50 ${selectedVendor?.id === vendor.id ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          {vendor.name}
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <hr className="border-slate-100" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Item Pesanan</h3>
                  <button type="button" onClick={handleAddItem} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Tambah Item
                  </button>
                </div>

                <div className="space-y-4">
                  {modalItems.map((item, index) => (
                    <div key={item.id} className="border border-slate-100 bg-slate-50/50 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-500 tracking-wider">Item #{index + 1}</span>
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        <div className="md:col-span-6 relative">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Item/SKU</label>
                          <input
                            type="text"
                            value={item.item_query ?? ""}
                            onFocus={() => setActiveItemPickerId(item.id)}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setActiveItemPickerId((current) => (current === item.id ? null : current));
                              }, 120);
                            }}
                            onChange={(e) => {
                              setActiveItemPickerId(item.id);
                              handleItemChange(item.id, 'item_query', e.target.value);
                            }}
                            placeholder="Pilih Item/SKU"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white text-slate-800"
                            disabled={!selectedVendor?.id || selectedVendorItems.length === 0}
                            autoComplete="off"
                          />
                          {activeItemPickerId === item.id && selectedVendor?.id && selectedVendorItems.length > 0 && (() => {
                            const options = getVendorItemCandidates(
                              selectedVendorItems.filter((option) => !selectedItemIds.has(String(option.item_id)) || String(item.item_id) === String(option.item_id)),
                              item.item_query,
                            );

                            if (options.length === 0) {
                              return (
                                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-xl">
                                  Tidak ada Item/SKU yang cocok.
                                </div>
                              );
                            }

                            return (
                              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                {options.map((option) => (
                                  <button
                                    key={option.source_id}
                                    type="button"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      handleItemSelect(item.id, option);
                                      setActiveItemPickerId(null);
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 ${selectedItemIds.has(String(option.item_id)) && String(item.item_id) !== String(option.item_id) ? 'opacity-50' : ''}`}
                                    disabled={selectedItemIds.has(String(option.item_id)) && String(item.item_id) !== String(option.item_id)}
                                  >
                                    <span className="font-medium text-slate-800">{option.item_name}</span>
                                    <span className="text-xs text-slate-400">{option.sku || '-'}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          {item.sku ? <p className="mt-1 text-[11px] text-slate-400">SKU: {item.sku}</p> : null}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.qty}
                            onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white text-slate-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Harga Satuan (IDR)</label>
                          <div className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700">
                            Rp {formatRupiah(item.unit_price || 0)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right mt-3 text-[13px]">
                        <span className="text-slate-500 mr-2">Subtotal:</span>
                        <span className="font-bold text-slate-800">Rp {formatRupiah(Number(item.qty || 0) * Number(item.unit_price || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 space-y-4">
              <div className="bg-[#0f8bfd] rounded-xl p-4 flex items-center justify-between text-white shadow-lg shadow-blue-500/20">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  <span className="font-semibold text-sm">Total Amount</span>
                </div>
                <div className="text-xl font-bold">Rp {formatRupiah(totalAmount)}</div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Batal
                </button>
                <button type="button" onClick={handleSubmitPO} className="px-5 py-2.5 bg-[#0f8bfd] hover:bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md flex items-center gap-2 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  {editingPurchaseOrder ? 'Simpan PO' : 'Buat PO'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
