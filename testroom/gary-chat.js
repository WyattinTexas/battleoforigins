/* gary-chat.js — testroom Gary chat client
 *
 * Responsibilities:
 *   1. Figure out who the user is (Wyatt / Skylar / EJ / guest) and persist it
 *   2. Load that user's chat history from Firebase RTDB + the shared campfire notes
 *   3. Render a slide-out chat panel
 *   4. Send messages to the gary-chat-proxy Cloudflare Worker
 *   5. Persist new messages + drop a short summary into the shared campfire
 *
 * The Anthropic API key lives ONLY on the Worker. Never here.
 *
 * BEFORE THIS WORKS: deploy gary-worker/ and paste the URL into GARY_WORKER_URL below.
 */
(function(){
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const GARY_WORKER_URL = 'https://gary-chat-proxy.drbango.workers.dev';

  const KNOWN_USERS = ['wyatt', 'skylar', 'ej'];
  const STORAGE_KEY = 'testroom.garyUser';
  const MAX_HISTORY = 50;           // stored per user
  const MAX_SEND_TURNS = 20;        // sent to Claude per request
  const MAX_SHARED_NOTES = 30;      // stored globally
  const MAX_SHARED_INJECTED = 8;    // injected into Gary's system prompt
  const MODEL = 'claude-sonnet-4-6';

  // ============================================================
  // STATE
  // ============================================================
  let currentUser = null;          // lowercased string
  let currentCharacter = null;     // GHOSTS entry, or null = default Gary
  let history = [];                // [{role, content, ts}]
  let sharedNotes = [];            // [{author, content, ts}]
  let sending = false;
  let garyDb = null;               // firebase.database() handle

  // History storage key — character chats are namespaced per user+card
  function historyKey(user, character) {
    if (!character) return user;
    return `${user}_as_${character.id}`;
  }

  // Look up a ghost by id from the GHOSTS const declared in index.html
  function findGhost(id) {
    try {
      if (typeof GHOSTS !== 'undefined' && Array.isArray(GHOSTS)) {
        return GHOSTS.find(g => g && g.id === id) || null;
      }
    } catch(e) {}
    if (Array.isArray(window.GHOSTS)) {
      return window.GHOSTS.find(g => g && g.id === id) || null;
    }
    return null;
  }

  // ============================================================
  // FIREBASE — reuse the existing testroom Firebase app
  // ============================================================
  function getDb() {
    if (garyDb) return garyDb;
    try {
      if (typeof firebase !== 'undefined' && firebase.database) {
        garyDb = firebase.database();
      }
    } catch(e) { console.warn('[Gary] firebase not ready:', e); }
    return garyDb;
  }

  async function loadUserHistory(user, character) {
    const db = getDb();
    if (!db) return [];
    try {
      const snap = await db.ref('garyChats/' + historyKey(user, character)).once('value');
      const val = snap.val();
      if (val && Array.isArray(val.messages)) return val.messages;
    } catch(e) { console.warn('[Gary] loadUserHistory failed:', e); }
    return [];
  }

  async function saveUserHistory(user, character, messages) {
    const db = getDb();
    if (!db) return;
    const capped = messages.slice(-MAX_HISTORY);
    try {
      await db.ref('garyChats/' + historyKey(user, character)).set({
        messages: capped,
        lastSeen: Date.now(),
        character: character ? { id: character.id, name: character.name } : null,
      });
    } catch(e) { console.warn('[Gary] saveUserHistory failed:', e); }
  }

  async function loadSharedNotes() {
    const db = getDb();
    if (!db) return [];
    try {
      const snap = await db.ref('garyChats/_shared').once('value');
      const val = snap.val();
      if (val && Array.isArray(val.notes)) return val.notes;
    } catch(e) { console.warn('[Gary] loadSharedNotes failed:', e); }
    return [];
  }

  async function appendSharedNote(author, content) {
    const db = getDb();
    if (!db) return;
    try {
      const snap = await db.ref('garyChats/_shared').once('value');
      const val = snap.val() || {};
      const notes = Array.isArray(val.notes) ? val.notes : [];
      notes.push({ author, content, ts: Date.now() });
      const capped = notes.slice(-MAX_SHARED_NOTES);
      await db.ref('garyChats/_shared').set({ notes: capped });
      sharedNotes = capped;
    } catch(e) { console.warn('[Gary] appendSharedNote failed:', e); }
  }

  // ============================================================
  // IDENTITY
  // ============================================================
  function getStoredUser() {
    try { return localStorage.getItem(STORAGE_KEY); } catch(e) { return null; }
  }
  function setStoredUser(u) {
    try { localStorage.setItem(STORAGE_KEY, u); } catch(e) {}
  }

  function normalizeUser(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (KNOWN_USERS.includes(s)) return s;
    if (s === 'guest' || s === '') return null;
    return 'guest_' + s.replace(/[^a-z0-9]/g, '').slice(0, 16);
  }

  function showIdentityPrompt() {
    return new Promise(resolve => {
      const overlay = document.getElementById('garyIdentityPrompt');
      overlay.classList.add('active');
      const pick = (u) => {
        overlay.classList.remove('active');
        setStoredUser(u);
        resolve(u);
      };
      overlay.querySelectorAll('[data-gary-user]').forEach(btn => {
        btn.onclick = () => pick(btn.getAttribute('data-gary-user'));
      });
      overlay.querySelector('[data-gary-guest]').onclick = () => pick('guest');
    });
  }

  async function ensureUser() {
    if (currentUser) return currentUser;
    let u = normalizeUser(getStoredUser());
    if (!u) {
      const picked = await showIdentityPrompt();
      u = normalizeUser(picked);
    }
    currentUser = u || 'guest';
    return currentUser;
  }

  // ============================================================
  // UI — build panel lazily on first open
  // ============================================================
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of children) {
      if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function buildPanel() {
    if (document.getElementById('garyPanel')) return;

    // Identity overlay
    const idOverlay = el('div', { id: 'garyIdentityPrompt', class: 'gary-identity-prompt' }, [
      el('div', { class: 'gary-identity-box' }, [
        el('h3', null, ['Who are you?']),
        el('p', null, ['Gary carries context between the three of you. Tell him which seat you\'re in.']),
        (() => {
          const opts = el('div', { class: 'gary-identity-options' });
          KNOWN_USERS.forEach(u => {
            const b = el('button', { 'data-gary-user': u }, [u.charAt(0).toUpperCase() + u.slice(1)]);
            opts.appendChild(b);
          });
          return opts;
        })(),
        el('button', { class: 'gary-identity-guest', 'data-gary-guest': 'true' }, ['Continue as guest']),
      ])
    ]);
    document.body.appendChild(idOverlay);

    // Chat panel
    const panel = el('div', { id: 'garyPanel', class: 'gary-panel' });
    const header = el('div', { class: 'gary-header', id: 'garyHeader' }, [
      el('img', { id: 'garyHeaderImg', src: 'art/gary.png', alt: 'Gary' }),
      el('div', { class: 'gary-title' }, [
        el('div', { class: 'gary-name', id: 'garyHeaderName' }, ['Gary']),
        el('div', { class: 'gary-sub', id: 'garySubtitle' }, ['the friend in the chair']),
      ]),
      el('button', { class: 'gary-close', id: 'garyClose', title: 'Close' }, ['x']),
    ]);
    const messages = el('div', { class: 'gary-messages', id: 'garyMessages' });
    const input = el('textarea', {
      class: 'gary-input',
      id: 'garyInput',
      rows: '1',
      placeholder: 'Talk to Gary...',
    });
    const send = el('button', { class: 'gary-send', id: 'garySend' }, ['Send']);
    const inputRow = el('div', { class: 'gary-input-row' }, [input, send]);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputRow);
    document.body.appendChild(panel);

    document.getElementById('garyClose').onclick = closePanel;
    send.onclick = onSend;
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        onSend();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    });
  }

  function renderHistory() {
    const box = document.getElementById('garyMessages');
    if (!box) return;
    box.innerHTML = '';
    if (history.length === 0) {
      let welcome;
      if (currentCharacter) {
        // Character mode — let the model write the first line itself by leaving
        // a soft opener. We don't fake dialogue from the character.
        welcome = `(You're talking to ${currentCharacter.name}. Say hi.)`;
        box.appendChild(renderMsg({ role: 'system', content: welcome }));
      } else {
        welcome = currentUser && KNOWN_USERS.includes(currentUser)
          ? `Hey ${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)}. What are we looking at?`
          : `Hey. I'm Gary. Ask me about a card, a matchup, or whatever's bugging you.`;
        box.appendChild(renderMsg({ role: 'assistant', content: welcome }));
      }
    } else {
      history.forEach(m => box.appendChild(renderMsg(m)));
    }
    box.scrollTop = box.scrollHeight;
  }

  // Swap the chat header between Gary and a Spiritkin character.
  function applyHeader() {
    const img = document.getElementById('garyHeaderImg');
    const name = document.getElementById('garyHeaderName');
    const sub = document.getElementById('garySubtitle');
    const panel = document.getElementById('garyPanel');
    const input = document.getElementById('garyInput');
    if (!img || !name || !sub || !panel) return;
    if (currentCharacter) {
      const c = currentCharacter;
      if (c.art) { img.src = c.art; img.style.display = ''; }
      else { img.src = 'art/gary.png'; }
      img.alt = c.name;
      name.textContent = c.name;
      const bits = [];
      if (c.ability) bits.push(c.ability);
      if (c.set) bits.push(c.set);
      sub.textContent = bits.join(' \u2022 ') || 'a Spiritkin in the room';
      if (input) input.placeholder = `Talk to ${c.name}...`;
      panel.classList.add('gary-character-mode');
    } else {
      img.src = 'art/gary.png';
      img.alt = 'Gary';
      name.textContent = 'Gary';
      sub.textContent = currentUser ? `talking to ${currentUser}` : 'the friend in the chair';
      if (input) input.placeholder = 'Talk to Gary...';
      panel.classList.remove('gary-character-mode');
    }
  }

  function renderMsg(m) {
    const cls = m.role === 'assistant' ? 'gary-msg gary-assistant' :
                m.role === 'user' ? 'gary-msg gary-user' :
                m.role === 'error' ? 'gary-msg gary-error' : 'gary-msg gary-system';
    return el('div', { class: cls }, [m.content]);
  }

  function appendMsg(m) {
    history.push(m);
    const box = document.getElementById('garyMessages');
    if (box) {
      box.appendChild(renderMsg(m));
      box.scrollTop = box.scrollHeight;
    }
  }

  function showTyping() {
    const box = document.getElementById('garyMessages');
    if (!box) return;
    const t = el('div', { class: 'gary-typing', id: 'garyTyping' }, [
      el('span'), el('span'), el('span'),
    ]);
    box.appendChild(t);
    box.scrollTop = box.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById('garyTyping');
    if (t) t.remove();
  }

  // ============================================================
  // OPEN / CLOSE
  // ============================================================
  async function openPanel(character) {
    buildPanel();
    const user = await ensureUser();
    currentCharacter = character || null;
    document.getElementById('garyPanel').classList.add('active');
    applyHeader();

    // Load state (parallel) — character chats use a per-character history namespace
    const [userHist, shared] = await Promise.all([
      loadUserHistory(user, currentCharacter),
      loadSharedNotes(),
    ]);
    history = userHist;
    sharedNotes = shared;
    renderHistory();
    setTimeout(() => {
      const inp = document.getElementById('garyInput');
      if (inp) inp.focus();
    }, 50);
  }

  async function openAsCharacter(cardId) {
    const ghost = findGhost(cardId);
    if (!ghost) {
      console.warn('[Gary] openAs: no ghost with id', cardId);
      return openPanel();
    }
    return openPanel(ghost);
  }

  function closePanel() {
    const p = document.getElementById('garyPanel');
    if (p) p.classList.remove('active');
    // Clear character so the next default open is Gary, not the last ghost
    currentCharacter = null;
  }

  // ============================================================
  // RECENT BATTLE CONTEXT — try to pull last game from the testroom
  // ============================================================
  function getRecentBattleContext() {
    try {
      // Most testroom builds log recent results into the DOM standings.
      // As a cheap hook we look for a window-scoped helper if one exists.
      if (typeof window.getLastBattleSummary === 'function') {
        return window.getLastBattleSummary();
      }
      // Fallback: scan #battle-log for the last KO line.
      const log = document.getElementById('battle-log') || document.querySelector('.battle-log');
      if (log) {
        const text = log.innerText || '';
        const last = text.split('\n').filter(Boolean).slice(-3).join(' | ');
        if (last) return 'Last battle log tail: ' + last;
      }
    } catch(e) {}
    return '';
  }

  // ============================================================
  // SEND
  // ============================================================
  async function onSend() {
    if (sending) return;
    const inp = document.getElementById('garyInput');
    const text = (inp.value || '').trim();
    if (!text) return;

    if (!GARY_WORKER_URL) {
      appendMsg({
        role: 'error',
        content: 'Gary isn\'t wired up yet. Wyatt needs to deploy the Cloudflare Worker and paste the URL into gary-chat.js (GARY_WORKER_URL). See gary-worker/README.md.',
      });
      return;
    }

    sending = true;
    document.getElementById('garySend').disabled = true;
    inp.value = '';
    inp.style.height = 'auto';

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    appendMsg(userMsg);

    // First meeting = no prior assistant replies in this user+character thread.
    // The new user message has already been pushed to history, so we check
    // whether any assistant turn exists yet.
    const isFirstMeeting = history.filter(m => m.role === 'assistant').length === 0;

    // Build system prompt with freshly loaded shared notes (and character, if any)
    const system = window.GarySystemPrompt.build({
      username: currentUser,
      sharedNotes,
      recentBattle: getRecentBattleContext(),
      userMessage: text,
      character: currentCharacter,
      isFirstMeeting,
    });

    // Trim history to last N turns, strip ts, keep only role+content
    const sendMessages = history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_SEND_TURNS)
      .map(m => ({ role: m.role, content: m.content }));

    showTyping();

    let assistantText = '';
    try {
      const res = await fetch(GARY_WORKER_URL.replace(/\/$/, '') + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages: sendMessages,
        }),
      });
      hideTyping();
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Worker ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await res.json();
      assistantText = extractText(data);
      if (!assistantText) throw new Error('Empty response from Gary');

      const assistantMsg = { role: 'assistant', content: assistantText, ts: Date.now() };
      appendMsg(assistantMsg);
      await saveUserHistory(currentUser, currentCharacter, history);

      // Cross-pollination: tag character chats so Gary knows the source
      const summary = heuristicSummary(text, assistantText);
      if (summary) {
        const author = currentCharacter
          ? `${currentUser} -> ${currentCharacter.name}`
          : currentUser;
        appendSharedNote(author, summary);
      }
    } catch (e) {
      hideTyping();
      appendMsg({ role: 'error', content: 'Gary is offline: ' + (e.message || e) });
    } finally {
      sending = false;
      const sb = document.getElementById('garySend');
      if (sb) sb.disabled = false;
    }
  }

  function extractText(data) {
    if (!data) return '';
    if (typeof data.content === 'string') return data.content;
    if (Array.isArray(data.content)) {
      return data.content
        .filter(b => b && b.type === 'text' && b.text)
        .map(b => b.text)
        .join('\n');
    }
    return '';
  }

  // Cheap, zero-cost "what did we talk about" extractor.
  // We grab the first sentence of the user's message (or, failing that,
  // the first card name mentioned) and tag it with Gary's one-line reply opener.
  function heuristicSummary(userText, assistantText) {
    if (!userText) return '';
    const firstUserSentence = (userText.match(/.{1,140}?(?:[.!?]|$)/) || [userText])[0].trim();
    const firstAssistantSentence = (assistantText.match(/.{1,180}?(?:[.!?]|$)/) || [''])[0].trim();
    if (!firstUserSentence) return '';
    if (firstAssistantSentence) {
      return `asked about "${firstUserSentence}" — Gary said: ${firstAssistantSentence}`;
    }
    return `asked about "${firstUserSentence}"`;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  window.Gary = {
    open: () => openPanel(),
    openAs: openAsCharacter,
    close: closePanel,
    identify: async (user) => {
      const u = normalizeUser(user);
      if (u) { setStoredUser(u); currentUser = u; }
      return currentUser;
    },
    _state: () => ({ currentUser, currentCharacter, history, sharedNotes }),
  };

  // Auto-open via URL param ?gary=open (handy for testing)
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const sp = new URLSearchParams(location.search);
      if (sp.get('gary') === 'open') openPanel();
    } catch(e) {}
  });
})();
