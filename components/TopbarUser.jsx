"use client";

import { useEffect, useState } from "react";

export default function TopbarUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setUser(data?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="text-right hidden sm:block">
        <div className="h-4 w-28 bg-slate-200 rounded mb-1 animate-pulse" />
        <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="text-right hidden sm:block">
      <div className="text-sm font-bold text-slate-800 leading-tight">{user?.name ?? 'Not signed in'}</div>
      <div className="text-xs text-slate-500">{user?.vendor?.name ?? user?.role ?? 'Guest'}</div>
    </div>
  );
}
