import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { Page, PageHeader, Card, Badge } from "@/components/kit";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

const TABS = [["OPEN", "Open"], ["UPCOMING", "Upcoming"], ["CLOSED", "Closed"]];
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export default function IPOs() {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("OPEN");
  useEffect(() => { api.get("/ipos").then((r) => setRows(r.data)); }, []);
  const list = rows.filter((r) => r.status === tab);

  return (
    <Page>
      <PageHeader title="IPO Directory" subtitle="Price band, lot size, GMP and bidding windows" />
      <div className="flex gap-2 mb-5" data-testid="ipo-tabs">
        {TABS.map(([v, l]) => (
          <button key={v} data-testid={`ipo-tab-${v.toLowerCase()}`} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === v ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-white"}`}>
            {l} <span className="opacity-70">({rows.filter((r) => r.status === v).length})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card className="text-center py-14 text-muted-foreground">No {tab.toLowerCase()} IPOs.</Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="ipo-grid">
          {list.map((r) => {
            const up = r.gmp >= 0;
            const minAmt = r.lot_size * r.upper_price;
            return (
              <Card key={r.id} className="space-y-3" data-testid={`ipo-card-${r.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-head font-semibold text-white">{r.issuer_name}</div>
                    <div className="text-xs text-muted-foreground tabnum">{r.symbol}</div>
                  </div>
                  <Badge tone={r.issue_type === "SME" ? "amber" : "blue"}>{r.issue_type}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div><div className="text-[10px] text-muted-foreground uppercase">Price Band</div><div className="text-white tabnum">₹{r.lower_price}–{r.upper_price}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Lot Size</div><div className="text-white tabnum">{r.lot_size}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Min Investment</div><div className="text-white tabnum">{inr(minAmt)}</div></div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">GMP</div>
                    <div className={`tabnum font-semibold flex items-center gap-1 ${up ? "text-primary" : "text-destructive"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} ₹{r.gmp} ({r.gmp_pct}%)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-white/10 pt-2">
                  <Calendar className="h-3 w-3" /> {fmt(r.open_date)} – {fmt(r.close_date)} · Allot {fmt(r.allotment_date)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
