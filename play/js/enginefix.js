/* ============================================================
   BOO2 engine hardening — runtime patch, engine files untouched.

   battle-engine.js aiCommitSpecials() drives the AI's resource
   commits with `while (resource > 0) primitive()` loops. Two ways
   those loops never exit (verified by reading the snapshot):
   1. The primitives early-return when !isPreRollActive(team) —
      if the phase shifts mid-loop, no call makes progress.
   2. Sylvia (313) on the AI side: cycleCommit's free-ice branch
      never decrements resources.ice, so `while (r.ice > 0)`
      cycles her commits 0→max→0 forever.
   Either one spins the main thread and hard-freezes the tab
   (reproduced twice in /play/ testing; beta only runs AI-blue in
   raids, so it hides there).

   Fix: rebuild the function from its own source with a shared
   iteration budget injected into every `while (`. Legit commit
   runs use a handful of iterations; 500 is unreachable except by
   the bug. Patching source (not duplicating logic) means a future
   engine/resync-beta.sh pull gets hardened automatically.
   ============================================================ */
(function () {
  try {
    if (typeof aiCommitSpecials !== 'function') return;
    const src = aiCommitSpecials.toString();
    const whiles = (src.match(/while \(/g) || []).length;
    const patched = src
      .replace(/^function aiCommitSpecials\(team\) \{/, 'function aiCommitSpecials(team) { let _boo2Guard = 500;')
      .replace(/while \(/g, 'while (_boo2Guard-- > 0 && ');
    if (!/_boo2Guard = 500/.test(patched) || whiles < 1) {
      console.warn('[BOO2 enginefix] aiCommitSpecials shape changed — patch skipped, loops unbounded');
      return;
    }
    // eslint-disable-next-line no-eval
    window.aiCommitSpecials = (0, eval)('(' + patched + ')');
    console.log(`[BOO2 enginefix] aiCommitSpecials hardened (${whiles} loops bounded)`);
  } catch (e) {
    console.warn('[BOO2 enginefix] patch failed, engine original kept:', e);
  }
})();

/* cards.js points 8 cards at ../testroom/art files that don't exist on disk
   (457-464 — verified in the roster reconciliation; battle shows a 👻
   placeholder). All 8 ship in /play/cards/ — point the engine there. */
(function () {
  try {
    if (typeof GHOSTS === 'undefined') return;
    [457, 458, 459, 460, 461, 462, 463, 464].forEach(id => {
      const g = GHOSTS.find(x => x.id === id);
      if (g) g.art = 'cards/' + id + '.webp';
    });
  } catch (e) {}
})();
