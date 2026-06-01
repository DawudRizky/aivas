"use client";

import UserAvatar from "./UserAvatar";
import useCurrentUser, { getUserSubtitle } from "../lib/useCurrentUser";

export default function TopbarUser() {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="h-4 w-28 bg-slate-200 rounded mb-1 animate-pulse" />
          <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="text-sm font-bold text-slate-800 leading-tight">{user?.name ?? 'Not signed in'}</div>
        <div className="text-xs text-slate-500">{getUserSubtitle(user)}</div>
      </div>
      <UserAvatar className="h-9 w-9" />
    </div>
  );
}
