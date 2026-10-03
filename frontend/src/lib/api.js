import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// Primary auth: Bearer token from localStorage (reliable across browsers where the
// SameSite=None session cookie behind the CDN gets dropped). Cookie stays as backup.
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Never let an API rejection become an unhandled promise rejection.
// 401 on a non-auth route means the session is truly gone — clear token and go to login.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error?.config?.url || "";
    const status = error?.response?.status;
    if (status === 401 && !url.includes("/auth/")) {
      localStorage.removeItem("token");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export function errMsg(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && e.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
}

export const inr = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const inrLakh = (n) => {
  n = Number(n || 0);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2) + " L";
  return inr(n);
};
