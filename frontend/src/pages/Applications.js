import { useEffect, useMemo, useState } from "react";
import { api, inr, errMsg } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Badge } from "@/components/kit";
import { Download, Trash2, ArrowRightLeft, ListChecks, X } from "lucide-react";
import { toast } from "sonner";

const MAND = { PENDING: "amber", ACCEPTED: "green", REJECTED: "red", REFUNDED: "muted" };
const ALLOT = { AWAITING: "muted", ALLOTTED: "green", NOT_ALLOTTED: "red", REFUND_INITIATED: "amber" };

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [bulkMand, setBulkMand] = useState("");
  const [bulkAllot, setBulkAllot] = useState("");
  const [ipoFilter, setIpoFilter] = useState("ALL");

  const load = () => api.get("/applications").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const ipoOptions = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { if (!m.has(r.ipo_id)) m.set(r.ipo_id, r.ipo_name); });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const visibleRows = ipoFilter === "ALL" ? rows : rows.filter((r) => r.ipo_id === ipoFilter);
  const allChecked = visibleRows.length > 0 && visibleRows.every((r) => sel.has(r.id));

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (allChecked) visibleRows.forEach((r) => n.delete(r.id));
    else visibleRows.forEach((r) => n.add(r.id));
    return n;
  });
  const clearSel = () => setSel(new Set());

  const setStatus = async (id, field, value) => {
    await api.put(`/applications/${id}/status`, { [field]: value });
    load();
  };
  const del = async (id) => { await api.delete(`/applications/${id}`); setSel((s) => { const n = new Set(s); n.delete(id); return n; }); load(); toast.success("Removed"); };

  const applyBulk = async (field, value) => {
    if (!value || sel.size === 0) return;
    try {
      const { data } = await api.put("/applications/bulk/status", { ids: [...sel], [field]: value });
      toast.success(`Updated ${data.updated} application(s)`);
      setBulkMand(""); setBulkAllot(""); clearSel();
      load();
    } catch (e) { toast.error(errMsg(e.response?.data?.detail) || "Bulk update failed"); }
  };

  const bulkDelete = async () => {
    if (sel.size === 0) return;
    try {
      const { data } = await api.post("/applications/bulk/delete", { ids: [...sel] });
      toast.success(`Deleted ${data.deleted} application(s)`);
      clearSel();
      load();
    } catch (e) { toast.error(errMsg(e.response?.data?.detail) || "Bulk delete failed"); }
  };

  const exportXlsx = async () => {
    try {
      const params = ipoFilter !== "ALL" ? { ipo_id: ipoFilter } : {};
      const res = await api.get("/applications/export", { responseType: "blob", params });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "ipo_accounts.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Accounts Excel downloaded — bulk upload it to IPO Premium");
    } catch { toast.error("Export failed"); }
  };

  return (
    <Page>
      <PageHeader title="Applications Tracker" subtitle="Filter by IPO, bulk-update status, and export the selected IPO's accounts in IPO Premium format"
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <select data-testid="ipo-filter-select" value={ipoFilter} onChange={(e) => setIpoFilter(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary max-w-[220px]">
              <option value="ALL">All IPOs ({rows.length})</option>
              {ipoOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({rows.filter((r) => r.ipo_id === o.id).length})</option>
              ))}
            </select>
            <Btn data-testid="export-excel-button" variant="accent" disabled={!visibleRows.length} onClick={exportXlsx}><Download className="h-4 w-4" /> Export Excel</Btn>
          </div>
        } />

      {rows.length === 0 ? (
        <Card className="text-center py-14 text-muted-foreground"><ListChecks className="h-10 w-10 mx-auto mb-3" />No applications yet. Create a plan in the Planner.</Card>
      ) : (
        <>
          {sel.size > 0 && (
            <Card className="mb-4 p-4 flex items-center gap-3 flex-wrap sticky top-4 z-20" data-testid="bulk-action-bar">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <button onClick={clearSel} data-testid="clear-selection-button" className="text-muted-foreground hover:text-white"><X className="h-4 w-4" /></button>
                {sel.size} selected
              </span>
              <div className="h-5 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mandate →</span>
                <select data-testid="bulk-mandate-select" value={bulkMand}
                  onChange={(e) => { setBulkMand(e.target.value); applyBulk("mandate_status", e.target.value); }}
                  className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary">
                  <option value="">Set…</option><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option><option value="REFUNDED">Refunded</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Allotment →</span>
                <select data-testid="bulk-allotment-select" value={bulkAllot}
                  onChange={(e) => { setBulkAllot(e.target.value); applyBulk("allotment_status", e.target.value); }}
                  className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary">
                  <option value="">Set…</option><option value="AWAITING">Awaiting</option><option value="ALLOTTED">Allotted</option><option value="NOT_ALLOTTED">Not Allotted</option><option value="REFUND_INITIATED">Refund</option>
                </select>
              </div>
              <div className="ml-auto flex gap-2">
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" data-testid="bulk-accept-button" onClick={() => applyBulk("mandate_status", "ACCEPTED")}>Accept all mandates</Btn>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" data-testid="bulk-not-allotted-button" onClick={() => applyBulk("allotment_status", "NOT_ALLOTTED")}>Mark not allotted</Btn>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" data-testid="bulk-refund-button" onClick={() => applyBulk("allotment_status", "REFUND_INITIATED")}>Mark refund</Btn>
                <Btn variant="danger" className="px-3 py-1.5 text-xs" data-testid="bulk-delete-button" onClick={bulkDelete}><Trash2 className="h-3 w-3" /> Delete</Btn>
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm" data-testid="applications-table">
              <thead><tr className="text-left text-[11px] text-muted-foreground uppercase border-b border-white/10">
                <th className="py-3 pl-4 pr-2 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} data-testid="select-all-checkbox" /></th>
                <th className="px-3">IPO</th><th className="px-3">Investor</th><th className="px-3">PAN</th><th className="px-3">Cat</th>
                <th className="px-3 text-right">Lots</th><th className="px-3 text-right">Amount</th><th className="px-3">UPI</th>
                <th className="px-3">Mandate</th><th className="px-3">Allotment</th><th className="px-3"></th>
              </tr></thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 ${sel.has(r.id) ? "bg-primary/5" : ""}`} data-testid={`application-row-${r.id}`}>
                    <td className="pl-4 pr-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} data-testid={`select-app-${r.id}`} /></td>
                    <td className="py-2.5 px-3 text-white">{r.ipo_name}</td>
                    <td className="px-3 text-white">{r.investor_name}</td>
                    <td className="px-3 tabnum text-muted-foreground text-xs">{r.pan}</td>
                    <td className="px-3"><Badge tone="blue">{r.category}</Badge></td>
                    <td className="px-3 text-right tabnum">{r.lots}</td>
                    <td className="px-3 text-right tabnum text-white">{inr(r.amount)}</td>
                    <td className="px-3 tabnum text-xs">{r.upi_handle}{r.cross_funded && <ArrowRightLeft className="h-3 w-3 inline ml-1 text-accent" />}</td>
                    <td className="px-3">
                      <select value={r.mandate_status} onChange={(e) => setStatus(r.id, "mandate_status", e.target.value)}
                        className={`bg-transparent text-xs font-semibold outline-none ${MAND[r.mandate_status] === "green" ? "text-primary" : MAND[r.mandate_status] === "amber" ? "text-yellow-400" : "text-muted-foreground"}`}>
                        <option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option><option value="REFUNDED">Refunded</option>
                      </select>
                    </td>
                    <td className="px-3">
                      <select value={r.allotment_status} onChange={(e) => setStatus(r.id, "allotment_status", e.target.value)}
                        className={`bg-transparent text-xs font-semibold outline-none ${ALLOT[r.allotment_status] === "green" ? "text-primary" : ALLOT[r.allotment_status] === "red" ? "text-destructive" : "text-muted-foreground"}`}>
                        <option value="AWAITING">Awaiting</option><option value="ALLOTTED">Allotted</option><option value="NOT_ALLOTTED">Not Allotted</option><option value="REFUND_INITIATED">Refund</option>
                      </select>
                    </td>
                    <td className="px-3"><button onClick={() => del(r.id)} data-testid={`delete-app-${r.id}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </Page>
  );
}
