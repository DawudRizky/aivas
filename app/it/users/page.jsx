"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const EMPTY_USER = { id: null, name: "", email: "", role: "", vendor_id: "", is_active: true, password: "" };
const ROLE_OPTIONS = [
  { value: "it", label: "IT Admin" },
  { value: "ppic", label: "PPIC" },
  { value: "vendor", label: "Vendor" },
  { value: "inbound", label: "Admin Inbound" },
  { value: "supervisor", label: "Supervisor" },
];

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role || "-";
}

function UserModal({ open, form, vendors, saving, onChange, onClose, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowPassword(false);
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6">
      <div className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200 sm:max-h-[calc(100dvh-3rem)]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{form.id ? "Edit User" : "Add User"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white" placeholder="User name" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white" type="email" placeholder="email@company.com" value={form.email} onChange={(e) => onChange({ ...form, email: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Role</span>
            <select
              className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white ${form.role ? "text-slate-900" : "text-slate-500"}`}
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value, vendor_id: e.target.value === "vendor" ? form.vendor_id : "" })}
            >
              <option value="">Pilih role</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Vendor</span>
            <select
              className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 ${form.vendor_id ? "text-slate-900" : "text-slate-500"}`}
              value={form.vendor_id}
              disabled={form.role !== "vendor"}
              onChange={(e) => onChange({ ...form, vendor_id: e.target.value })}
            >
              <option value="">Pilih vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">{form.id ? "Password baru" : "Password"}</span>
            <div className="relative">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                type={showPassword ? "text" : "password"}
                placeholder={form.id ? "Kosongkan jika tidak ingin mengubah password" : "Set password"}
                value={form.password}
                onChange={(e) => onChange({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={form.is_active} onChange={(e) => onChange({ ...form, is_active: e.target.checked })} />
            Active user
          </label>
        </div>

        <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={saving} className="rounded-2xl bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3c66] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving..." : form.id ? "Update User" : "Create User"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ItUsersPage() {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [userRes, vendorRes] = await Promise.all([
        fetch("/api/user", { cache: "no-store" }),
        fetch("/api/vendor", { cache: "no-store" }),
      ]);
      const [userData, vendorData] = await Promise.all([
        userRes.json().catch(() => []),
        vendorRes.json().catch(() => []),
      ]);

      if (!userRes.ok) throw new Error(userData?.error || "Gagal memuat users.");
      if (!vendorRes.ok) throw new Error(vendorData?.error || "Gagal memuat vendors.");

      setUsers(Array.isArray(userData) ? userData : []);
      setVendors(Array.isArray(vendorData) ? vendorData : []);
    } catch (err) {
      setError(err?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = !query || [user.name, user.email, user.role, user.vendor?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? Boolean(user.is_active) : !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const openCreateModal = () => {
    setMessage("");
    setError("");
    setUserForm(EMPTY_USER);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setMessage("");
    setError("");
    setUserForm({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      role: user.role || "",
      vendor_id: user.vendor_id || "",
      is_active: Boolean(user.is_active),
      password: "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setUserForm(EMPTY_USER);
  };

  const saveUser = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isEdit = Boolean(userForm.id);
      const payload = {
        id: userForm.id || undefined,
        name: userForm.name || null,
        email: userForm.email,
        role: userForm.role,
        vendor_id: userForm.role === "vendor" && userForm.vendor_id ? Number(userForm.vendor_id) : null,
        is_active: Boolean(userForm.is_active),
        password: userForm.password || undefined,
      };

      if (!isEdit && !userForm.password) throw new Error("Password wajib diisi untuk user baru.");

      const res = await fetch("/api/user", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan user.");

      setMessage(isEdit ? "User diperbarui." : "User dibuat.");
      setIsModalOpen(false);
      setUserForm(EMPTY_USER);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan user.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("Hapus user ini?")) return;

    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/user?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal hapus user.");
      setMessage("User dihapus.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal hapus user.");
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,76,129,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f6f9fc)] shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-7 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_180px_180px] lg:w-[720px]">
              <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="Search by name, email, role, or vendor" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button onClick={openCreateModal} className="inline-flex items-center justify-center rounded-2xl bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3c66]">
              Add User
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Directory</h2>
            <p className="text-sm text-slate-500">Daftar akun yang bisa mengakses AIVAS.</p>
          </div>
          {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
        </div>

        <div className="hidden min-[940px]:block">
          <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_0.7fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <span>User</span>
            <span>Email</span>
            <span>Role</span>
            <span>Vendor</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <div key={user.id} className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_0.7fr_0.8fr] gap-4 px-6 py-4 text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{user.name || "-"}</div>
                  <div className="text-xs text-slate-500">ID #{user.id}</div>
                </div>
                <div className="text-slate-600">{user.email}</div>
                <div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">{getRoleLabel(user.role)}</span></div>
                <div className="text-slate-600">{user.vendor?.name || "-"}</div>
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEditModal(user)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">Edit</button>
                  <button onClick={() => deleteUser(user.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4 min-[940px]:hidden">
          {filteredUsers.map((user) => (
            <article key={user.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{user.name || "-"}</h3>
                  <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase">
                <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">{getRoleLabel(user.role)}</span>
                <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">{user.vendor?.name || "No vendor"}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openEditModal(user)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Edit</button>
                <button onClick={() => deleteUser(user.id)} className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white">Delete</button>
              </div>
            </article>
          ))}
        </div>

        {!loading && filteredUsers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada user yang cocok dengan filter saat ini.</div>
        ) : null}
      </section>

      <UserModal open={isModalOpen} form={userForm} vendors={vendors} saving={saving} onChange={setUserForm} onClose={closeModal} onSubmit={saveUser} />
    </div>
  );
}
