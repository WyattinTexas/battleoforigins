#!/usr/bin/env python3
"""Local logic test for the BOO IPN server.

Runs the real handler with verify_with_paypal stubbed, posts crafted IPN
bodies, and asserts the grants/rejects against the REAL Firebase RTDB on
a scratch uid — then scrubs every trace and verifies clean.
"""
import json
import os
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

os.environ["STATE_DIR"] = tempfile.mkdtemp(prefix="boo-ipn-test-")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipn_server  # noqa: E402

PORT = 18713
UID = "uipntestscratch02"          # matches u[a-z0-9]{10,30}
FB = ipn_server.FIREBASE_BASE

verify_calls = []
ipn_server.verify_with_paypal = lambda raw, sb: (verify_calls.append(1), True)[1]

server = ipn_server.ThreadingHTTPServer(("127.0.0.1", PORT), ipn_server.Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

passed = failed = 0
def ok(cond, label, detail=""):
    global passed, failed
    if cond: passed += 1; print(f"  ✓ {label}")
    else: failed += 1; print(f"  ✗ {label} {detail}")

def post_ipn(**over):
    params = {
        "txn_id": over.pop("txn_id", "BOOTESTTXN1"),
        "invoice": over.pop("invoice", f"{UID}.boo.stars100.20260712120000"),
        "payment_status": over.pop("payment_status", "Completed"),
        "receiver_email": over.pop("receiver_email", "gablewyatt@gmail.com"),
        "mc_gross": over.pop("mc_gross", "0.99"),
        "mc_currency": over.pop("mc_currency", "USD"),
        "payer_email": "buyer@example.com",
    }
    params.update(over)
    body = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}/api/boo/paypal/ipn", data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=10) as r:
        assert r.status == 200
    time.sleep(1.2)   # processing happens after the 200 ack

def fb_get(path):
    with urllib.request.urlopen(f"{FB}/{path}.json", timeout=10) as r:
        return json.load(r)

def fb_delete(path):
    req = urllib.request.Request(f"{FB}/{path}.json", method="DELETE")
    urllib.request.urlopen(req, timeout=10).read()

TXNS = ("BOOTESTTXN1", "BOOTESTTXN2", "BOOTESTTXN3", "BOOTESTTXN4")
try:
    # Baseline: scratch uid does not exist
    fb_delete(f"players/{UID}")
    for t in TXNS:
        fb_delete(f"purchases/{t}")

    print("── valid purchase grants stars + audit row + congrats")
    post_ipn()
    ok(fb_get(f"players/{UID}/stars") == 100, "stars credited (100)")
    p = fb_get("purchases/BOOTESTTXN1") or {}
    ok(p.get("status") == "granted" and p.get("uid") == UID and p.get("balance") == 100,
       "purchase row granted w/ balance", json.dumps(p))
    msgs = fb_get(f"players/{UID}/msgQueue") or {}
    ok(any(m.get("type") == "star_purchase" and m.get("stars") == 100 for m in msgs.values()),
       "star_purchase congrats queued")

    print("── duplicate txn is a no-op (local + firebase dedup)")
    post_ipn()
    ok(fb_get(f"players/{UID}/stars") == 100, "no double credit")

    print("── firebase-side dedup alone stops a replay (fresh local state)")
    ipn_server.save_processed(set())
    post_ipn()
    ok(fb_get(f"players/{UID}/stars") == 100, "claimed txn refused via purchases CAS")

    print("── stacked purchase adds to existing balance")
    post_ipn(txn_id="BOOTESTTXN2", invoice=f"{UID}.boo.stars550.20260712120100", mc_gross="4.99")
    ok(fb_get(f"players/{UID}/stars") == 650, "550 more lands on 100")

    print("── Founder's Lantern sets flag, no stars")
    post_ipn(txn_id="BOOTESTTXN4", invoice=f"{UID}.boo.founders.20260712120200", mc_gross="4.99")
    ok(fb_get(f"players/{UID}/founders") is True, "founders flag set")
    ok(fb_get(f"players/{UID}/stars") == 650, "no stars from cosmetic")
    msgs = fb_get(f"players/{UID}/msgQueue") or {}
    ok(any(m.get("item") == "boo.founders" and m.get("founders") for m in msgs.values()),
       "founders congrats queued")

    print("── rejects: wrong amount / receiver / item / invoice / status")
    post_ipn(txn_id="BOOTESTTXN3", mc_gross="0.10")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "price mismatch rejected")
    post_ipn(txn_id="BOOTESTTXN3", receiver_email="attacker@evil.com")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "wrong receiver rejected")
    post_ipn(txn_id="BOOTESTTXN3", invoice=f"{UID}.boo.stars9999.20260712120000")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "unknown item rejected")
    post_ipn(txn_id="BOOTESTTXN3", invoice="rival_yawning.boo.stars100.20260712120000")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "persona invoice rejected")
    post_ipn(txn_id="BOOTESTTXN3", invoice=f"{UID}.com.corkscrewgames.boo.stars.100.20260712120000")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "reverse-DNS StoreKit id rejected (short keys only)")
    post_ipn(txn_id="BOOTESTTXN3", payment_status="Pending")
    ok(fb_get("purchases/BOOTESTTXN3") is None, "pending status skipped")
    ok(fb_get(f"players/{UID}/stars") == 650, "balance untouched by all rejects")

    print("── sandbox gate (ALLOW_SANDBOX off): rejected before verify")
    n = len(verify_calls)
    post_ipn(txn_id="BOOTESTTXN3", test_ipn="1")
    ok(fb_get("purchases/BOOTESTTXN3") is None and len(verify_calls) == n,
       "sandbox IPN rejected without postback")
finally:
    fb_delete(f"players/{UID}")
    for t in TXNS:
        fb_delete(f"purchases/{t}")
    clean = fb_get(f"players/{UID}") is None and all(
        fb_get(f"purchases/{t}") is None for t in TXNS)
    ok(clean, "scratch rows scrubbed, boo2/* clean")
    server.shutdown()

print(f"\n{'✅' if failed == 0 else '❌'} {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
