"""Backend tests: Bearer token auth for LotNeeti bug-fix."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

CREDS = {"email": "admin@lotneeti.com", "password": "admin123"}


# --- Login endpoint ---
def test_login_returns_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert data["email"] == CREDS["email"]


# --- Bearer header accepted without cookie ---
def test_bearer_token_accepted_without_cookie():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS)
    token = r.json()["token"]
    # Fresh session (no cookies), bearer only
    s = requests.Session()
    me = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["email"] == CREDS["email"]


# --- Protected endpoint accepts bearer alone ---
def test_protected_endpoint_bearer_only():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS)
    token = r.json()["token"]
    for ep in ["/api/dashboard", "/api/investors", "/api/banks", "/api/ipos", "/api/applications"]:
        resp = requests.get(f"{BASE_URL}{ep}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, f"{ep} -> {resp.status_code} {resp.text[:200]}"


# --- No auth -> 401 ---
def test_me_without_auth_401():
    s = requests.Session()
    r = s.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# --- Register also returns token ---
def test_register_returns_token():
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "Test", "email": email, "password": "pw123456"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and len(data["token"]) > 20
    # Bearer works for new user
    me = requests.get(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {data['token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


# --- Cookie-only auth still works (backup path) ---
def test_cookie_only_auth_still_works():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=CREDS)
    assert r.status_code == 200
    # Session has cookie now; call /auth/me WITHOUT Authorization header
    me = s.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 200
