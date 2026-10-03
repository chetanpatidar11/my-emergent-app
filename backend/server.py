from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import io
import re
import html
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta, date

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from openpyxl import Workbook

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
UPI_APP_LIMIT = 5
UPI_AMOUNT_LIMIT = 500000

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lotneeti")


# ---------- auth helpers ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_access_token(uid: str, email: str) -> str:
    payload = {"sub": uid, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def set_auth_cookie(resp: Response, token: str):
    resp.set_cookie("access_token", token, httponly=True, secure=True,
                    samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            token = ah[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


# ---------- models ----------
class AuthIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = "User"


class Demat(BaseModel):
    depository: str
    dp_id: str
    client_id: str
    broker: Optional[str] = ""


class InvestorIn(BaseModel):
    name: str
    pan: str
    priority: int = 1
    category_default: str = "RETAIL"
    active: bool = True
    demats: List[Demat] = []


class UPIIn(BaseModel):
    id: Optional[str] = None
    handle: str
    holder_investor_id: Optional[str] = None


class BankIn(BaseModel):
    owner_investor_id: str
    bank_name: str
    account_number: str
    balance: float = 0
    upis: List[UPIIn] = []


class BalanceOp(BaseModel):
    operation: str  # ADD / REMOVE / SET
    amount: float
    note: Optional[str] = ""


class PlanItem(BaseModel):
    ipo_id: str
    category: str = "RETAIL"
    lots: int = 1
    investor_ids: Optional[List[str]] = None  # None = all active


class PlanIn(BaseModel):
    name: str = "Plan"
    items: List[PlanItem]


# ---------- serialization ----------
def clean(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---------- auth routes ----------
@api.post("/auth/register")
async def register(body: AuthIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password),
           "name": body.name or "User", "role": "user",
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookie(response, create_access_token(uid, email))
    return {"id": uid, "email": email, "name": doc["name"], "role": "user"}


@api.post("/auth/login")
async def login(body: AuthIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    uid = str(user["_id"])
    set_auth_cookie(response, create_access_token(uid, email))
    return {"id": uid, "email": email, "name": user.get("name"), "role": user.get("role")}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["_id"], "email": user["email"], "name": user.get("name"), "role": user.get("role")}


# ---------- investors ----------
@api.get("/investors")
async def list_investors(user: dict = Depends(get_current_user)):
    rows = await db.investors.find({"user_id": user["_id"]}, {"_id": 0}).to_list(500)
    return rows


@api.post("/investors")
async def create_investor(body: InvestorIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["_id"]
    doc["pan"] = doc["pan"].upper().strip()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.investors.insert_one(doc)
    return clean(doc)


@api.put("/investors/{iid}")
async def update_investor(iid: str, body: InvestorIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["pan"] = doc["pan"].upper().strip()
    r = await db.investors.update_one({"id": iid, "user_id": user["_id"]}, {"$set": doc})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/investors/{iid}")
async def delete_investor(iid: str, user: dict = Depends(get_current_user)):
    await db.investors.delete_one({"id": iid, "user_id": user["_id"]})
    return {"ok": True}


# ---------- banks ----------
@api.get("/banks")
async def list_banks(user: dict = Depends(get_current_user)):
    rows = await db.banks.find({"user_id": user["_id"]}, {"_id": 0}).to_list(500)
    return rows


@api.post("/banks")
async def create_bank(body: BankIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["_id"]
    for u in doc["upis"]:
        u["id"] = u.get("id") or str(uuid.uuid4())
        if not u.get("holder_investor_id"):
            u["holder_investor_id"] = doc["owner_investor_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.banks.insert_one(doc)
    return clean(doc)


@api.put("/banks/{bid}")
async def update_bank(bid: str, body: BankIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    for u in doc["upis"]:
        u["id"] = u.get("id") or str(uuid.uuid4())
        if not u.get("holder_investor_id"):
            u["holder_investor_id"] = doc["owner_investor_id"]
    r = await db.banks.update_one({"id": bid, "user_id": user["_id"]}, {"$set": doc})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/banks/{bid}/balance")
async def change_balance(bid: str, body: BalanceOp, user: dict = Depends(get_current_user)):
    bank = await db.banks.find_one({"id": bid, "user_id": user["_id"]})
    if not bank:
        raise HTTPException(404, "Not found")
    bal = float(bank.get("balance", 0))
    if body.operation == "ADD":
        bal += body.amount
    elif body.operation == "REMOVE":
        bal -= body.amount
    elif body.operation == "SET":
        bal = body.amount
    await db.banks.update_one({"id": bid}, {"$set": {"balance": bal}})
    return {"balance": bal}


@api.delete("/banks/{bid}")
async def delete_bank(bid: str, user: dict = Depends(get_current_user)):
    await db.banks.delete_one({"id": bid, "user_id": user["_id"]})
    return {"ok": True}


# ---------- ipos ----------
@api.get("/ipos")
async def list_ipos(user: dict = Depends(get_current_user)):
    rows = await db.ipos.find({}, {"_id": 0}).to_list(500)
    rows.sort(key=lambda r: r.get("open_date", ""))
    return rows


_STATUS_MAP = {"O": "OPEN", "U": "UPCOMING", "C": "CLOSED", "LP": "LISTED", "LN": "LISTED", "L": "LISTED"}
_TAG = re.compile(r"<[^>]+>")


def _ig_url() -> str:
    now = datetime.now()
    m, y = now.month, now.year
    fs = y if m >= 4 else y - 1
    fy = f"{fs}-{str(fs + 1)[-2:]}"
    return (f"https://webnodejs.investorgain.com/cloud/v2/report/data-read/331/"
            f"1/{m}/{y}/{fy}/0/all?search=&r2&v=15-18")


def _parse_price(s: str):
    nums = [float(x) for x in re.findall(r"\d+\.?\d*", s or "") if x]
    if not nums:
        return 0.0, 0.0
    return (nums[0], nums[1]) if len(nums) >= 2 else (nums[0], nums[0])


def _fetch_ig():
    r = requests.get(_ig_url(), timeout=20, headers={
        "Accept": "application/json", "Origin": "https://www.investorgain.com",
        "Referer": "https://www.investorgain.com/", "User-Agent": "Mozilla/5.0 LotNeeti/1.0"})
    r.raise_for_status()
    return r.json().get("reportTableData", [])


async def sync_live_ipos() -> int:
    """Fetch live IPOs + GMP + subscription from InvestorGain and replace the catalog."""
    rows = await asyncio.to_thread(_fetch_ig)
    docs = []
    for row in rows:
        name = html.unescape(row.get("~ipo_name", "")).strip()
        if not name:
            continue
        lo, hi = _parse_price(str(row.get("Price (₹)", "")))
        lot = int(re.sub(r"[^\d]", "", str(row.get("Lot", "0"))) or 0)
        try:
            gmp = float(row.get("~max_gmp1") or 0)
        except (TypeError, ValueError):
            gmp = 0.0
        try:
            gmp_pct = float(row.get("~gmp_percent_calc") or 0)
        except (TypeError, ValueError):
            gmp_pct = 0.0
        sub = html.unescape(_TAG.sub("", str(row.get("Sub", "") or "")).strip()) or "-"
        updated = html.unescape(_TAG.sub("", str(row.get("Updated-On", "") or "")).strip())
        cat = row.get("~IPO_Category", "")
        src_id = str(row.get("~id", ""))
        docs.append({
            "id": f"ig-{src_id}", "issuer_name": name, "symbol": "",
            "issue_type": "SME" if cat == "SME" else "MAINBOARD",
            "lower_price": lo, "upper_price": hi, "lot_size": lot,
            "open_date": row.get("~Srt_Open", "") or "", "close_date": row.get("~Srt_Close", "") or "",
            "allotment_date": row.get("~Srt_BoA_Dt", "") or "", "listing_date": row.get("~Str_Listing", "") or "",
            "status": _STATUS_MAP.get(row.get("~ipo_status1", ""), "CLOSED"),
            "gmp": gmp, "gmp_pct": gmp_pct, "subscription": sub,
            "source": "investorgain", "source_id": src_id, "updated_on": updated,
        })
    if not docs:
        return 0
    await db.ipos.delete_many({})
    await db.ipos.insert_many(docs)
    logger.info("synced %d live IPOs", len(docs))
    return len(docs)


@api.post("/ipos/refresh")
async def refresh_ipos(user: dict = Depends(get_current_user)):
    try:
        n = await sync_live_ipos()
        return {"synced": n, "ok": True}
    except Exception as exc:
        logger.warning("live IPO sync failed: %s", exc)
        raise HTTPException(502, "Live GMP source is unavailable right now. Try again shortly.")


# ---------- planner ----------
def amount_per_app(ipo: dict, lots: int) -> float:
    return lots * int(ipo["lot_size"]) * float(ipo["upper_price"])


async def compute_blocked(user_id: str):
    """Return {bank_id: blocked_amount, upi_id: {count, amount}} from active applications."""
    apps = await db.applications.find(
        {"user_id": user_id, "mandate_status": {"$ne": "REFUNDED"}}, {"_id": 0}).to_list(5000)
    bank_blocked, upi_usage = {}, {}
    for a in apps:
        bank_blocked[a["bank_id"]] = bank_blocked.get(a["bank_id"], 0) + a["amount"]
        u = upi_usage.setdefault(a["upi_id"], {"count": 0, "amount": 0})
        u["count"] += 1
        u["amount"] += a["amount"]
    return bank_blocked, upi_usage


@api.post("/planner/preview")
async def planner_preview(body: PlanIn, user: dict = Depends(get_current_user)):
    return await _plan(body, user, commit=False)


@api.post("/planner/commit")
async def planner_commit(body: PlanIn, user: dict = Depends(get_current_user)):
    return await _plan(body, user, commit=True)


async def _plan(body: PlanIn, user: dict, commit: bool):
    uid = user["_id"]
    investors = {i["id"]: i for i in await db.investors.find({"user_id": uid}, {"_id": 0}).to_list(500)}
    banks = await db.banks.find({"user_id": uid}, {"_id": 0}).to_list(500)
    ipos = {i["id"]: i for i in await db.ipos.find({}, {"_id": 0}).to_list(500)}

    bank_blocked, upi_usage = await compute_blocked(uid)
    # available capacity trackers (mutable copies)
    bank_avail = {b["id"]: float(b.get("balance", 0)) - bank_blocked.get(b["id"], 0) for b in banks}
    upi_count = {}
    upi_amount = {}
    all_upis = []
    for b in banks:
        for u in b.get("upis", []):
            all_upis.append({**u, "bank_id": b["id"], "bank_name": b["bank_name"],
                             "bank_account": b["account_number"]})
            usage = upi_usage.get(u["id"], {"count": 0, "amount": 0})
            upi_count[u["id"]] = usage["count"]
            upi_amount[u["id"]] = usage["amount"]

    # which PAN already applied to which IPO (avoid duplicates)
    existing = await db.applications.find({"user_id": uid}, {"_id": 0, "ipo_id": 1, "investor_id": 1}).to_list(5000)
    applied_pairs = {(e["ipo_id"], e["investor_id"]) for e in existing}

    rows, warnings = [], []
    for item in body.items:
        ipo = ipos.get(item.ipo_id)
        if not ipo:
            continue
        amt = amount_per_app(ipo, item.lots)
        inv_ids = item.investor_ids or [i["id"] for i in investors.values() if i.get("active", True)]
        inv_ids = sorted(inv_ids, key=lambda x: investors.get(x, {}).get("priority", 99))
        for inv_id in inv_ids:
            inv = investors.get(inv_id)
            if not inv:
                continue
            if (item.ipo_id, inv_id) in applied_pairs:
                warnings.append(f"{inv['name']} already applied to {ipo['issuer_name']}")
                continue
            # find a UPI with capacity: prefer investor's own UPI, else cross-fund
            own = [u for u in all_upis if u.get("holder_investor_id") == inv_id]
            others = [u for u in all_upis if u.get("holder_investor_id") != inv_id]
            chosen = None
            for u in own + others:
                if upi_count[u["id"]] >= UPI_APP_LIMIT:
                    continue
                if upi_amount[u["id"]] + amt > UPI_AMOUNT_LIMIT:
                    continue
                if bank_avail.get(u["bank_id"], 0) < amt:
                    continue
                chosen = u
                break
            if not chosen:
                warnings.append(f"No UPI capacity/funds for {inv['name']} on {ipo['issuer_name']}")
                continue
            cross = chosen.get("holder_investor_id") != inv_id
            demat = (inv.get("demats") or [{}])[0]
            row = {
                "id": str(uuid.uuid4()),
                "ipo_id": ipo["id"], "ipo_name": ipo["issuer_name"],
                "investor_id": inv_id, "investor_name": inv["name"], "pan": inv["pan"],
                "category": item.category, "lots": item.lots, "amount": amt,
                "depository": demat.get("depository", ""), "dp_id": demat.get("dp_id", ""),
                "client_id": demat.get("client_id", ""),
                "bank_id": chosen["bank_id"], "bank_name": chosen["bank_name"],
                "bank_account": chosen["bank_account"], "upi_id": chosen["id"],
                "upi_handle": chosen["handle"], "cross_funded": cross,
            }
            rows.append(row)
            # consume capacity
            upi_count[chosen["id"]] += 1
            upi_amount[chosen["id"]] += amt
            bank_avail[chosen["bank_id"]] -= amt
            applied_pairs.add((item.ipo_id, inv_id))

    total = sum(r["amount"] for r in rows)
    if commit and rows:
        plan_id = str(uuid.uuid4())
        for r in rows:
            r["user_id"] = uid
            r["plan_id"] = plan_id
            r["mandate_status"] = "PENDING"
            r["allotment_status"] = "AWAITING"
            r["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.applications.insert_many([dict(r) for r in rows])
        await db.plans.insert_one({"id": plan_id, "user_id": uid, "name": body.name,
                                   "total_amount": total, "row_count": len(rows),
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    return {"rows": [clean(r) for r in rows], "total": total, "count": len(rows), "warnings": warnings}


# ---------- applications ----------
@api.get("/applications")
async def list_applications(user: dict = Depends(get_current_user)):
    rows = await db.applications.find({"user_id": user["_id"]}, {"_id": 0}).to_list(5000)
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows


@api.put("/applications/{aid}/status")
async def update_app_status(aid: str, body: dict, user: dict = Depends(get_current_user)):
    upd = {}
    if "mandate_status" in body:
        upd["mandate_status"] = body["mandate_status"]
    if "allotment_status" in body:
        upd["allotment_status"] = body["allotment_status"]
    await db.applications.update_one({"id": aid, "user_id": user["_id"]}, {"$set": upd})
    return {"ok": True}


@api.delete("/applications/{aid}")
async def delete_app(aid: str, user: dict = Depends(get_current_user)):
    await db.applications.delete_one({"id": aid, "user_id": user["_id"]})
    return {"ok": True}


EXPORT_COLUMNS = ["IPO ID", "IPO Name", "Applicant ID", "Applicant Name", "PAN", "Category",
                  "Lots", "Amount INR", "Depository", "DP ID", "Client ID", "Bank",
                  "Bank Account", "UPI ID"]


@api.get("/applications/export")
async def export_applications(request: Request):
    user = await get_current_user(request)
    rows = await db.applications.find({"user_id": user["_id"]}, {"_id": 0}).to_list(5000)
    wb = Workbook()
    ws = wb.active
    ws.title = "IPO Applications"
    ws.append(EXPORT_COLUMNS)
    for i, r in enumerate(rows, 1):
        ws.append([r["ipo_id"], r["ipo_name"], str(i), r["investor_name"], r["pan"],
                   r["category"], r["lots"], f"{r['amount']:.2f}", r["depository"],
                   r["dp_id"], r["client_id"], r["bank_name"], r["bank_account"], r["upi_handle"]])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ipo_applications.xlsx"})


# ---------- dashboard / funds ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    banks = await db.banks.find({"user_id": uid}, {"_id": 0}).to_list(500)
    investors = await db.investors.find({"user_id": uid}, {"_id": 0}).to_list(500)
    ipos = await db.ipos.find({}, {"_id": 0}).to_list(500)
    apps = await db.applications.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    bank_blocked, upi_usage = await compute_blocked(uid)
    total_capital = sum(float(b.get("balance", 0)) for b in banks)
    blocked = sum(bank_blocked.values())
    total_upis = sum(len(b.get("upis", [])) for b in banks)
    open_ipos = [i for i in ipos if i.get("status") == "OPEN"]
    allotted = [a for a in apps if a.get("allotment_status") == "ALLOTTED"]
    per_bank = []
    for b in banks:
        bal = float(b.get("balance", 0))
        blk = bank_blocked.get(b["id"], 0)
        per_bank.append({"id": b["id"], "bank_name": b["bank_name"],
                         "account_number": b["account_number"], "balance": bal,
                         "blocked": blk, "available": bal - blk,
                         "upis": [{"id": u["id"], "handle": u["handle"],
                                   "count": upi_usage.get(u["id"], {}).get("count", 0),
                                   "amount": upi_usage.get(u["id"], {}).get("amount", 0),
                                   "app_limit": UPI_APP_LIMIT, "amount_limit": UPI_AMOUNT_LIMIT}
                                  for u in b.get("upis", [])]})
    return {
        "total_capital": total_capital, "blocked": blocked, "available": total_capital - blocked,
        "total_upi_limit": total_upis * UPI_AMOUNT_LIMIT, "total_upis": total_upis,
        "investor_count": len(investors), "bank_count": len(banks),
        "open_ipo_count": len(open_ipos), "application_count": len(apps),
        "allotted_count": len(allotted), "per_bank": per_bank,
    }


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


SEED_IPOS = [
    ("Zenith Technologies", "ZENTECH", "MAINBOARD", 290, 305, 49, "OPEN", 118, -2, 3),
    ("Aarohi Pharma", "AAROHI", "MAINBOARD", 540, 570, 26, "OPEN", 210, -1, 4),
    ("Greenfuel Energy", "GRNFUEL", "SME", 90, 95, 1200, "OPEN", 42, 0, 2),
    ("Shakti Finserv", "SHAKTIFS", "MAINBOARD", 410, 430, 34, "OPEN", 155, 1, 5),
    ("Nova Logistics", "NOVALOG", "SME", 118, 125, 1000, "UPCOMING", 30, 3, 6),
    ("Prime Textiles", "PRIMETX", "MAINBOARD", 198, 210, 70, "UPCOMING", 64, 4, 7),
    ("Orbit Semicon", "ORBITSC", "MAINBOARD", 720, 760, 19, "UPCOMING", 320, 6, 9),
    ("Vayu Aerospace", "VAYUAERO", "MAINBOARD", 615, 648, 23, "CLOSED", 240, -8, -4),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # seed admin
    ae, ap = os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"]
    ex = await db.users.find_one({"email": ae})
    if not ex:
        await db.users.insert_one({"email": ae, "password_hash": hash_password(ap),
                                   "name": "Admin", "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    # seed ipos
    if await db.ipos.count_documents({}) == 0:
        today = date.today()
        for name, sym, itype, lo, hi, lot, status, gmp, gmp_pct_off, open_off in SEED_IPOS:
            od = today + timedelta(days=open_off)
            cd = od + timedelta(days=2)
            ad = cd + timedelta(days=2)
            ld = ad + timedelta(days=2)
            await db.ipos.insert_one({
                "id": str(uuid.uuid4()), "issuer_name": name, "symbol": sym,
                "issue_type": itype, "lower_price": lo, "upper_price": hi, "lot_size": lot,
                "open_date": od.isoformat(), "close_date": cd.isoformat(),
                "allotment_date": ad.isoformat(), "listing_date": ld.isoformat(),
                "status": status, "gmp": gmp,
                "gmp_pct": round(gmp / hi * 100, 1), "subscription": "-", "source": "seed",
            })

    async def _bg_sync():
        try:
            await sync_live_ipos()
        except Exception as exc:
            logger.warning("startup live IPO sync skipped: %s", exc)

    asyncio.create_task(_bg_sync())
    logger.info("startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
