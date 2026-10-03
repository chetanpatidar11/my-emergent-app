import { useEffect, useState } from "react";
import { api, inr, errMsg } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Badge } from "@/components/kit";
import { TrendingUp, TrendingDown, Calendar, RefreshCw, Activity } from "lucide-react";
import { toast } from "sonner";

const TABS = [["OPEN", "Open"], ["UPCOMING", "Upcoming"], ["CLOSED", "Closed"], ["LISTED", "Listed"]];
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");

export default function IPOs() {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("OPEN");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/ipos").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/ipos/refresh");
      await load();
      toast.success(`Live GMP refreshed — ${data.synced} IPOs updated`);
    } catch (e) {
      toast.error(errMsg(e.response?.data?.detail) || "Refresh failed");
    } finally { setBusy(false); }
  };

  const list = rows.filter((r) => r.status === tab);
  const isLive = rows.some((r) => r.source === "investorgain");
  const updated = rows.find((r) => r.updated_on)?.updated_on;

  return (
    <Page>
      <PageHeader title="IPO Directory"
        subtitle="Live price band, lot size, GMP & subscription — powered by the grey-market feed"
        action={<Btn data-testid="refresh-gmp-button" onClick={refresh} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh Live GMP
        </Btn>} />

      <div className="flex items-center gap-2 mb-4 text-xs">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-primary" data-testid="live-badge">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span>
            LIVE FEED
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground"><Activity className="h-3 w-3" /> Sample data</span>
        )}
        {updated && <span className="text-muted-foreground tabnum">· GMP updated {updated}</span>}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap" data-testid="ipo-tabs">
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
            const hasGmp = Number(r.gmp) !== 0;
            const minAmt = r.lot_size * r.upper_price;
            const band = r.lower_price === r.upper_price ? `₹${r.upper_price}` : `₹${r.lower_price}–${r.upper_price}`;
            return (
              <Card key={r.id} className="space-y-3" data-testid={`ipo-card-${r.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-head font-semibold text-white leading-snug">{r.issuer_name}</div>
                  <Badge tone={r.issue_type === "SME" ? "amber" : "blue"}>{r.issue_type}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div><div className="text-[10px] text-muted-foreground uppercase">Price</div><div className="text-white tabnum">{band}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Lot Size</div><div className="text-white tabnum">{r.lot_size}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Min Investment</div><div className="text-white tabnum">{inr(minAmt)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Subscription</div>
                    <div className="tabnum font-semibold text-accent" data-testid={`ipo-sub-${r.id}`}>{r.subscription || "—"}</div></div>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">GMP</div>
                    <div data-testid={`ipo-gmp-${r.id}`}
                      className={`tabnum font-semibold flex items-center gap-1 ${!hasGmp ? "text-muted-foreground" : up ? "text-primary" : "text-destructive"}`}>
                      {hasGmp && (up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                      {hasGmp ? `₹${r.gmp} (${r.gmp_pct}%)` : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabnum">
                    <Calendar className="h-3 w-3" /> {fmt(r.open_date)}–{fmt(r.close_date)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
