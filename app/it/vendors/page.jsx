"use client";

import { useEffect, useMemo, useState } from "react";

const EMPTY_VENDOR = { id: null, name: "", contact_info: "", address: "", phone: "", status: "active" };

function VendorModal({ open, form, saving, onChange, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">IT Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{form.id ? "Edit Vendor" : "Add Vendor"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900">
            Close
          </button>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Vendor name</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" placeholder="Vendor name" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Contact info</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" placeholder="PIC or email" value={form.contact_info} onChange={(e) => onChange({ ...form, contact_info: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Phone</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" placeholder="Phone number" value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Address</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" placeholder="Vendor address" value={form.address} onChange={(e) => onChange({ ...form, address: e.target.value })} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={saving} className="rounded-2xl bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3c66] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving..." : form.id ? "Update Vendor" : "Create Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ItVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vendor", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "Gagal memuat vendors.");
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      const matchesSearch = !query || [vendor.name, vendor.contact_info, vendor.address, vendor.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, vendors]);

  const openCreateModal = () => {
    setMessage("");
    setError("");
    setVendorForm(EMPTY_VENDOR);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setMessage("");
    setError("");
    setVendorForm({
      id: vendor.id,
      name: vendor.name || "",
      contact_info: vendor.contact_info || "",
      address: vendor.address || "",
      phone: vendor.phone || "",
      status: vendor.status || "active",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setVendorForm(EMPTY_VENDOR);
  };

  const saveVendor = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isEdit = Boolean(vendorForm.id);
      const payload = { ...vendorForm, id: vendorForm.id || undefined };
      const res = await fetch("/api/vendor", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan vendor.");
      setMessage(isEdit ? "Vendor diperbarui." : "Vendor dibuat.");
      setIsModalOpen(false);
      setVendorForm(EMPTY_VENDOR);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan vendor.");
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (id) => {
    if (!confirm("Hapus vendor ini?")) return;

    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/vendor?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal hapus vendor.");
      setMessage("Vendor dihapus.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal hapus vendor.");
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,76,129,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f6f9fc)] shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-7 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_180px] lg:w-[560px]">
              <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="Search by vendor name, contact, address, or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button onClick={openCreateModal} className="inline-flex items-center justify-center rounded-2xl bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3c66]">
              Add Vendor
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Vendor Directory</h2>
            <p className="text-sm text-slate-500">Daftar vendor yang terhubung ke purchase order dan user vendor.</p>
          </div>
          {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
        </div>

        <div className="hidden min-[940px]:block">
          <div className="grid grid-cols-[1.1fr_1fr_0.9fr_1.2fr_0.7fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <span>Vendor</span>
            <span>Contact</span>
            <span>Phone</span>
            <span>Address</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="grid grid-cols-[1.1fr_1fr_0.9fr_1.2fr_0.7fr_0.8fr] gap-4 px-6 py-4 text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{vendor.name}</div>
                  <div className="text-xs text-slate-500">ID #{vendor.id}</div>
                </div>
                <div className="text-slate-600">{vendor.contact_info || "-"}</div>
                <div className="text-slate-600">{vendor.phone || "-"}</div>
                <div className="text-slate-600">{vendor.address || "-"}</div>
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {vendor.status || "inactive"}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEditModal(vendor)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">Edit</button>
                  <button onClick={() => deleteVendor(vendor.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4 min-[940px]:hidden">
          {filteredVendors.map((vendor) => (
            <article key={vendor.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{vendor.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{vendor.contact_info || "No contact info"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {vendor.status || "inactive"}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>{vendor.phone || "-"}</p>
                <p>{vendor.address || "-"}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openEditModal(vendor)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Edit</button>
                <button onClick={() => deleteVendor(vendor.id)} className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white">Delete</button>
              </div>
            </article>
          ))}
        </div>

        {!loading && filteredVendors.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada vendor yang cocok dengan filter saat ini.</div>
        ) : null}
      </section>

      <VendorModal open={isModalOpen} form={vendorForm} saving={saving} onChange={setVendorForm} onClose={closeModal} onSubmit={saveVendor} />
    </div>
  );
}
