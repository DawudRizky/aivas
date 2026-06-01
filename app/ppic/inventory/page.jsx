"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

export default function PpicInventoryPage() {
  const UNIT_OPTIONS = ["pcs", "box", "kg", "liter"];
  const [items, setItems] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("new-item");

  const buildSourceLine = (vendorId = "") => ({
    source_id: null,
    vendor_id: vendorId,
    unit_price: "",
  });

  const [form, setForm] = useState({
    item_id: "",
    name: "",
    unit: "pcs",
    description: "",
    low_stock_threshold: 10,
    sources: [buildSourceLine("")],
  });

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [itemSourceRes, inventoryRes, vendorRes] = await Promise.all([
        fetch("/api/item-source"),
        fetch("/api/inventory-record"),
        fetch("/api/vendor"),
      ]);

      const [itemSourceData, inventoryData, vendorData] = await Promise.all([
        itemSourceRes.json().catch(() => []),
        inventoryRes.json().catch(() => []),
        vendorRes.json().catch(() => []),
      ]);

      setInventoryRecords(Array.isArray(inventoryData) ? inventoryData : []);
      setVendors(Array.isArray(vendorData) ? vendorData : []);

      const grouped = new Map();
      (Array.isArray(itemSourceData) ? itemSourceData : []).forEach((row) => {
        const item = row.item || {};
        const itemId = item.id || row.item_id;
        if (!itemId) return;

        if (!grouped.has(itemId)) {
          grouped.set(itemId, {
            item,
            sources: [],
            stockRows: [],
          });
        }

        grouped.get(itemId).sources.push(row);
      });

      (Array.isArray(inventoryData) ? inventoryData : []).forEach((row) => {
        const item = row.item || {};
        const itemId = item.id || row.item_id;
        if (!itemId) return;

        if (!grouped.has(itemId)) {
          grouped.set(itemId, {
            item,
            sources: [],
            stockRows: [],
          });
        }

        grouped.get(itemId).stockRows.push(row);
      });

      setItems(Array.from(grouped.values()));
    } catch (loadError) {
      setError(loadError?.message || "Gagal memuat inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await loadData();
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const totalItemCount = items.length;
  const totalStock = useMemo(
    () => inventoryRecords.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [inventoryRecords],
  );

  const getItemStock = (entry) => entry.stockRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  const getStockStatus = (entry) => {
    const item = entry.item || {};
    const stock = getItemStock(entry);
    const threshold = Number(item.low_stock_threshold || 0);

    if (stock <= 0) return "no-stock";
    if (stock <= threshold) return "low-stock";
    return "in-stock";
  };

  const stockStatusRank = { "no-stock": 0, "low-stock": 1, "in-stock": 2 };


  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items
      .map((entry) => ({
        ...entry,
        stock: getItemStock(entry),
        stockStatus: getStockStatus(entry),
      }))
      .filter((entry) => {
        const item = entry.item || {};
        const sourceVendorIds = entry.sources.map((source) => String(source.vendor?.id || source.vendor_id || ""));
        const sourceVendorNames = entry.sources.map((source) => String(source.vendor?.name || "")).join(" ").toLowerCase();

        const matchesQuery =
          !query ||
          String(item.name || "").toLowerCase().includes(query) ||
          String(item.sku || "").toLowerCase().includes(query) ||
          sourceVendorNames.includes(query);

        const matchesVendor = vendorFilter === "all" || sourceVendorIds.includes(vendorFilter);
        const matchesStockFilter = stockFilter === "all" || entry.stockStatus === stockFilter;

        return matchesQuery && matchesVendor && matchesStockFilter;
      })
      .sort((a, b) => {
        const statusDiff = stockStatusRank[a.stockStatus] - stockStatusRank[b.stockStatus];
        if (statusDiff !== 0) return statusDiff;
        return String(a.item?.name || "").localeCompare(String(b.item?.name || ""));
      });
  }, [items, search, vendorFilter, stockFilter]);

  const resetForm = () => {
    setForm({
      item_id: "",
      name: "",
      unit: "pcs",
      description: "",
      low_stock_threshold: 10,
      sources: [buildSourceLine("")],
    });
    setMode("new-item");
  };

  const openNewItem = () => {
    resetForm();
    setMode("new-item");
    setModalOpen(true);
  };

  const openEditItem = (entry) => {
    const item = entry.item || {};
    const sourceLines = (entry.sources || []).map((source) => ({
      source_id: source.id || null,
      vendor_id: String(source.vendor?.id || source.vendor_id || ""),
      unit_price: source.unit_price ?? item.unit_price ?? "",
    }));

    setMode("edit-item");
    setForm({
      item_id: item.id || "",
      name: item.name || "",
      unit: item.unit || "pcs",
      description: item.description || "",
      low_stock_threshold: item.low_stock_threshold ?? 10,
      sources: sourceLines.length > 0 ? sourceLines : [buildSourceLine("")],
    });
    setModalOpen(true);
  };

  const updateSourceLine = (index, field, value) => {
    setForm((current) => ({
      ...current,
      sources: current.sources.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addSourceLine = () => {
    setForm((current) => ({
      ...current,
      sources: [...current.sources, buildSourceLine("")],
    }));
  };

  const removeSourceLine = (index) => {
    setForm((current) => {
      if (current.sources.length <= 1) return current;
      return {
        ...current,
        sources: current.sources.filter((_, rowIndex) => rowIndex !== index),
      };
    });
  };

  const saveItem = async (event) => {
    event.preventDefault();

    if ((mode === "new-item" || mode === "edit-item") && !form.name) {
      alert("Nama item wajib diisi.");
      return;
    }

    const cleanedSources = (form.sources || [])
      .filter((row) => String(row.vendor_id || "").trim() !== "")
      .map((row) => ({
        source_id: row.source_id || null,
        vendor_id: Number(row.vendor_id),
        unit_price: row.unit_price,
      }));

    if (cleanedSources.length === 0) {
      alert('Minimal 1 vendor harus dipilih.');
      return;
    }

    if (cleanedSources.some((row) => String(row.unit_price).trim() === "")) {
      alert('Harga vendor wajib diisi untuk setiap vendor.');
      return;
    }

    const normalizedSources = cleanedSources.map((row) => ({
      ...row,
      unit_price: Number(row.unit_price),
    }));

    if (normalizedSources.some((row) => Number.isNaN(row.unit_price) || row.unit_price < 0)) {
      alert('Harga vendor tidak valid.');
      return;
    }

    const vendorSet = new Set(normalizedSources.map((row) => row.vendor_id));
    if (vendorSet.size !== normalizedSources.length) {
      alert('Vendor tidak boleh duplikat.');
      return;
    }

    setSaving(true);

    try {
      const defaultUnitPrice = normalizedSources[0]?.unit_price || 0;
      const payload = {
        item_id: mode === "edit-item" ? Number(form.item_id) : undefined,
        item: (mode === "new-item" || mode === "edit-item")
          ? {
              name: form.name,
              unit: form.unit,
              description: form.description,
              unit_price: defaultUnitPrice,
              low_stock_threshold: form.low_stock_threshold === "" ? null : Number(form.low_stock_threshold),
            }
          : undefined,
        sources: normalizedSources,
      };

      let response;
      if (mode === "edit-item") {
        response = await fetch("/api/item-source", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/item-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Gagal menyimpan inventory");

      setModalOpen(false);
      resetForm();
      await loadData();
    } catch (saveError) {
      alert(saveError?.message || "Gagal menyimpan inventory");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Hapus item ini? Data yang sudah dipakai transaksi tidak bisa dihapus.")) return;

    try {
      const response = await fetch("/api/item-source", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Gagal menghapus item");
      await loadData();
    } catch (deleteError) {
      alert(deleteError?.message || "Gagal menghapus item");
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola item, vendor pembelian, harga per unit, dan stok lokasi.</p>
        </div>
        <button
          type="button"
          onClick={openNewItem}
          className="flex items-center gap-2 bg-[#38bdf8] hover:bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Item
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Item</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{totalItemCount}</p>
            <p className="mt-1 text-xs text-slate-500">Jumlah jenis item terdaftar</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Total Stok</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{totalStock}</p>
            <p className="mt-1 text-xs text-blue-600/80">Total fisik barang di gudang</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Low Stok</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{items.filter((entry) => getStockStatus(entry) === "low-stock").length}</p>
            <p className="mt-1 text-xs text-amber-600/80">Item di bawah ambang batas</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">No Stok</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{items.filter((entry) => getStockStatus(entry) === "no-stock").length}</p>
            <p className="mt-1 text-xs text-rose-600/80">Item dengan stok kosong</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama item, SKU, vendor..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
            >
              <option value="all">All vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">STOK</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
            >
              <option value="all">Semua</option>
              <option value="in-stock">Normal</option>
              <option value="low-stock">Low Stok</option>
              <option value="no-stock">No Stok</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">Loading inventory...</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
          Tidak ada item yang cocok dengan pencarian atau filter saat ini.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((entry) => {
            const item = entry.item || {};
            const totalStockForItem = entry.stock;
            const stockStatus = entry.stockStatus;
            const lowStockThreshold = Number(item.low_stock_threshold || 0);
            const isExpanded = expandedItemId === item.id;
            const cardClass = stockStatus === "no-stock"
              ? "border-rose-200 bg-rose-50"
              : stockStatus === "low-stock"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-100 bg-white";
            const stockValueClass = stockStatus === "no-stock"
              ? "text-rose-700"
              : stockStatus === "low-stock"
                ? "text-amber-700"
                : "text-slate-900";

            return (
              <div key={item.id} className={`rounded-2xl border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ${cardClass}`}>
                <button
                  type="button"
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold text-slate-900">{item.name}</h2>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${stockStatus === "no-stock" ? "bg-rose-100 text-rose-700" : stockStatus === "low-stock" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {stockStatus === "no-stock" ? "No Stok" : stockStatus === "low-stock" ? "Low Stok" : "Normal"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.sku || '-'}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stok</p>
                      <p className={`text-xl font-black ${stockValueClass}`}>{totalStockForItem}</p>
                    </div>
                    <svg className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-600">{item.description || 'Tidak ada deskripsi.'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                          Batas Low Stok: {lowStockThreshold}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditItem(entry)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
                        >
                          Edit Item
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(item.id)}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          Delete Item
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Vendor Sources</p>
                        <div className="mt-3 space-y-3">
                          {entry.sources.length === 0 ? (
                            <p className="text-sm text-slate-500">Belum ada vendor source.</p>
                          ) : entry.sources.map((source) => (
                            <div key={source.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">{source.vendor?.name || 'Vendor'}</p>
                                  <p className="text-xs text-slate-500">Harga vendor: Rp {formatRupiah(source.unit_price)}</p>
                                </div>
                                <div />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock by Location</p>
                        <div className="mt-3 space-y-2">
                          {entry.stockRows.length === 0 ? (
                            <p className="text-sm text-slate-500">Belum ada stok inventory.</p>
                          ) : entry.stockRows.map((row) => (
                            <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{row.location || 'Unknown'}</p>
                                <p className="text-[11px] text-slate-500">Reserved {row.reserved_qty || 0}</p>
                              </div>
                              <p className="text-sm font-bold text-slate-900">{row.quantity || 0}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Inventory</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {mode === 'edit-item' ? 'Edit Item' : 'Tambah Item Baru'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Lengkapi data item beserta vendor dan harga per vendor.
                </p>
              </div>
              <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={saveItem} className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nama Item</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((current) => ({ ...current, unit: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Deskripsi</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Batas Low Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={form.low_stock_threshold}
                    onChange={(e) => setForm((current) => ({ ...current, low_stock_threshold: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">Vendor & Harga</label>
                    <button
                      type="button"
                      onClick={addSourceLine}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      + Tambah Vendor
                    </button>
                  </div>

                  <div className="space-y-2">
                    {form.sources.map((line, index) => (
                      <div key={`vendor-line-${index}`} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]">
                        <select
                          value={line.vendor_id}
                          onChange={(e) => updateSourceLine(index, "vendor_id", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                        >
                          <option value="">Pilih vendor</option>
                          {vendors.map((vendor) => {
                            const vendorId = String(vendor.id);
                            const selectedByOtherRow = form.sources.some((row, rowIndex) => rowIndex !== index && String(row.vendor_id || "") === vendorId);
                            return (
                              <option key={vendor.id} value={vendor.id} disabled={selectedByOtherRow}>
                                {vendor.name}
                              </option>
                            );
                          })}
                        </select>

                        <input
                          type="number"
                          min="0"
                          placeholder="Harga vendor"
                          value={line.unit_price}
                          onChange={(e) => updateSourceLine(index, "unit_price", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                        />

                        <button
                          type="button"
                          onClick={() => removeSourceLine(index)}
                          disabled={form.sources.length <= 1}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); resetForm(); }}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0f8bfd] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-600 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
