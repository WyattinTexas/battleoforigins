/* ============================================================
   BOO2 payments — the StoreKit-shaped seam.

   Real-money purchases ONLY ever flow through PaymentsProvider so the
   iOS Capacitor wrap can drop in a StoreKit provider without touching
   store UI. Apple rules honored from day 1:
   - ★ bundles + packs = CONSUMABLE product ids
   - cosmetics (Founder's Lantern) = NON-CONSUMABLE
   - Restore Purchases is always visible in the store
   - NO external payment links anywhere in the app
   ============================================================ */
(function () {
  const PRODUCTS = [
    { id: 'com.corkscrewgames.boo.stars.100',  type: 'consumable',    kind: 'stars', stars: 100,  label: '100 ★',  price: '$0.99' },
    { id: 'com.corkscrewgames.boo.stars.550',  type: 'consumable',    kind: 'stars', stars: 550,  label: '550 ★',  price: '$4.99', badge: 'BEST VALUE' },
    { id: 'com.corkscrewgames.boo.stars.1200', type: 'consumable',    kind: 'stars', stars: 1200, label: '1200 ★', price: '$9.99' },
    { id: 'com.corkscrewgames.boo.founders',   type: 'nonconsumable', kind: 'cosmetic', label: "Founder's Lantern", desc: 'Golden name glow, forever', price: '$4.99' },
  ];

  /* Web provider: browsing only. The Capacitor build replaces this with a
     StoreKit provider exposing the same three methods. */
  const WebProvider = {
    name: 'web',
    async listProducts() { return PRODUCTS; },
    async purchase(productId) {
      return { ok: false, reason: 'web', message: '★ bundles arrive with the App Store version — earn ★ in battles and raids for now!' };
    },
    async restore() {
      return { ok: true, restored: [], message: 'Nothing to restore on the web version.' };
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
