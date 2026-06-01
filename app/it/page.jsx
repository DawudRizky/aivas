"use client";

import { useEffect, useState } from "react";

const EMPTY_USER = { id: null, name: "", email: "", role: "vendor", vendor_id: "", is_active: true, password: "" };
const EMPTY_VENDOR = { id: null, name: "", contact_info: "", address: "", phone: "", status: "active" };

export default function ItPage() {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, vRes] = await Promise.all([
        fetch("/api/user", { cache: "no-store" }),
        fetch("/api/vendor", { cache: "no-store" }),
      ]);
      const [uData, vData] = await Promise.all([
        uRes.json().catch(() => []),
        vRes.json().catch(() => []),
      ]);
      if (!uRes.ok) throw new Error(uData?.error || `HTTP ${uRes.status}`);
      if (!vRes.ok) throw new Error(vData?.error || `HTTP ${vRes.status}`);
      setUsers(Array.isArray(uData) ? uData : []);
      setVendors(Array.isArray(vData) ? vData : []);
    } catch (err) {
      setError(err?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveUser = async () => {
    setError("");
    setMessage("");
    try {
      const isEdit = Boolean(userForm.id);
      const payload = {
        id: userForm.id || undefined,
        name: userForm.name || null,
        email: userForm.email,
        role: userForm.role,
        vendor_id: userForm.vendor_id ? Number(userForm.vendor_id) : null,
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
      setUserForm(EMPTY_USER);
      await loadAll();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan user.");
    }
  };

  const editUser = (u) => setUserForm({
    id: u.id,
    name: u.name || "",
    email: u.email || "",
    role: u.role || "vendor",
    vendor_id: u.vendor_id || "",
    is_active: Boolean(u.is_active),
    password: "",
  });

  const deleteUser = async (id) => {
    if (!confirm("Hapus user ini?")) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/user?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal hapus user.");
      setMessage("User dihapus.");
      await loadAll();
    } catch (err) {
      setError(err?.message || "Gagal hapus user.");
    }
  };

  const saveVendor = async () => {
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
      setVendorForm(EMPTY_VENDOR);
      await loadAll();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan vendor.");
    }
  };

  const editVendor = (v) => setVendorForm({
    id: v.id,
    name: v.name || "",
    contact_info: v.contact_info || "",
    address: v.address || "",
    phone: v.phone || "",
    status: v.status || "active",
  });

  const deleteVendor = async (id) => {
    if (!confirm("Hapus vendor ini?")) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/vendor?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal hapus vendor.");
      setMessage("Vendor dihapus.");
      await loadAll();
    } catch (err) {
      setError(err?.message || "Gagal hapus vendor.");
    }
  };

  return (
    <div className="space-y-6 text-black">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">IT User & Vendor Management</h1>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat data...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Users</h2>
          <div className="grid grid-cols-1 gap-2 mb-3">
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nama" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="vendor">vendor</option>
              <option value="admin">admin</option>
              <option value="ppic">ppic</option>
              <option value="supervisor">supervisor</option>
              <option value="inbound">inbound</option>
              <option value="it">it</option>
            </select>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={userForm.vendor_id} onChange={(e) => setUserForm({ ...userForm, vendor_id: e.target.value })}>
              <option value="">Tanpa vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="password" placeholder={userForm.id ? "Password baru (opsional)" : "Password"} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            <label className="text-sm text-slate-600">
              <input type="checkbox" className="mr-2" checked={userForm.is_active} onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })} />
              Aktif
            </label>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={saveUser} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">{userForm.id ? "Update User" : "Create User"}</button>
            <button onClick={() => setUserForm(EMPTY_USER)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">Reset</button>
          </div>
          <div className="space-y-2 max-h-[320px] overflow-auto">
            {users.map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="font-semibold text-slate-900">{u.name || "-"}</div>
                <div className="text-slate-600">{u.email} • {u.role} • {u.is_active ? "active" : "inactive"}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => editUser(u)} className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold">Edit</button>
                  <button onClick={() => deleteUser(u.id)} className="px-2 py-1 rounded bg-red-500 text-white text-xs font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Vendors</h2>
          <div className="grid grid-cols-1 gap-2 mb-3">
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nama vendor" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Contact info" value={vendorForm.contact_info} onChange={(e) => setVendorForm({ ...vendorForm, contact_info: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Address" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Phone" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={vendorForm.status} onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={saveVendor} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">{vendorForm.id ? "Update Vendor" : "Create Vendor"}</button>
            <button onClick={() => setVendorForm(EMPTY_VENDOR)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">Reset</button>
          </div>
          <div className="space-y-2 max-h-[320px] overflow-auto">
            {vendors.map((v) => (
              <div key={v.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="font-semibold text-slate-900">{v.name}</div>
                <div className="text-slate-600">{v.phone || "-"} • {v.status || "-"}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => editVendor(v)} className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold">Edit</button>
                  <button onClick={() => deleteVendor(v.id)} className="px-2 py-1 rounded bg-red-500 text-white text-xs font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
