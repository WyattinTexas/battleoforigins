/* ============================================================
   BOO2 standings + friend battles (the Firebase-social layer).

   STANDINGS: all-time rating board + today's wins board keyed by
   the 10PM-ET dateKey; Daily Champions crowns; LOCAL badge offline.

   FRIEND BATTLES: challenge link → boo2/mp/games/{id} (via the
   db.ref namespace jail) → both clients boot /play/?livepvp={id}
   and the untouched engine runs the real-time match over
   boo2/mp/livegames/{id}. Wire format matches beta exactly.
   ============================================================ */
(function () {
  let tab = 'alltime';
  let _countdownTimer = null;

  /* ─────────── standings screen ─────────── */
  async function render() {
    const list = document.getElementById('standList');
    document.getElementById('standLocal').style.display = BOO2M.mode() === 'local' ? '' : 'none';
    document.querySelectorAll('.stand-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    list.innerHTML = '<div class="stand-empty">Summoning the board…</div>';
    const rows = tab === 'alltime' ? await BOO2M.fetchAllTime() : await BOO2M.fetchDaily();
    const myUid = BOO2M.uid();
    if (!rows.length) {
      list.innerHTML = `<div class="stand-empty">${tab === 'alltime'
        ? 'No champions yet — win a battle and claim the top spot!'
        : 'Nobody has won today. First win takes the lead!'}</div>`;
    } else {
      list.innerHTML = rows.map((r, i) => {
        const me = r.uid === myUid ? ' me' : '';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="st-rank">${i + 1}</span>`;
        const crowns = (r.champs && r.champs.gold) ? ` <span class="st-crown">👑${r.champs.gold > 1 ? r.champs.gold : ''}</span>` : '';
        const stat = tab === 'alltime'
          ? `<b>${r.rating}</b> RTG · ${r.wins}W`
          : `<b>${r.best}</b> win${r.best !== 1 ? 's' : ''} today`;
        return `<div class="stand-row${me}">
          <span class="st-medal">${medal}</span>
          <span class="st-name">${escapeHtml(r.name)}${crowns}</span>
          <span class="st-stat">${stat}</span>
        </div>`;
      }).join('');
    }
    startCountdown();
  }
  function showTab(t) { tab = t; render(); }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

  function startCountdown() {
    clearInterval(_countdownTimer);
    const el = document.getElementById('standCountdown');
    const tick = () => {
      const ms = BOO2M.msUntilSettle();
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      el.textContent = `Daily Champions crowned in ${h}h ${String(m).padStart(2, '0')}m — top 3 win ★${BOO2M.STAR_AWARDS.join(' / ★')}`;
    };
    tick();
    _countdownTimer = setInterval(tick, 30000);
  }

  /* champion messages (queued by settleDue for podium finishers) */
  async function drainChampMsgs() {
    await BOO2M.drainMsgs(async m => {
      const PLACE = ['', 'st', 'nd', 'rd'];
      const CROWN = ['', '🥇', '🥈', '🥉'];
      document.getElementById('champBody').innerHTML = `
        <div class="w-ghost">${CROWN[m.place] || '🏆'}</div>
        <h1>DAILY CHAMPION</h1>
        <div class="w-sub">You placed <b>${m.place}${PLACE[m.place] || 'th'}</b> on the ${m.dateKey} board!</div>
        <div class="w-name">+${m.stars} ★</div>
        <button class="btn-ember" onclick="document.getElementById('champOverlay').classList.remove('active')">CLAIM</button>`;
      document.getElementById('champOverlay').classList.add('active');
      await new Promise(res => {
        const iv = setInterval(() => {
          if (!document.getElementById('champOverlay').classList.contains('active')) { clearInterval(iv); res(); }
        }, 300);
      });
      BOO2S.refreshChrome();
    });
  }

  /* ─────────── friend battles (challenge links) ─────────── */
  let _gameRef = null;

  function createChallenge() {
    if (BOO2M.mode() === 'local') { showToast('Friend battles need a connection — try again online'); return; }
    const team = BOO2M.team();
    if (team.length < 3) { showToast('Pick 3 spirits first'); return; }
    const ref = db.ref('mp/games').push({
      creator: BOO2M.uid(),
      creatorName: BOO2M.myName(),
      creatorTeam: team,
      status: 'waiting',
      created: firebase.database.ServerValue.TIMESTAMP,
    });
    _gameRef = ref;
    const link = `${location.origin}${location.pathname}?challenge=${ref.key}`;
    document.getElementById('challengeLink').value = link;
    document.getElementById('challengeWait').classList.add('active');
    // when a friend accepts, both sides jump into the live match
    ref.on('value', snap => {
      const g = snap.val();
      if (g && g.status === 'active' && g.opponentTeam) {
        ref.off();
        goLive(ref.key, g, 'red');
      }
    });
    if (navigator.share) {
      navigator.share({ title: 'Boo! Spirit Battles', text: `${BOO2M.myName()} challenges you to a spirit battle!`, url: link }).catch(() => {});
    }
  }

  function copyChallengeLink() {
    const input = document.getElementById('challengeLink');
    input.select();
    try { navigator.clipboard.writeText(input.value); } catch (e) { document.execCommand('copy'); }
    showToast('Link copied — send it to a friend!');
  }

  function cancelChallenge() {
    if (_gameRef) { _gameRef.off(); _gameRef.remove(); _gameRef = null; }
    document.getElementById('challengeWait').classList.remove('active');
  }

  /* visitor side: /play/?challenge={id} */
  async function checkChallengeParam() {
    const id = new URLSearchParams(location.search).get('challenge');
    if (!id) return false;
    // brand-new player: let the welcome ceremony run first; shell re-calls us after
    if (!localStorage.getItem('boo2Welcome')) return false;
    history.replaceState({}, '', location.pathname); // don't re-trigger on refresh
    if (BOO2M.mode() === 'local') { showToast('Challenge found, but you appear offline'); return false; }
    const snap = await db.ref(`mp/games/${id}`).get();
    const g = snap.val();
    if (!g || g.status !== 'waiting') { showToast('That challenge has expired'); return false; }
    document.getElementById('acceptBody').innerHTML = `
      <div class="w-ghost">⚔️</div>
      <h1>CHALLENGE!</h1>
      <div class="w-sub"><b>${escapeHtml(g.creatorName)}</b> challenges you to a spirit battle.</div>
      <div class="accept-team">${(g.creatorTeam || []).map(cid => `<img src="${boo2Art(cid)}" alt="">`).join('')}</div>
      <button class="btn-ember" onclick="BOO2ST.acceptChallenge('${id}')">ACCEPT</button>
      <button class="ov-close" style="margin-top:10px" onclick="document.getElementById('acceptOverlay').classList.remove('active')">DECLINE</button>`;
    document.getElementById('acceptOverlay').classList.add('active');
    return true;
  }

  async function acceptChallenge(id) {
    const team = BOO2M.team();
    if (team.length < 3) {
      document.getElementById('acceptOverlay').classList.remove('active');
      showToast('Pick 3 spirits first, then re-open the link');
      BOO2S.showScreen('play');
      return;
    }
    const ref = db.ref(`mp/games/${id}`);
    const snap = await ref.get();
    const g = snap.val();
    if (!g || g.status !== 'waiting') { showToast('Too slow — challenge already taken'); return; }
    await ref.update({
      opponent: BOO2M.uid(),
      opponentName: BOO2M.myName(),
      opponentTeam: team,
      status: 'active',
    });
    goLive(id, Object.assign({}, g, { opponentTeam: team, opponentName: BOO2M.myName() }), 'blue');
  }

  /* both clients: reload into the engine's livepvp boot (URL-param IIFE) */
  function goLive(id, g, side) {
    const q = new URLSearchParams({
      livepvp: id, side,
      red: (g.creatorTeam || []).join(','),
      blue: (g.opponentTeam || []).join(','),
      redName: g.creatorName || 'Challenger',
      blueName: g.opponentName || 'Rival',
    });
    location.href = `${location.pathname}?${q}`;
  }

  window.BOO2ST = { render, showTab, drainChampMsgs, createChallenge, copyChallengeLink, cancelChallenge, checkChallengeParam, acceptChallenge };
})();
