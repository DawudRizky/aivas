"use client";

const LOGOUT_REDIRECT_MARKER = "aivas:logged-out";

export function markLoggedOutRedirect() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOGOUT_REDIRECT_MARKER, "1");
}

export function consumeLoggedOutRedirect() {
  if (typeof window === "undefined") return false;

  const isLoggedOutRedirect = window.sessionStorage.getItem(LOGOUT_REDIRECT_MARKER) === "1";
  if (isLoggedOutRedirect) {
    window.sessionStorage.removeItem(LOGOUT_REDIRECT_MARKER);
  }

  return isLoggedOutRedirect;
}
