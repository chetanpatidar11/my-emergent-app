import { useEffect, useState } from "react";
import { api, inr, inrLakh } from "@/lib/api";
import { Page, PageHeader, Card } from "@/components/kit";
import { Smartphone, Wallet } from "lucide-react";

export default function Funds() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (!d) return <Page><div className="text-muted-foreground">Loading…</div></Page>;

  return (
    <Page>
      <PageHeader title="Funds & Mandates Monitor" subtitle="Blocked money and per-UPI mandate health" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-bold tabnum text-white mt-2">{inrLakh(d.total_capital)}</div></Card>
        <Card><div className="text-xs text-muted-foreground uppercase">Blocked</div><div className="text-2xl font-bold tabnum text-yellow-400 mt-2">{inrLakh(d.blocked)}</div></Card>
        <Card><div className="text-xs text-muted-foreground uppercase">Available</div><div className="text-2xl font-bold tabnum text-primary mt-2">{inrLakh(d.available)}</div></Card>
      </div>

      <div className="space-y-4" data-testid="funds-banks">
        {d.per_bank.map((b) => (
          <Card key={b.id}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="font-head font-semibold text-white">{b.bank_name}</span><span className="text-xs text-muted-foreground tabnum">A/C {b.account_number}</span></div>
              <div className="text-sm tabnum"><span className="text-muted-foreground">Bal </span><span className="text-white">{inr(b.balance)}</span> · <span className="text-yellow-400">{inr(b.blocked)} blocked</span> · <span className="text-primary">{inr(b.available)} free</span></div>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {b.upis.map((u) => {
                const amtPct = Math.min(100, (u.amount / u.amount_limit) * 100);
                const near = u.count >= u.app_limit || amtPct > 85;
                return (
                  <div key={u.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1 text-white tabnum"><Smartphone className="h-3 w-3 text-accent" />{u.handle}</span><span className={`tabnum ${near ? "text-yellow-400" : "text-muted-foreground"}`}>{u.count}/{u.app_limit}</span></div>
                    <div className="h-1.5 mt-2 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${near ? "bg-yellow-400" : "bg-primary"}`} style={{ width: `${amtPct}%` }} /></div>
                    <div className="text-[10px] text-muted-foreground tabnum mt-1">{inr(u.amount)} / {inrLakh(u.amount_limit)}</div>
                  </div>
                );
              })}
              {b.upis.length === 0 && <div className="text-xs text-muted-foreground">No UPI handles.</div>}
            </div>
          </Card>
        ))}
        {d.per_bank.length === 0 && <Card className="text-center py-10 text-muted-foreground">No banks to monitor.</Card>}
      </div>
    </Page>
  );
}
