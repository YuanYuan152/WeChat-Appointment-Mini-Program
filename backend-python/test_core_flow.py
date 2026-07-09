"""
Core flow integration test.
Run: python test_core_flow.py
"""

import requests

BASE = "http://localhost:8000"
results = []


def ok_mark(ok):
    return "[PASS]" if ok else "[FAIL]"


def record(name, ok, hint=""):
    results.append((name, ok))
    print(f"  {ok_mark(ok)} {name:<55} {hint}")
    return ok


def check_http(name, resp, expect_status=200):
    ok = resp.status_code == expect_status
    record(name, ok, f"HTTP {resp.status_code}")
    try:
        body = resp.json()
        if isinstance(body, dict) and "code" in body and "data" in body:
            return body["data"]
        return body
    except Exception:
        return {}


# ------------------------------------------------------------------
# 1. Health
# ------------------------------------------------------------------
print("\n--- 1. Health ---")
r = requests.get(f"{BASE}/")
check_http("GET /", r, 200)


# ------------------------------------------------------------------
# 2. Auth
# ------------------------------------------------------------------
print("\n--- 2. Auth ---")
r = requests.post(f"{BASE}/api/mini/auth/login", json={"code": "mock_code_test"})
body = check_http("POST /api/mini/auth/login (mock)", r, 200)
token = body.get("token") if isinstance(body, dict) else None
record("JWT token returned", bool(token), f"token={'...' if token else 'MISSING'}")

headers = {"Authorization": f"Bearer {token}"} if token else {}

r = requests.get(f"{BASE}/api/mini/auth/me", headers=headers)
body_me = check_http("GET /api/mini/auth/me", r, 200 if token else 401)
if token and isinstance(body_me, dict):
    record("me.id present", bool(body_me.get("id")))


# ------------------------------------------------------------------
# 3. Patient orders
# ------------------------------------------------------------------
print("\n--- 3. Patient orders ---")
r = requests.get(f"{BASE}/api/mini/patient/orders", headers=headers)
orders = check_http("GET /api/mini/patient/orders", r, 200 if token else 401)
if token:
    record("orders is a list", isinstance(orders, list), f"count={len(orders) if isinstance(orders, list) else '?'}")


# ------------------------------------------------------------------
# 4. Counselor (no role -> 403)
# ------------------------------------------------------------------
print("\n--- 4. Counselor endpoints (no Counselor role -> 403) ---")
r = requests.get(f"{BASE}/api/mini/counselor/schedules", headers=headers)
ok_403 = r.status_code == 403
record("GET /api/mini/counselor/schedules -> 403", ok_403, f"HTTP {r.status_code}")


# ------------------------------------------------------------------
# 5. Assistant (no role -> 403)
# ------------------------------------------------------------------
print("\n--- 5. Assistant endpoints (no Assistant role -> 403) ---")
r = requests.get(f"{BASE}/api/mini/assistant/tasks", headers=headers)
ok_403 = r.status_code == 403
record("GET /api/mini/assistant/tasks -> 403", ok_403, f"HTTP {r.status_code}")


# ------------------------------------------------------------------
# 6. Ops (public read)
# ------------------------------------------------------------------
print("\n--- 6. Ops public endpoints ---")
r = requests.get(f"{BASE}/api/mini/ops/banners")
banners = check_http("GET /api/mini/ops/banners", r, 200)
record("banners is a list", isinstance(banners, list), f"count={len(banners) if isinstance(banners, list) else '?'}")

r = requests.get(f"{BASE}/api/mini/ops/activities")
acts = check_http("GET /api/mini/ops/activities", r, 200)
record("activities is a list", isinstance(acts, list), f"count={len(acts) if isinstance(acts, list) else '?'}")


# ------------------------------------------------------------------
# 7. Payment (mock)
# ------------------------------------------------------------------
print("\n--- 7. Payment ---")
r = requests.post(
    f"{BASE}/api/payment/wechat/create",
    json={"slot_id": 1, "total_fee": 29900, "description": "Test consultation"},
    headers=headers,
)
pay_body = check_http("POST /api/payment/wechat/create", r, 200 if token else 401)
if token and isinstance(pay_body, dict):
    record("payment out_trade_no present", bool(pay_body.get("out_trade_no")))


# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
print("\n" + "=" * 60)
total = len(results)
passed = sum(1 for _, ok in results if ok)
print(f"  Result: {passed}/{total} passed")
if passed == total:
    print("  All tests PASSED!")
else:
    print("  Failed items:")
    for name, ok in results:
        if not ok:
            print(f"    - {name}")
print("=" * 60 + "\n")
