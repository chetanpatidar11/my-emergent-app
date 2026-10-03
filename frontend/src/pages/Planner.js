import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errMsg, inr, inrLakh } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Badge } from "@/components/kit";
import { Wand2, AlertTriangle, Zap, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export default function Planner() {
  const [ipos, setIpos] = useState([]);
  const [sel, setSel] = useState({}); // ipo_id -> {category, lots}
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api.get("/ipos").then((r) => setIpos(r.data.filter((i) => i.status === "OPEN"))); }, []);

  const toggle = (ipo) => {
    setPreview(null);
    setSel((s) => {
      const n = { ...s };
      if (n[ipo.id]) delete n[ipo.id];
      else n[ipo.id] = { category: "RETAIL", lots: 1 };
      return n;
    });
  };
  const upd = (id, k, v) => { setPreview(null); setSel((s) => ({ ...s, [id]: { ...s[id], [k]: v } })); };

  const items = () => Object.entries(sel).map(([ipo_id, v]) => ({ ipo_id, category: v.category, lots: Number(v.lots) || 1 }));

  const run = async () => {
    if (!items().length) return toast.error("Select at least one IPO");
    setBusy(true);
    try {
      const { data } = await api.post("/planner/preview", { name: "Plan", items: items() });
      setPreview(data);
      if (!data.rows.length) toast.warning("No applications could be allocated — check funds/UPIs");
    } catch (e) { toast.error(errMsg(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      await api.post("/planner/commit", { name: "Plan " + new Date().toLocaleString("en-IN"), items: items() });
      toast.success("Plan locked & applications created");
      nav("/applications");
    } catch (e) { toast.error(errMsg(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  return (
    <Page>
      <PageHeader title="Smart Cross-UPI Planner" subtitle="Auto-allocate applications across investors & UPI handles (5 apps / ₹5L each)"
        action={<Btn data-testid="auto-allocate-button" onClick={run} disabled={busy}><Zap className="h-4 w-4" /> Auto Allocate</Btn>} />

      <div className="grid lg:grid-cols-2 gap-4" data-testid="planner-ipo-select">
        {ipos.map((i) => {
          const picked = !!sel[i.id];
          return (
            <Card key={i.id} className={picked ? "ring-1 ring-primary" : ""}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={picked} onChange={() => toggle(i)} data-testid={`planner-pick-${i.id}`} className="mt-1" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-head font-semibold text-white">{i.issuer_name}</span>
                    <Badge tone="blue">GMP ₹{i.gmp}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground tabnum mt-0.5">Lot {i.lot_size} · ₹{i.lower_price}–{i.upper_price} · {fmt(i.open_date)}</div>
                  {picked && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <select data-testid={`planner-category-${i.id}`} value={sel[i.id].category} onChange={(e) => upd(i.id, "category", e.target.value)}
                        className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                        <option value="RETAIL">Retail</option><option value="SHNI">sHNI</option><option value="BHNI">bHNI</option>
                      </select>
                      <input type="number" min="1" data-testid={`planner-lots-${i.id}`} value={sel[i.id].lots} onChange={(e) => upd(i.id, "lots", e.target.value)}
                        className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="Lots" />
                      <div className="col-span-2 text-[11px] text-muted-foreground tabnum">
                        ₹ per application: {inr((Number(sel[i.id].lots) || 1) * i.lot_size * i.upper_price)}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </Card>
          );
        })}
      </div>

      {preview && (
        <Card className="mt-6" >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="font-head text-lg font-semibold text-white">Allocation Preview</h3>
              <p className="text-xs text-muted-foreground">{preview.count} applications · total blocked {inrLakh(preview.total)}</p>
            </div>
            <Btn data-testid="lock-plan-button" onClick={commit} disabled={!preview.rows.length || busy}>Lock Plan & Create Applications</Btn>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="mb-4 space-y-1">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-yellow-400"><AlertTriangle className="h-3 w-3" /> {w}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="preview-table">
              <thead><tr className="text-left text-[11px] text-muted-foreground uppercase border-b border-white/10">
                <th className="py-2 pr-3">IPO</th><th className="pr-3">Investor</th><th className="pr-3">PAN</th><th className="pr-3">Cat</th>
                <th className="pr-3 text-right">Lots</th><th className="pr-3 text-right">Amount</th><th className="pr-3">UPI</th><th>Bank</th>
              </tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">{r.ipo_name}</td>
                    <td className="pr-3 text-white">{r.investor_name}</td>
                    <td className="pr-3 tabnum text-muted-foreground">{r.pan}</td>
                    <td className="pr-3"><Badge tone="blue">{r.category}</Badge></td>
                    <td className="pr-3 text-right tabnum">{r.lots}</td>
                    <td className="pr-3 text-right tabnum text-white">{inr(r.amount)}</td>
                    <td className="pr-3 tabnum text-xs">
                      {r.upi_handle} {r.cross_funded && <ArrowRightLeft className="h-3 w-3 inline text-accent" title="Cross-funded" />}
                    </td>
                    <td className="tabnum text-xs text-muted-foreground">{r.bank_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {ipos.length === 0 && <Card className="text-center py-14 text-muted-foreground"><Wand2 className="h-8 w-8 mx-auto mb-2" />No open IPOs to plan right now.</Card>}
    </Page>
  );
}
