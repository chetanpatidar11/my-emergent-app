import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      toast.success("Welcome to LotNeeti");
      nav("/");
    } catch (err) {
      toast.error(errMsg(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = () => { setEmail("admin@lotneeti.com"); setPassword("admin123"); setMode("login"); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "radial-gradient(120% 120% at 0% 0%, hsl(222 47% 12%), hsl(222 47% 6%))" }}>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-head text-2xl font-extrabold text-white">LotNeeti</span>
        </div>
        <div>
          <h1 className="font-head text-4xl font-extrabold text-white leading-tight">
            Apply IPOs across<br /><span className="text-primary">many UPIs, one plan.</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
            Manage family & friends' demat accounts, auto-allocate applications across UPI handles
            (5 apps / ₹5L each), track blocked funds, and export a bulk-upload Excel for your IPO Premium app.
          </p>
        </div>
        <div className="text-xs text-muted-foreground tabnum">UPI LIMIT ₹5,00,000 · 5 APPLICATIONS / HANDLE</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm card-glass rounded-2xl p-7 fade-up">
          <h2 className="font-head text-2xl font-bold text-white">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">to your operations command center</p>

          <div className="flex gap-2 mt-5 text-sm">
            <button type="button" onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-lg ${mode === "login" ? "bg-primary text-primary-foreground font-semibold" : "bg-white/5 text-muted-foreground"}`}>
              Login
            </button>
            <button type="button" onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-lg ${mode === "register" ? "bg-primary text-primary-foreground font-semibold" : "bg-white/5 text-muted-foreground"}`}>
              Register
            </button>
          </div>

          <div className="space-y-3 mt-5">
            {mode === "register" && (
              <input data-testid="register-name-input" placeholder="Name" value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
            )}
            <input data-testid="login-email-input" type="email" placeholder="Email" value={email} required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
            <input data-testid="login-password-input" type="password" placeholder="Password" value={password} required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
          </div>

          <button data-testid="login-submit-button" disabled={busy} type="submit"
            className="w-full mt-5 bg-primary text-primary-foreground font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button data-testid="demo-credentials-button" type="button" onClick={demo}
            className="w-full mt-2 text-xs text-primary hover:underline">
            Use demo credentials
          </button>
        </form>
      </div>
    </div>
  );
}
