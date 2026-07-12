# BOO star-purchase IPN service (deployed on the Hivelocity box)

Real-money ★ for battleoforigins.com/play via PayPal — clone of the
FAVOR rail (`~/playfavor/server/favor-ipn/`), boo2-namespaced.

- **Deployed at**: root@74.50.97.139 `/opt/boo-ipn/ipn_server.py`
- **Service**: `boo-ipn.service` (systemd, www-data, ALLOW_SANDBOX=0,
  STATE_DIR=/var/lib/boo-ipn) listening on 127.0.0.1:8713
- **nginx**: `location /api/boo/` in sites-enabled/nationgame.live
  (inserted ABOVE /api/favor/ and the generic /api/ block; pre-edit
  backup in /root/nationgame.live.bak.boo-*) →
  https://nationgame.live/api/boo/paypal/ipn (+ /health)
- **Flow**: client (js/payments.js WebProvider) opens a PayPal `_xclick`
  tab — business gablewyatt@gmail.com, invoice `<boo2Uid>.<packKey>.<ts14>`,
  notify_url = the box. PayPal POSTs the IPN here; we postback-verify with
  ipnpb.paypal.com, check receiver/amount/pack, dedup (local file + a
  Firebase `boo2/purchases/{txn}` ETag create-once), then credit
  `boo2/players/{uid}/stars` by ETag compare-and-set (or set
  `founders=true` for the Lantern) and queue a `star_purchase` msgQueue
  congrats the client celebrates ("THE PEDDLER DELIVERS").
- **Packs** (must match js/payments.js PRODUCTS exactly — SHORT keys in
  invoices, never the reverse-DNS StoreKit ids):
  boo.stars100/$0.99 · boo.stars550/$4.99 · boo.stars1200/$9.99 ·
  boo.founders/$4.99 (founders flag, 0★)
- **Test**: `python3 test_ipn_local.py` (stubs the PayPal postback,
  exercises grants/founders/dedup/rejects against the real RTDB on a
  scratch uid, scrubs after — 18 asserts).
- **Prod proof 2026-07-12**: public /health ok; a forged Completed IPN
  through nginx → real ipnpb postback → INVALID → rejected, no rows.
- **Logs on box**: /var/lib/boo-ipn/ipn.log · `journalctl -u boo-ipn`
- **Redeploy**: scp ipn_server.py to /opt/boo-ipn/ && systemctl restart boo-ipn
- ⚠ PayPal's fixed fee (~$0.49 + 3.49%) makes the $0.99 pack ~52% fees.
  Wyatt's pricing call: keep App-Store parity anyway, or web floor $4.99.
