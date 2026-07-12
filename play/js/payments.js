/* ============================================================
   BOO2 payments — the StoreKit-shaped seam.

   Real-money purchases ONLY ever flow through PaymentsProvider so the
   iOS Capacitor wrap can drop in a StoreKit provider without touching
   store UI. Apple rules honored from day 1:
   - ★ bundles + packs = CONSUMABLE product ids
   - cosmetics (Founder's Lantern) = NON-CONSUMABLE
   - Restore Purchases is always visible in the store
   - NO external payment links in the APP (the WebProvider PayPal rail
     below is web-only; the iOS wrap replaces the provider at boot)

   WEB = PayPal (Phase F): _xclick checkout tab → the box
   (nationgame.live/api/boo/paypal/ipn) postback-verifies with PayPal
   and credits boo2/players/{uid}/stars ITSELF — the client only opens
   the tab and watches its own balance (BOO2M.watchForStars). Pack keys
   in the invoice are the SHORT ones (boo.stars100), never the
   reverse-DNS StoreKit ids — the box's invoice regex enforces it.
   ============================================================ */
(function () {
  const PRODUCTS = [
    { id: 'com.corkscrewgames.boo.stars.100',  key: 'boo.stars100',  type: 'consumable',    kind: 'stars', stars: 100,  label: '100 ★',  price: '$0.99', usd: '0.99' },
    { id: 'com.corkscrewgames.boo.stars.550',  key: 'boo.stars550',  type: 'consumable',    kind: 'stars', stars: 550,  label: '550 ★',  price: '$4.99', usd: '4.99', badge: 'BEST VALUE' },
    { id: 'com.corkscrewgames.boo.stars.1200', key: 'boo.stars1200', type: 'consumable',    kind: 'stars', stars: 1200, label: '1200 ★', price: '$9.99', usd: '9.99' },
    { id: 'com.corkscrewgames.boo.founders',   key: 'boo.founders',  type: 'nonconsumable', kind: 'cosmetic', label: "Founder's Lantern", desc: 'Golden name glow, forever', price: '$4.99', usd: '4.99' },
  ];

  const PAYPAL_BUSINESS = 'gablewyatt@gmail.com';
  const IPN_NOTIFY_URL = 'https://nationgame.live/api/boo/paypal/ipn';

  function checkoutUrl(p) {
    // invoice <uid>.<packKey>.<yyyyMMddHHmmss UTC> — the IPN handler's contract
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const base = location.origin + location.pathname;
    const q = new URLSearchParams({
      cmd: '_xclick',
      business: PAYPAL_BUSINESS,
      item_name: `Boo! Spirit Battles — ${p.label}${p.kind === 'stars' ? '' : ' (' + p.desc + ')'}`,
      item_number: p.key,
      amount: p.usd,
      currency_code: 'USD',
      invoice: `${BOO2M.uid()}.${p.key}.${ts}`,
      no_shipping: '1',
      no_note: '1',
      return: base + '?paypal=return',
      cancel_return: base + '?paypal=cancel',
      notify_url: IPN_NOTIFY_URL,
    });
    return 'https://www.paypal.com/cgi-bin/webscr?' + q.toString();
  }

  /* Web provider: opens the PayPal tab; the ★ arrive server-side. */
  const WebProvider = {
    name: 'web',
    async listProducts() { return PRODUCTS; },
    async purchase(productId) {
      const p = PRODUCTS.find(x => x.id === productId);
      if (!p) return { ok: false, reason: 'unknown', message: 'Unknown item' };
      if (BOO2M.mode() !== 'firebase') {
        return { ok: false, reason: 'offline', message: 'The Mint needs a connection — try again online' };
      }
      BOO2M.notePendingPurchase(p.key, p.stars || 0);
      window.open(checkoutUrl(p), '_blank', 'noopener');
      BOO2M.watchForStars();
      return { ok: true, pending: true, message: 'Finish in the PayPal tab — your ★ arrive here automatically.' };
    },
    async restore() {
      return { ok: true, restored: [], message: 'Web purchases restore themselves — ★ land on your account.' };
    },
  };

  let provider = WebProvider;

  window.BOO2PAY = {
    PRODUCTS,
    provider: () => provider,
    setProvider(p) { provider = p; }, // the iOS wrap calls this at boot
    listProducts: (...a) => provider.listProducts(...a),
    purchase: (...a) => provider.purchase(...a),
    restore: (...a) => provider.restore(...a),
  };
})();
