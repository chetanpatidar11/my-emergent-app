import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inrLakh } from "@/lib/api";
import { Page, PageHeader, Card, Btn } from "@/components/kit";
import { Wallet, Lock, Banknote, Smartphone, Users, TrendingUp, ListChecks, Wand2, CheckCircle2 } from "lucide-react";

const Metric = ({ icon: Icon, label, value, tone = "text-white", testid }) => (
  <Card>
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div data-testid={testid} className={`mt-3 text-2xl font-bold tabnum ${tone}`}>{value}</div>
  </Card>
);

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (!d) return <Page><div className="text-muted-foreground">Loading…</div></Page>;

  return (
    <Page>
      <PageHeader title="Command Dashboard" subtitle="Capital, mandates & IPO operations at a glance"
        action={<Link to="/planner"><Btn data-testid="goto-planner-button"><Wand2 className="h-4 w-4" /> Auto Allocator</Btn></Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Metric icon={Wallet} label="Total Capital" value={inrLakh(d.total_capital)} testid="metric-total-capital" />
        <Metric icon={Lock} label="Blocked Funds" value={inrLakh(d.blocked)} tone="text-yellow-400" testid="metric-blocked-funds" />
        <Metric icon={Banknote} label="Available Liquidity" value={inrLakh(d.available)} tone="text-primary" testid="metric-available-liquidity" />
        <Metric icon={Smartphone} label="Total UPI Mandate Cap" value={inrLakh(d.total_upi_limit)} testid="metric-upi-limit" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
        <Metric icon={Users} label="Investors" value={d.investor_count} testid="metric-investors" />
        <Metric icon={Smartphone} label="UPI Handles" value={d.total_upis} testid="metric-upis" />
        <Metric icon={TrendingUp} label="Open IPOs" value={d.open_ipo_count} tone="text-primary" testid="metric-open-ipos" />
        <Metric icon={ListChecks} label="Applications" value={d.application_count} testid="metric-applications" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <h3 className="font-head text-lg font-semibold text-white mb-4">Funds by Bank</h3>
          <div className="space-y-3">
            {d.per_bank.length === 0 && <p className="text-sm text-muted-foreground">No banks yet. Add one under Banks & UPI.</p>}
            {d.per_bank.map((b) => {
              const pct = b.balance ? Math.min(100, (b.blocked / b.balance) * 100) : 0;
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{b.bank_name}</span>
                    <span className="tabnum text-muted-foreground">{inrLakh(b.available)} free</span>
                  </div>
                  <div className="h-2 mt-1 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <h3 className="font-head text-lg font-semibold text-white mb-4">Allotment</h3>
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <div className="text-2xl font-bold tabnum">{d.allotted_count}</div>
              <div className="text-xs text-muted-foreground">applications allotted</div>
            </div>
          </div>
          <Link to="/applications" className="text-sm text-primary hover:underline mt-4 inline-block">View all applications →</Link>
        </Card>
      </div>
    </Page>
  );
}
