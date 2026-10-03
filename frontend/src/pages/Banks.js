import { useEffect, useState } from "react";
import { api, errMsg, inr, inrLakh } from "@/lib/api";
import { Page, PageHeader, Card, Btn, Field, Select, Badge, Modal } from "@/components/kit";
import { Plus, Pencil, Trash2, Landmark, Smartphone } from "lucide-react";
import { toast } from "sonner";

export default function Banks() {
  const [rows, setRows] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(null);
  const [balModal, setBalModal] = useState(null);
  const [balOp, setBalOp] = useState({ operation: "ADD", amount: 0 });

  const load = () => Promise.all([api.get("/banks"), api.get("/investors")]).then(([b, i]) => { setRows(b.data); setInvestors(i.data); });
  useEffect(() => { load(); }, []);

  const blank = () => ({
    owner_investor_id: investors[0]?.id || "", bank_name: "", account_number: "", balance: 0,
    upis: [{ handle: "", holder_investor_id: investors[0]?.id || "" }],
  });

  const save = async () => {
    try {
      const payload = { ...form, balance: Number(form.balance), upis: form.upis.filter((u) => u.handle) };
      if (editId) await api.put(`/banks/${editId}`, payload);
      else await api.post("/banks", payload);
      toast.success("Saved"); setOpen(false); load();
    } catch (e) { toast.error(errMsg(e.response?.data?.detail)); }
  };
  const edit = (r) => { setForm({ ...r, upis: r.upis?.length ? r.upis : [{ handle: "", holder_investor_id: r.owner_investor_id }] }); setEditId(r.id); setOpen(true); };
  const del = async (id) => { await api.delete(`/banks/${id}`); load(); toast.success("Deleted"); };
  const invName = (id) => investors.find((i) => i.id === id)?.name || "—";

  const doBalance = async () => {
    await api.post(`/banks/${balModal.id}/balance`, { ...balOp, amount: Number(balOp.amount) });
    setBalModal(null); load(); toast.success("Balance updated");
  };

  const upd = (idx, k, v) => { const u = [...form.upis]; u[idx] = { ...u[idx], [k]: v }; setForm({ ...form, upis: u }); };

  return (
    <Page>
      <PageHeader title="Banks & Cross-UPI Manager" subtitle="Balances and UPI handles — each handle caps at 5 apps / ₹5L"
        action={<Btn data-testid="add-bank-upi-button" disabled={!investors.length} onClick={() => { setForm(blank()); setEditId(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Bank</Btn>} />

      {!investors.length && <Card className="mb-4 text-sm text-yellow-400">Add at least one investor first.</Card>}

      {rows.length === 0 ? (
        <Card className="text-center py-14"><Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No bank accounts yet.</p></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4" data-testid="banks-grid">
          {rows.map((r) => (
            <Card key={r.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-head font-semibold text-white">{r.bank_name}</div>
                  <div className="text-xs text-muted-foreground tabnum">A/C {r.account_number} · {invName(r.owner_investor_id)}</div>
                </div>
                <div className="text-right"><div className="text-lg font-bold text-primary tabnum">{inrLakh(r.balance)}</div><div className="text-[10px] text-muted-foreground">balance</div></div>
              </div>
              <div className="space-y-1.5">
                {r.upis?.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 text-white"><Smartphone className="h-3 w-3 text-accent" /> {u.handle}</span>
                    <Badge tone="blue">{invName(u.holder_investor_id)}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" data-testid={`balance-bank-${r.id}`} onClick={() => { setBalModal(r); setBalOp({ operation: "ADD", amount: 0 }); }}>Adjust Funds</Btn>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => edit(r)}><Pencil className="h-3 w-3" /> Edit</Btn>
                <Btn variant="danger" className="px-3 py-1.5 text-xs" onClick={() => del(r.id)}><Trash2 className="h-3 w-3" /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Bank" : "Add Bank"}>
          <div className="space-y-3">
            <Select label="Owner Investor" data-testid="bank-owner-select" value={form.owner_investor_id} onChange={(e) => setForm({ ...form, owner_investor_id: e.target.value })}>
              {investors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name" data-testid="bank-name-input" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              <Field label="Account Number" data-testid="bank-account-input" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
            <Field label="Current Balance (₹)" type="number" data-testid="bank-balance-input" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">UPI Handles</span>
                <button className="text-xs text-primary" onClick={() => setForm({ ...form, upis: [...form.upis, { handle: "", holder_investor_id: form.owner_investor_id }] })}>+ Add UPI</button>
              </div>
              <div className="space-y-2">
                {form.upis.map((u, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <Field label="UPI ID" data-testid={`bank-upi-input-${idx}`} value={u.handle} onChange={(e) => upd(idx, "handle", e.target.value)} />
                    <Select label="Holder" value={u.holder_investor_id} onChange={(e) => upd(idx, "holder_investor_id", e.target.value)}>
                      {investors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2"><Btn data-testid="save-bank-button" onClick={save} className="flex-1">Save</Btn><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
          </div>
        </Modal>
      )}

      {balModal && (
        <Modal open onClose={() => setBalModal(null)} title={`Adjust Funds — ${balModal.bank_name}`}>
          <div className="text-sm text-muted-foreground mb-3">Current balance: <span className="text-white tabnum">{inr(balModal.balance)}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Operation" value={balOp.operation} onChange={(e) => setBalOp({ ...balOp, operation: e.target.value })}>
              <option value="ADD">Add Money</option><option value="REMOVE">Remove Money</option><option value="SET">Set Balance</option>
            </Select>
            <Field label="Amount (₹)" type="number" data-testid="balance-amount-input" value={balOp.amount} onChange={(e) => setBalOp({ ...balOp, amount: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-4"><Btn data-testid="save-balance-button" onClick={doBalance} className="flex-1">Apply</Btn><Btn variant="ghost" onClick={() => setBalModal(null)}>Cancel</Btn></div>
        </Modal>
      )}
    </Page>
  );
}
