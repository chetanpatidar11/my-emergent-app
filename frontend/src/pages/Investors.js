import { useEffect, useState, useRef } from "react";
import { api, errMsg } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Field, Select, Badge, Modal } from "@/components/kit";
import { Plus, Pencil, Trash2, UserPlus, Upload, Download } from "lucide-react";
import { toast } from "sonner";

const blank = { name: "", pan: "", priority: 1, category_default: "RETAIL", active: true,
  demats: [{ depository: "CDSL", dp_id: "", client_id: "", broker: "" }] };

export default function Investors() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/investors").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editId) await api.put(`/investors/${editId}`, form);
      else await api.post("/investors", form);
      toast.success("Saved");
      setOpen(false); setForm(blank); setEditId(null); load();
    } catch (e) { toast.error(errMsg(e.response?.data?.detail)); }
  };
  const edit = (r) => { setForm({ ...blank, ...r, demats: r.demats?.length ? r.demats : blank.demats }); setEditId(r.id); setOpen(true); };
  const del = async (id) => { await api.delete(`/investors/${id}`); load(); toast.success("Deleted"); };
  const dm = form.demats[0];
  const setDm = (k, v) => setForm({ ...form, demats: [{ ...dm, [k]: v }] });

  const exportFile = async () => {
    try {
      const res = await api.get("/investors/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "DematAccounts.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Accounts exported — this file imports into IPO Premium");
    } catch { toast.error("Export failed"); }
  };

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) { fileRef.current.value = ""; }
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      const { data } = await api.post("/investors/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.created} account(s) · ${data.skipped_duplicates} duplicate PAN skipped${data.invalid ? ` · ${data.invalid} invalid` : ""}`);
      load();
    } catch (err) { toast.error(errMsg(err.response?.data?.detail) || "Import failed"); }
  };

  return (
    <Page>
      <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" data-testid="import-file-input" onChange={importFile} />
      <PageHeader title="Investor Profiles" subtitle="Family & friends — unique PAN, demat accounts and priority"
        action={
          <div className="flex gap-2 flex-wrap">
            <Btn variant="ghost" data-testid="import-accounts-button" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import</Btn>
            <Btn variant="accent" data-testid="export-accounts-button" disabled={!rows.length} onClick={exportFile}><Download className="h-4 w-4" /> Export</Btn>
            <Btn data-testid="add-investor-button" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Investor</Btn>
          </div>
        } />

      {rows.length === 0 ? (
        <Card className="text-center py-14">
          <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No investors yet. Add one, or <button onClick={() => fileRef.current?.click()} className="text-primary hover:underline">import the IPO Premium accounts file</button>.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="investors-grid">
          {rows.map((r) => (
            <Card key={r.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-head font-semibold text-white">{r.name}</div>
                  <div className="text-xs text-muted-foreground tabnum mt-0.5">PAN {r.pan}</div>
                </div>
                <div className="flex gap-1">
                  <Badge tone={r.active ? "green" : "muted"}>{r.active ? "Active" : "Off"}</Badge>
                </div>
              </div>
              <div className="flex gap-2 text-[11px]">
                <Badge tone="blue">{r.category_default}</Badge>
                <Badge>Priority {r.priority}</Badge>
                {r.demats?.[0]?.depository && <Badge tone="amber">{r.demats[0].depository}</Badge>}
              </div>
              {r.demats?.[0]?.dp_id && (
                <div className="text-xs text-muted-foreground tabnum">DP {r.demats[0].dp_id} · Client {r.demats[0].client_id}</div>
              )}
              <div className="flex gap-2 pt-1">
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" data-testid={`edit-investor-${r.id}`} onClick={() => edit(r)}><Pencil className="h-3 w-3" /> Edit</Btn>
                <Btn variant="danger" className="px-3 py-1.5 text-xs" data-testid={`delete-investor-${r.id}`} onClick={() => del(r.id)}><Trash2 className="h-3 w-3" /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Investor" : "Add Investor"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" data-testid="investor-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="PAN" data-testid="investor-pan-input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Default Category" data-testid="investor-category-select" value={form.category_default} onChange={(e) => setForm({ ...form, category_default: e.target.value })}>
              <option value="RETAIL">Retail</option><option value="SHNI">sHNI</option><option value="BHNI">bHNI</option>
            </Select>
            <Field label="Priority (1=highest)" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-xs text-muted-foreground mb-2">Primary Demat Account</div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Depository" value={dm.depository} onChange={(e) => setDm("depository", e.target.value)}>
                <option value="CDSL">CDSL</option><option value="NSDL">NSDL</option>
              </Select>
              <Field label="Broker" value={dm.broker} onChange={(e) => setDm("broker", e.target.value)} />
              <Field label="DP ID" value={dm.dp_id} onChange={(e) => setDm("dp_id", e.target.value)} />
              <Field label="Client ID" value={dm.client_id} onChange={(e) => setDm("client_id", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active for planning
          </label>
          <div className="flex gap-2 pt-2">
            <Btn data-testid="save-investor-button" onClick={save} className="flex-1">Save</Btn>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
