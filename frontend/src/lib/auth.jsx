import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { apiError } from "./api";
import { demoUser, isDemoMode } from "./demoData";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=user
  const [checking, setChecking] = useState(true);
  const [demoMode, setDemoMode] = useState(isDemoMode);
  const setupKey = user && user !== false
    ? `nivara_setup_dismissed:${demoMode ? "demo" : user.id || user.email || "workspace"}`
    : null;
  const [setupDismissal, setSetupDismissal] = useState({ key: null, dismissed: false });

  useEffect(() => {
    if (isDemoMode()) {
      setUser(demoUser());
      setChecking(false);
      return;
    }
    const token = localStorage.getItem("nivara_token");
    if (!token) { setUser(false); setChecking(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("nivara_token"); setUser(false); })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!setupKey) {
      setSetupDismissal({ key: null, dismissed: false });
      return;
    }
    let dismissed = false;
    try {
      const storage = demoMode ? window.sessionStorage : window.localStorage;
      dismissed = storage.getItem(setupKey) === "true";
    } catch (_) {}
    setSetupDismissal({ key: setupKey, dismissed });
  }, [setupKey, demoMode]);

  const dismissSetup = useCallback(() => {
    if (!setupKey) return;
    try {
      const storage = demoMode ? window.sessionStorage : window.localStorage;
      storage.setItem(setupKey, "true");
    } catch (_) {}
    setSetupDismissal({ key: setupKey, dismissed: true });
  }, [setupKey, demoMode]);

  const login = useCallback(async (email, password) => {
    try {
      window.sessionStorage.removeItem("nivara_demo_mode");
      setDemoMode(false);
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("nivara_token", data.access_token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiError(e) };
    }
  }, []);

  const logout = useCallback(async () => {
    if (isDemoMode()) {
      window.sessionStorage.removeItem("nivara_demo_mode");
      setDemoMode(false);
      setUser(false);
      window.location.href = "/sitewalkthrough";
      return;
    }
    try { await api.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("nivara_token");
    setUser(false);
    window.location.href = "/login";
  }, []);

  const enterDemo = useCallback(() => {
    window.sessionStorage.setItem("nivara_demo_mode", "true");
    setDemoMode(true);
    setUser(demoUser());
    setChecking(false);
    window.dispatchEvent(new Event("nivara:data-changed"));
  }, []);

  const setupDismissed = !!setupKey && setupDismissal.key === setupKey && setupDismissal.dismissed;
  return <AuthCtx.Provider value={{ user, checking, login, logout, demoMode, enterDemo, setupDismissed, dismissSetup }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
