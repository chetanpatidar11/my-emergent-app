"""Backend tests: bulk mandate/allotment update + bulk delete for /api/applications.

Verifies:
- PUT /api/applications/bulk/status  -> {updated}
- POST /api/applications/bulk/delete  -> {deleted}
- Literal /bulk routes are NOT shadowed by /applications/{aid}/status or /applications/{aid}
- Single-row inline update + delete still work (regression)
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")


# --------- fresh-user fixture with 3 seeded applications ---------
@pytest.fixture(scope="module")
def ctx():
    email = f"bulk_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "Bulk Tester", "email": email, "password": "pw123456"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}

    # Create one investor
    inv = requests.post(f"{BASE_URL}/api/investors", headers=H, json={
        "name": "Alice Bulk", "pan": "ABCPB1234A", "priority": 1,
        "category_default": "RETAIL", "active": True,
        "demats": [{"depository": "NSDL", "dp_id": "IN300000", "client_id": "12345678"}],
    })
    assert inv.status_code == 200, inv.text
    inv_id = inv.json()["id"]

    # Create a bank with a UPI held by the investor
    bank = requests.post(f"{BASE_URL}/api/banks", headers=H, json={
        "owner_investor_id": inv_id,
        "bank_name": "HDFC",
        "account_number": "00001234567890",
        "balance": 5_000_000,
        "upis": [{"handle": "alice@hdfc", "holder_investor_id": inv_id}],
    })
    assert bank.status_code == 200, bank.text

    # Find at least 3 OPEN IPOs
    ipos = requests.get(f"{BASE_URL}/api/ipos", headers=H).json()
    open_ipos = [i for i in ipos if (i.get("status") or "").upper() == "OPEN"]
    if len(open_ipos) < 3:
        # Trigger refresh (may seed demo data)
        requests.post(f"{BASE_URL}/api/ipos/refresh", headers=H)
        ipos = requests.get(f"{BASE_URL}/api/ipos", headers=H).json()
        open_ipos = [i for i in ipos if (i.get("status") or "").upper() == "OPEN"]
    if len(open_ipos) < 3:
        pytest.skip(f"Need >=3 OPEN IPOs to seed; found {len(open_ipos)}")

    # Commit 3 applications (one per IPO)
    items = [{"ipo_id": i["id"], "category": "RETAIL", "lots": 1,
              "investor_ids": [inv_id]} for i in open_ipos[:3]]
    plan = requests.post(f"{BASE_URL}/api/planner/commit", headers=H,
                         json={"name": "BulkPlan", "items": items})
    assert plan.status_code == 200, plan.text
    assert plan.json()["count"] >= 2, f"planner produced too few rows: {plan.json()}"

    apps = requests.get(f"{BASE_URL}/api/applications", headers=H).json()
    assert len(apps) >= 2
    return {"H": H, "apps": apps, "email": email}


# --------- bulk mandate update ---------
def test_bulk_mandate_accepted(ctx):
    H = ctx["H"]
    ids = [a["id"] for a in ctx["apps"][:2]]
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": ids, "mandate_status": "ACCEPTED"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["updated"] == len(ids)

    # Verify persisted
    apps = {a["id"]: a for a in requests.get(f"{BASE_URL}/api/applications", headers=H).json()}
    for i in ids:
        assert apps[i]["mandate_status"] == "ACCEPTED"


# --------- bulk allotment update ---------
def test_bulk_allotment_not_allotted(ctx):
    H = ctx["H"]
    ids = [a["id"] for a in ctx["apps"][:2]]
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": ids, "allotment_status": "NOT_ALLOTTED"})
    assert r.status_code == 200, r.text
    assert r.json()["updated"] == len(ids)

    apps = {a["id"]: a for a in requests.get(f"{BASE_URL}/api/applications", headers=H).json()}
    for i in ids:
        assert apps[i]["allotment_status"] == "NOT_ALLOTTED"


# --------- bulk update accepts both fields together ---------
def test_bulk_both_fields(ctx):
    H = ctx["H"]
    ids = [a["id"] for a in ctx["apps"][:2]]
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": ids, "mandate_status": "REJECTED",
                           "allotment_status": "REFUND_INITIATED"})
    assert r.status_code == 200
    assert r.json()["updated"] == len(ids)
    apps = {a["id"]: a for a in requests.get(f"{BASE_URL}/api/applications", headers=H).json()}
    for i in ids:
        assert apps[i]["mandate_status"] == "REJECTED"
        assert apps[i]["allotment_status"] == "REFUND_INITIATED"


# --------- validation: no ids / no update ---------
def test_bulk_status_requires_ids_and_update(ctx):
    H = ctx["H"]
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": [], "mandate_status": "ACCEPTED"})
    assert r.status_code == 400
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": [ctx["apps"][0]["id"]]})
    assert r.status_code == 400


# --------- route NOT shadowed: /bulk/status is NOT treated as aid='bulk' ---------
def test_bulk_status_route_not_shadowed(ctx):
    """If the dynamic route /applications/{aid}/status captured 'bulk', the server
    would 200 OK with {ok:true}; instead the explicit bulk route must handle it."""
    H = ctx["H"]
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status", headers=H,
                     json={"ids": [ctx["apps"][0]["id"]], "mandate_status": "PENDING"})
    assert r.status_code == 200
    body = r.json()
    assert "updated" in body, f"Expected 'updated' key from bulk route, got {body}"
    assert "ok" not in body  # single-row route returns {ok: True}


# --------- regression: single-row inline update ---------
def test_single_row_update_still_works(ctx):
    H = ctx["H"]
    aid = ctx["apps"][0]["id"]
    r = requests.put(f"{BASE_URL}/api/applications/{aid}/status", headers=H,
                     json={"mandate_status": "ACCEPTED"})
    assert r.status_code == 200
    assert r.json().get("ok") is True


# --------- regression: single-row delete ---------
def test_single_row_delete_still_works(ctx):
    H = ctx["H"]
    # Use the last app so bulk tests have 2 rows to operate on
    aid = ctx["apps"][-1]["id"] if len(ctx["apps"]) >= 3 else None
    if not aid or aid in [a["id"] for a in ctx["apps"][:2]]:
        pytest.skip("Not enough apps to safely test single delete")
    r = requests.delete(f"{BASE_URL}/api/applications/{aid}", headers=H)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    apps = {a["id"] for a in requests.get(f"{BASE_URL}/api/applications", headers=H).json()}
    assert aid not in apps


# --------- bulk delete (run last) ---------
def test_bulk_delete_zzz_last(ctx):
    H = ctx["H"]
    apps_now = requests.get(f"{BASE_URL}/api/applications", headers=H).json()
    ids = [a["id"] for a in apps_now]
    assert len(ids) >= 1
    r = requests.post(f"{BASE_URL}/api/applications/bulk/delete", headers=H,
                      json={"ids": ids})
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == len(ids)
    after = requests.get(f"{BASE_URL}/api/applications", headers=H).json()
    assert all(a["id"] not in ids for a in after)


# --------- bulk delete: empty ids -> 400 ---------
def test_bulk_delete_empty_ids(ctx):
    H = ctx["H"]
    r = requests.post(f"{BASE_URL}/api/applications/bulk/delete", headers=H,
                      json={"ids": []})
    assert r.status_code == 400


# --------- auth required ---------
def test_bulk_endpoints_require_auth():
    r = requests.put(f"{BASE_URL}/api/applications/bulk/status",
                     json={"ids": ["x"], "mandate_status": "ACCEPTED"})
    assert r.status_code == 401
    r = requests.post(f"{BASE_URL}/api/applications/bulk/delete",
                      json={"ids": ["x"]})
    assert r.status_code == 401
