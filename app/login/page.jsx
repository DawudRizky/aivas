"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logoutFlag = searchParams.get("loggedOut");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!logoutFlag) return;

    const timer = window.setTimeout(() => {
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setError("");
      setLoading(false);
      setFormKey((value) => value + 1);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [logoutFlag]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'Login gagal')
        }
        return data
      })
      .then((data) => {
        const role = data.user?.role
        if (role === 'supervisor') router.push('/supervisor')
        else if (role === 'admin') router.push('/admin')
        else if (role === 'ppic') router.push('/ppic')
        else if (role === 'it') router.push('/it')
        else if (role === 'vendor') router.push('/vendor')
        else throw new Error('Role user tidak dikenali')
      })
      .catch((err) => {
        setError(err?.message || 'Gagal terhubung ke server')
        setLoading(false)
      })
  };

  return (
    <div className="flex h-screen bg-[#1e3a8a]">
      
      {/* Bagian Kiri (Form Login) - Diubah: w-full md:w-1/2 p-6 */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-gradient-to-tr from-[#eef6ff] via-[#f8fbff] to-white p-6 md:p-0">
        <div className="w-full max-w-sm">
          
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img src="/logoaivas.jpg" alt="AIVAS Logo" className="h-20 object-contain mix-blend-multiply" />
          </div>

          <form key={formKey} onSubmit={handleLogin} autoComplete="on" className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            
            {/* Input Email */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <img 
                    src="/ic_mail.jpg" 
                    alt="Email Icon" 
                    className="w-full h-full object-contain opacity-60" 
                  />
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  name="email"
                  placeholder="Alamat Email"
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm text-gray-700 bg-[#eff6ff] shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Kata Sandi</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <img 
                    src="/ic_key.jpg" 
                    alt="Password Icon" 
                    className="w-full h-full object-contain opacity-60" 
                  />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  name="password"
                  placeholder="Kata Sandi"
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm text-gray-700 bg-[#eff6ff] shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                
                {/* Tombol Show/Hide Password */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform flex items-center justify-center"
                >
                  <img 
                    src="/ic_visability.jpg" 
                    alt="Toggle Visibility" 
                    className={`w-5 h-5 object-contain mix-blend-multiply ${showPassword ? 'opacity-100' : 'opacity-40'}`} 
                  />
                </button>
              </div>
            </div>

            {/* Lupa Password */}
            <div className="flex justify-end">
              <button 
                type="button"
                onClick={() => alert("Silahkan hubungi Admin untuk reset password.")}
                className="text-xs font-semibold text-gray-400 hover:text-blue-600 transition-colors"
              >
                Lupa Password?
              </button>
            </div>

            {/* Button Masuk */}
            <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#3b82f6] to-[#2dd4bf] hover:opacity-90 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? 'Memproses...' : 'Masuk'}
                </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bagian Kanan (Gambar Gedung) - Diubah: ditambahkan hidden md:flex */}
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-[#1a2f4c] to-[#0a4b9c] p-8 items-center justify-center">
        <div className="w-full h-full max-h-[85vh] rounded-3xl overflow-hidden  relative border-4 border-transparent">
          <img 
            src="/gedungepson.jpg" 
            alt="Gedung Epson" 
            className="w-full h-full object-cover rounded-3xl"
          />
        </div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
