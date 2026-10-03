import { useEffect, useState } from "react";
import { API, api, inr } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Badge } from "@/components/kit";
import { Download, Trash2, ArrowRightLeft, ListChecks } from "lucide-react";
import { toast } from "sonner";

const MAND = { PENDING: "amber", ACCEPTED: "green", REJECTED: "red", REFUNDED: "muted" };
const ALLOT = { AWAITING: "muted", ALLOTTED: "green", NOT_ALLOTTED: "red", REFUND_INITIATED: "amber" };

export default function Applications() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/applications").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const setStatus = async (id, field, value) => {
    await api.put(`/applications/${id}/status`, { [field]: value });
    load();
  };
  const del = async (id) => { await api.delete(`/applications/${id}`); load(); toast.success("Removed"); };

  const exportXlsx = async () => {
    try {
      const res = await api.get("/applications/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "ipo_applications.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded — bulk upload it to IPO Premium");
    } catch { toast.error("Export failed"); }
  };

  return (
    <Page>
      <PageHeader title="Applications Tracker" subtitle="All placed applications · export Excel for your IPO Premium app"
        action={<Btn data-testid="export-excel-button" variant="accent" disabled={!rows.length} onClick={exportXlsx}><Download className="h-4 w-4" /> Export Excel</Btn>} />

      {rows.length === 0 ? (
        <Card className="text-center py-14 text-muted-foreground"><ListChecks className="h-10 w-10 mx-auto mb-3" />No applications yet. Create a plan in the Planner.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm" data-testid="applications-table">
            <thead><tr className="text-left text-[11px] text-muted-foreground uppercase border-b border-white/10">
              <th className="py-3 px-4">IPO</th><th className="px-3">Investor</th><th className="px-3">PAN</th><th className="px-3">Cat</th>
              <th className="px-3 text-right">Lots</th><th className="px-3 text-right">Amount</th><th className="px-3">UPI</th>
              <th className="px-3">Mandate</th><th className="px-3">Allotment</th><th className="px-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`application-row-${r.id}`}>
                  <td className="py-2.5 px-4 text-white">{r.ipo_name}</td>
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
      )}
    </Page>
  );
}
