"use client";

import { useEffect, useState } from "react";

export function getRoleLabel(role) {
  if (!role) return "Guest";
  const knownRoles = {
    admin: "Admin",
    ppic: "PPIC",
    supervisor: "Supervisor",
    vendor: "Vendor",
  };

  if (knownRoles[role]) {
    return knownRoles[role];
  }

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getUserSubtitle(user) {
  if (!user) return "Guest";

  if (user.role === "vendor" && user.vendor?.name) {
    return `Vendor - ${user.vendor.name}`;
  }

  return getRoleLabel(user.role);
}

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
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

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}