import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Landmark, TrendingUp, Wand2, ListChecks, Wallet, LogOut, Activity,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard-link" },
  { to: "/investors", label: "Investors", icon: Users, id: "nav-investors-link" },
  { to: "/banks", label: "Banks & UPI", icon: Landmark, id: "nav-banks-upi-link" },
  { to: "/ipos", label: "IPOs", icon: TrendingUp, id: "nav-ipo-list-link" },
  { to: "/planner", label: "Planner", icon: Wand2, id: "nav-planner-link" },
  { to: "/applications", label: "Applications", icon: ListChecks, id: "nav-applications-link" },
  { to: "/funds", label: "Funds", icon: Wallet, id: "nav-funds-link" },
];

export default function AppLayout({ children }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r border-white/10 bg-card/60 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-head font-extrabold text-white leading-tight">LotNeeti</div>
            <div className="text-[10px] text-muted-foreground tracking-wide">CROSS-UPI IPO OPS</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                data-testid={n.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <button
            data-testid="logout-button"
            onClick={async () => { await logout(); nav("/login"); }}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
