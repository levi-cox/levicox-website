/* Levi Cox Fitness Creative Studio: front end.
   No brand data lives here. Everything private comes from the API after the passcode check. */
(() => {
  'use strict';
  const API = window.STUDIO_API || '/creativestudio/api';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  let KEY = '';
  let S = null; // saved state: {rev, log, backlog, calendar, pieces}
  let piece = freshPiece();
  let ideas = null;
  let weekPlan = null;

  function freshPiece() {
    return { topic: '', format: 'reel', type: 'training', dup: null, hooks: null, top: 0, chosen: null, build: null, caption: null, review: null, saved: false };
  }

  /* ---------- storage helpers (convenience only) ---------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const saveDraft = () => ls.set('studio.draft', JSON.stringify(piece));

  /* ---------- ui helpers ---------- */
  let toastT;
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (bad ? ' bad' : '');
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), bad ? 6000 : 2600);
  }
  async function busy(msg, fn) {
    $('#busy-msg').textContent = msg;
    $('#busy').hidden = false;
    try { return await fn(); }
    catch (e) {
      if (e && e.code === 'auth') { lock(e.message); }
      else toast((e && e.message) || 'Something went wrong. Try again.', true);
      return undefined;
    } finally { $('#busy').hidden = true; }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied'); return; } catch {}
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy failed. Select the text instead.', true); }
    ta.remove();
  }

  /* ---------- api ---------- */
  async function api(path, method = 'GET', body) {
    let r;
    try {
      r = await fetch(API + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-studio-key': KEY },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw { code: 'net', message: 'No connection. Check your signal and try again.' }; }
    let data = null;
    try { data = await r.json(); } catch {}
    if (r.status === 401 || (r.status === 429 && path === '/state')) throw { code: 'auth', message: (data && data.error) || 'Wrong passcode.' };
    if (r.status === 409) throw { code: 'conflict', state: data && data.state };
    if (!r.ok) throw { code: 'http', message: (data && data.error) || 'Something went wrong. Try again.' };
    return data;
  }
  async function gen(task, input) {
    const data = await api('/generate', 'POST', { task, input });
    (data.warnings || []).forEach((w) => toast(w, true));
    return data.result;
  }
  async function persist() {
    const r = await api('/state', 'PUT', { rev: S.rev, state: { log: S.log, backlog: S.backlog, calendar: S.calendar, pieces: S.pieces } });
    S.rev = r.rev;
  }
  // Apply a change, save it, and if another device saved first, re-apply on the newest copy once.
  async function mutate(fn) {
    fn(S);
    try { await persist(); }
    catch (e) {
      if (e && e.code === 'conflict' && e.state) { S = e.state; fn(S); await persist(); }
      else throw e;
    }
  }

  /* ---------- lock ---------- */
  function lock(msg) {
    KEY = ''; ls.del('studio.key'); S = null;
    $('#app').hidden = true; $('#lock').hidden = false;
    const err = $('#lock-err');
    if (msg) { err.textContent = msg; err.hidden = false; } else err.hidden = true;
  }
  async function unlock(key) {
    KEY = key;
    const state = await api('/state');
    S = state;
    ls.set('studio.key', key);
    $('#lock').hidden = true; $('#app').hidden = false;
    $('#pass').value = '';
    renderAll();
  }
  $('#lock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#unlock-btn'); btn.disabled = true;
    try { await unlock($('#pass').value.trim()); }
    catch (err) { lock(err.message || 'Could not unlock.'); }
    btn.disabled = false;
  });
  $('#signout').addEventListener('click', () => lock());

  /* ---------- tabs ---------- */
  function show(view) {
    $$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + view));
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    window.scrollTo(0, 0);
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

  /* ---------- segmented controls ---------- */
  function seg(id, key) {
    $$('#' + id + ' button').forEach((b) => b.addEventListener('click', () => {
      piece[key] = b.dataset.v;
      $$('#' + id + ' button').forEach((x) => x.classList.toggle('on', x === b));
      saveDraft();
    }));
  }
  seg('seg-format', 'format');
  seg('seg-type', 'type');
  function syncSegs() {
    $$('#seg-format button').forEach((b) => b.classList.toggle('on', b.dataset.v === piece.format));
    $$('#seg-type button').forEach((b) => b.classList.toggle('on', b.dataset.v === piece.type));
    $('#topic').value = piece.topic || '';
  }
  $('#topic').addEventListener('input', (e) => { piece.topic = e.target.value; saveDraft(); });

  /* ---------- text assembly ---------- */
  const emText = (s) => String(s || '').replace(/\*/g, '');
  const emHtml = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
  function hookText(h) {
    if (!h) return '';
    return h.spoken || h.headline || '';
  }
  function buildText() {
    const b = piece.build;
    if (!b) return '';
    if (piece.format === 'carousel') {
      return (b.slides || []).map((s, i) => `Slide ${i + 1}\n${emText(s.headline)}\n${s.body || ''}${s.source ? '\nSource: ' + s.source : ''}`).join('\n\n');
    }
    return (b.rows || []).map((r) => `${r.time}\nSay: ${r.spoken}\nOn screen: ${r.onscreen}\nShow: ${r.footage}`).join('\n\n');
  }
  function pieceSummary() {
    const b = piece.build || {};
    if (piece.format === 'carousel') return (b.slides || []).map((s, i) => `${i + 1}. ${emText(s.headline)} | ${s.body || ''} | ${s.source || ''}`).join('\n');
    return (b.rows || []).map((r) => `${r.time} | ${r.spoken} | ${r.onscreen} | ${r.footage}`).join('\n');
  }

  /* ---------- create view rendering ---------- */
  const GROUPS = { number_gap: 'Number or gap', myth_evidence: 'Myth vs evidence', levi_experience: "Levi's own experience", direct_to_marcus: 'Direct to the reader' };

  function renderPiece() {
    const out = $('#create-out');
    let h = '';
    if (piece.hooks) {
      const d = piece.dup || {};
      h += `<div class="card dup ${d.is_duplicate ? 'bad' : ''}">
        <span class="chip ${d.is_duplicate ? 'bad' : 'posted'}">${d.is_duplicate ? 'Overlaps something you made' : 'Not a repeat'}</span>
        ${d.closest ? `<p style="margin-top:10px"><strong>${esc(d.closest)}</strong></p>` : ''}
        ${d.note ? `<p class="mini" style="margin-top:6px">${esc(d.note)}</p>` : ''}
      </div>`;
      h += `<div class="step-h"><span class="n">1</span><h2>Pick a hook</h2></div>`;
      let lastGroup = '';
      piece.hooks.forEach((hk, i) => {
        if (hk.group !== lastGroup) { lastGroup = hk.group; h += `<p class="mini" style="margin:12px 2px 6px">${esc(GROUPS[hk.group] || hk.group || '')}</p>`; }
        const main = hk.spoken || hk.headline || '';
        const sub = piece.format === 'reel' ? (hk.onscreen ? 'On screen: ' + hk.onscreen : '') : hk.subhead || '';
        h += `<button type="button" class="hook ${piece.chosen === i ? 'on' : ''}" data-act="pick" data-i="${i}">
          <div class="t">${esc(main)}${i === piece.top ? '<span class="star">Top pick</span>' : ''}</div>
          ${sub ? `<div class="s">${esc(sub)}</div>` : ''}</button>`;
      });
      if (piece.why) h += `<p class="mini" style="margin:4px 2px 0">${esc(piece.why)}</p>`;
      h += `<button class="btn primary block" type="button" data-act="build" ${piece.chosen == null ? 'disabled' : ''}>${piece.format === 'carousel' ? 'Build the carousel' : 'Write the reel script'}</button>`;
    }

    if (piece.build) {
      h += `<div class="step-h"><span class="n">2</span><h2>${piece.format === 'carousel' ? 'Carousel' : 'Reel script'}</h2></div>`;
      if (piece.format === 'carousel') {
        h += `<div class="car">${(piece.build.slides || []).map((s, i, a) => `
          <div class="slide ${esc(piece.type)}">
            <div class="k">${esc(s.kicker)}</div>
            <div class="h">${emHtml(s.headline)}</div>
            <div class="b">${esc(s.body)}</div>
            ${s.photo ? '<div class="ph">Levi\'s photo here</div>' : ''}
            ${s.source ? `<div class="src">Source: ${esc(s.source)}</div>` : ''}
            <div class="ft"><div class="br">Levi Cox<small>@levicoxfitness · @levi_cox</small></div><div class="pg">${i + 1}/${a.length}</div></div>
          </div>`).join('')}</div>
          <p class="mini">Swipe to preview. Screenshot or build final images from the Claude Code studio.</p>`;
      } else {
        h += `<div class="card">${(piece.build.rows || []).map((r) => `<div class="line-row">
          <div class="tm">${esc(r.time)}</div>
          <div class="sp">${esc(r.spoken)}</div>
          ${r.onscreen ? `<div class="os">On screen: ${esc(r.onscreen)}</div>` : ''}
          ${r.footage ? `<div class="ft">${esc(r.footage).replace(/\[need clip:[^\]]*\]/gi, (m) => `<span class="need">${m}</span>`)}</div>` : ''}
        </div>`).join('')}</div>`;
      }
      const uv = piece.build.unverified || [];
      if (uv.length) h += `<div class="card"><span class="chip bad">Verify before posting</span><ul class="list">${uv.map((u) => `<li>${esc(u)}</li>`).join('')}</ul></div>`;
      h += `<div class="btns"><button class="btn small" type="button" data-act="copy-build">Copy ${piece.format === 'carousel' ? 'slide text' : 'script'}</button></div>`;
      h += `<button class="btn primary block" type="button" data-act="caption">Write captions</button>`;
    }

    if (piece.caption) {
      h += `<div class="step-h"><span class="n">3</span><h2>Captions</h2></div>`;
      [['short', 'Short'], ['long', 'Long'], ['linkedin', 'LinkedIn']].forEach(([k, label]) => {
        if (!piece.caption[k]) return;
        h += `<div class="card"><span class="lbl" style="margin-top:0">${label}</span><div class="pre">${esc(piece.caption[k])}</div>
          <div class="btns"><button class="btn small" type="button" data-act="copy-cap" data-k="${k}">Copy</button></div></div>`;
      });
      h += `<button class="btn primary block" type="button" data-act="review">Final check</button>`;
    }

    if (piece.review) {
      const r = piece.review;
      h += `<div class="step-h"><span class="n">4</span><h2>Final check</h2></div>`;
      h += `<div class="card"><span class="chip ${r.must_fix && r.must_fix.length ? 'bad' : 'posted'}">${r.must_fix && r.must_fix.length ? 'Fix before posting' : 'Ready to post'}</span>`;
      const grp = (title, arr) => (arr && arr.length ? `<p class="lbl">${title}</p><ul class="list">${arr.map((x) => `<li><strong>${esc(x.where)}:</strong> ${esc(x.issue)}<br><span class="mini">Fix: ${esc(x.fix)}</span></li>`).join('')}</ul>` : '');
      h += grp('Must fix', r.must_fix) + grp('Should fix', r.should_fix);
      if (r.fine && r.fine.length) h += `<p class="lbl">Working</p><ul class="list">${r.fine.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
      h += `</div>`;
    }

    if (piece.build) {
      h += `<div class="card"><span class="lbl" style="margin-top:0">Save to your log</span>
        <div class="row"><div><select id="sv-status"><option>produced</option><option>scheduled</option><option>posted</option></select></div>
        <div><input id="sv-date" type="date" value="${today()}"></div></div>
        <button class="btn primary block" type="button" data-act="save" ${piece.saved ? 'disabled' : ''}>${piece.saved ? 'Saved to log' : 'Save to log'}</button></div>`;
    }
    if (piece.hooks || piece.build) h += `<div class="btns"><button class="btn small" type="button" data-act="reset">Start a new piece</button></div>`;
    out.innerHTML = h;
  }

  /* ---------- create actions ---------- */
  async function doHooks() {
    const topic = $('#topic').value.trim();
    if (!topic) { toast('Add a topic first.', true); $('#topic').focus(); return; }
    piece = Object.assign(freshPiece(), { topic, format: piece.format, type: piece.type });
    const res = await busy('Checking your log and writing hooks…', () => gen('hooks', { topic, format: piece.format, type: piece.type }));
    if (!res) return;
    piece.dup = res.duplicate || {};
    piece.hooks = (res.hooks || []).slice(0, 8);
    piece.top = Number.isInteger(res.top_pick) ? res.top_pick : 0;
    piece.why = res.why || '';
    piece.chosen = piece.top < piece.hooks.length ? piece.top : null;
    saveDraft(); renderPiece();
  }
  async function doBuild() {
    const hook = piece.hooks[piece.chosen];
    const task = piece.format === 'carousel' ? 'carousel' : 'script';
    const res = await busy(piece.format === 'carousel' ? 'Building the carousel…' : 'Writing the script…', () => gen(task, { topic: piece.topic, hook, type: piece.type }));
    if (!res) return;
    piece.build = res; piece.caption = null; piece.review = null; piece.saved = false;
    saveDraft(); renderPiece();
  }
  async function doCaption() {
    const res = await busy('Writing captions…', () => gen('caption', { topic: piece.topic, format: piece.format, type: piece.type, piece: pieceSummary(), cta: (piece.build && piece.build.cta) || '' }));
    if (!res) return;
    piece.caption = res; piece.review = null;
    saveDraft(); renderPiece();
  }
  async function doReview() {
    const res = await busy('Running the final check…', () => gen('review', { topic: piece.topic, format: piece.format, type: piece.type, piece: pieceSummary(), unverified: (piece.build && piece.build.unverified) || [], caption: piece.caption && piece.caption.short, plannedDay: 'not set' }));
    if (!res) return;
    piece.review = res; saveDraft(); renderPiece();
  }
  async function doSave() {
    const status = $('#sv-status').value, date = $('#sv-date').value || today();
    const id = uid();
    const title = (piece.build && piece.build.title) || piece.topic;
    const ok = await busy('Saving…', async () => {
      await mutate((s) => {
        s.log.push({ id, date, status, format: piece.format === 'carousel' ? 'Carousel' : 'Reel', title, angle: piece.topic, type: piece.type });
        s.pieces[id] = { topic: piece.topic, format: piece.format, type: piece.type, hook: piece.hooks && piece.hooks[piece.chosen], build: piece.build, caption: piece.caption };
        s.backlog = s.backlog.filter((b) => b.title !== piece.topic);
      });
      return true;
    });
    if (!ok) return;
    piece.saved = true; saveDraft(); renderPiece(); renderLog(); renderBacklog(); toast('Saved to your log');
  }

  $('#go-hooks').addEventListener('click', doHooks);
  $('#create-out').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'pick') { piece.chosen = +b.dataset.i; saveDraft(); renderPiece(); }
    else if (a === 'build') doBuild();
    else if (a === 'caption') doCaption();
    else if (a === 'review') doReview();
    else if (a === 'save') doSave();
    else if (a === 'copy-build') copy(buildText());
    else if (a === 'copy-cap') copy(piece.caption[b.dataset.k]);
    else if (a === 'reset') { piece = freshPiece(); ls.del('studio.draft'); syncSegs(); renderPiece(); window.scrollTo(0, 0); }
  });

  /* ---------- ideas ---------- */
  const isCarouselName = (n) => /carousel|gap and fix|myth vs data|framework|study breakdown|full-day|progress and process/i.test(n || '');
  function startPiece(topic, formatName) {
    piece = Object.assign(freshPiece(), { topic, format: isCarouselName(formatName) ? 'carousel' : 'reel' });
    saveDraft(); syncSegs(); renderPiece(); show('create');
    toast('Topic loaded. Tap "Check log and get hooks".');
  }
  function renderIdeas() {
    const out = $('#ideas-out');
    if (!ideas) { out.innerHTML = ''; return; }
    let h = '';
    (ideas.ideas || []).forEach((it, i) => {
      h += `<div class="card"><span class="chip">${esc(it.format)}</span>
        <p style="margin-top:10px"><strong>${esc(it.title)}</strong></p>
        <p class="mini" style="margin-top:6px">${esc(it.angle)}</p>
        <p class="mini" style="margin-top:6px">Why: ${esc(it.why)}</p>
        <p class="mini" style="margin-top:6px">CTA: ${esc(it.cta)} · You supply: ${esc(it.needs)}</p>
        <div class="btns"><button class="btn primary small" type="button" data-act="make" data-i="${i}">Make this</button>
        <button class="btn small" type="button" data-act="backlog" data-i="${i}">Save to backlog</button></div></div>`;
    });
    if ((ideas.dropped || []).length) {
      h += `<details class="card"><summary>Dropped as repeats (${ideas.dropped.length})</summary><ul class="list">${ideas.dropped.map((d) => `<li>${esc(d.idea)}<br><span class="mini">${esc(d.reason)}</span></li>`).join('')}</ul></details>`;
    }
    out.innerHTML = h;
  }
  $('#go-ideas').addEventListener('click', async () => {
    const res = await busy('Finding ideas that are not repeats…', () => gen('ideas', { topic: $('#idea-topic').value.trim() }));
    if (res) { ideas = res; renderIdeas(); }
  });
  $('#ideas-out').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const it = ideas.ideas[+b.dataset.i];
    if (b.dataset.act === 'make') startPiece(`${it.title}. ${it.angle}`, it.format);
    if (b.dataset.act === 'backlog') {
      const ok = await busy('Saving…', async () => { await mutate((s) => { if (!s.backlog.some((x) => x.title === it.title)) s.backlog.push({ id: uid(), title: it.title, format: it.format, angle: it.angle, cta: it.cta, needs: it.needs }); }); return true; });
      if (ok) { renderBacklog(); toast('Added to backlog'); }
    }
  });
  function renderBacklog() {
    const el = $('#backlog');
    if (!S.backlog.length) { el.innerHTML = '<p class="mini">Nothing saved yet.</p>'; return; }
    el.innerHTML = S.backlog.map((b) => `<div class="card"><div class="item"><div><span class="chip">${esc(b.format)}</span>
      <p style="margin-top:8px"><strong>${esc(b.title)}</strong></p><p class="mini" style="margin-top:4px">${esc(b.angle)}</p></div>
      <button class="x" type="button" data-act="del" data-id="${esc(b.id)}" aria-label="Remove">×</button></div>
      <div class="btns"><button class="btn primary small" type="button" data-act="make" data-id="${esc(b.id)}">Make this</button></div></div>`).join('');
  }
  $('#backlog').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const item = S.backlog.find((x) => x.id === b.dataset.id); if (!item) return;
    if (b.dataset.act === 'make') startPiece(`${item.title}. ${item.angle}`, item.format);
    if (b.dataset.act === 'del') {
      const ok = await busy('Removing…', async () => { await mutate((s) => { s.backlog = s.backlog.filter((x) => x.id !== item.id); }); return true; });
      if (ok) renderBacklog();
    }
  });

  /* ---------- week ---------- */
  function nextMonday() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    const add = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + add);
    return d;
  }
  const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const fmtDay = (isoDate) => new Date(isoDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  function slotCard(s, withMake) {
    return `<div class="card"><div class="item"><div><span class="chip scheduled">${esc(s.day)} · ${esc(fmtDay(s.date))}</span> <span class="chip">${esc(s.format)}</span>
      <p style="margin-top:10px"><strong>${esc(s.title)}</strong></p>
      <p class="mini" style="margin-top:6px">${esc(s.hook_direction)}</p>
      <p class="mini" style="margin-top:6px">CTA: ${esc(s.cta)} · You supply: ${esc(s.needs)}</p></div></div>
      ${withMake ? `<div class="btns"><button class="btn primary small" type="button" data-act="make" data-t="${esc(s.title + '. ' + s.hook_direction)}" data-f="${esc(s.format)}">Make this</button></div>` : ''}</div>`;
  }
  function renderWeek() {
    const mon = nextMonday(); const fri = new Date(mon); fri.setDate(fri.getDate() + 4);
    const f = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('#week-range').textContent = `${f(mon)} to ${f(fri)}`;
    const out = $('#week-out');
    out.innerHTML = weekPlan
      ? weekPlan.slots.map((s) => slotCard(s, true)).join('') + `<button class="btn primary block" type="button" data-act="saveplan">Save this plan</button>`
      : '';
    const cal = $('#calendar');
    cal.innerHTML = S.calendar.length
      ? S.calendar.map((p) => `<h3 class="sec" style="margin-top:14px">Week of ${esc(fmtDay(p.weekStart))}</h3>${p.slots.map((s) => slotCard(s, true)).join('')}`).join('')
      : '<p class="mini">No saved plans yet.</p>';
  }
  $('#go-week').addEventListener('click', async () => {
    const weekStart = iso(nextMonday());
    const res = await busy('Planning Monday, Wednesday, Friday…', () => gen('week', { weekStart }));
    if (res && Array.isArray(res.slots)) { weekPlan = { weekStart, slots: res.slots }; renderWeek(); }
  });
  $('#view-week').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'make') startPiece(b.dataset.t, b.dataset.f);
    if (b.dataset.act === 'saveplan') {
      const plan = weekPlan;
      const ok = await busy('Saving…', async () => { await mutate((s) => { s.calendar = [{ id: uid(), weekStart: plan.weekStart, slots: plan.slots }].concat(s.calendar.filter((p) => p.weekStart !== plan.weekStart)).slice(0, 8); }); return true; });
      if (ok) { weekPlan = null; renderWeek(); toast('Plan saved'); }
    }
  });

  /* ---------- log ---------- */
  const NEXT = { produced: 'scheduled', scheduled: 'posted', posted: 'produced' };
  function renderLog() {
    const q = ($('#log-search').value || '').toLowerCase();
    const rows = S.log.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).filter((e) => !q || `${e.title} ${e.angle} ${e.format}`.toLowerCase().includes(q));
    $('#log-list').innerHTML = rows.length
      ? rows.map((e) => `<div class="card"><div class="item"><div>
          <button class="chip ${esc(e.status)}" type="button" data-act="cycle" data-id="${esc(e.id)}" style="cursor:pointer">${esc(e.status)}</button>
          <span class="mini"> ${esc(e.format)} · ${esc(e.date)}</span>
          <p style="margin-top:8px"><strong>${esc(e.title)}</strong></p>
          ${e.angle ? `<p class="mini" style="margin-top:4px">${esc(e.angle)}</p>` : ''}</div>
          <button class="x" type="button" data-act="del" data-id="${esc(e.id)}" aria-label="Delete entry">×</button></div></div>`).join('')
      : '<p class="mini">Nothing matches.</p>';
  }
  $('#log-search').addEventListener('input', renderLog);
  $('#log-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'cycle') {
      const ok = await busy('Updating…', async () => { await mutate((s) => { const x = s.log.find((y) => y.id === id); if (x) x.status = NEXT[x.status] || 'produced'; }); return true; });
      if (ok) renderLog();
    }
    if (b.dataset.act === 'del' && confirm('Delete this entry? The studio will stop checking new ideas against it.')) {
      const ok = await busy('Deleting…', async () => { await mutate((s) => { s.log = s.log.filter((y) => y.id !== id); delete s.pieces[id]; }); return true; });
      if (ok) renderLog();
    }
  });
  $('#l-add').addEventListener('click', async () => {
    const title = $('#l-title').value.trim();
    if (!title) { toast('Add a title.', true); return; }
    const entry = { id: uid(), date: $('#l-date').value || today(), status: $('#l-status').value, format: $('#l-format').value, title, angle: $('#l-angle').value.trim() };
    const ok = await busy('Saving…', async () => { await mutate((s) => { s.log.push(entry); }); return true; });
    if (ok) { ['#l-title', '#l-angle'].forEach((s) => ($(s).value = '')); renderLog(); toast('Added'); }
  });

  /* ---------- boot ---------- */
  function renderAll() {
    renderPiece(); renderBacklog(); renderWeek(); renderLog(); renderIdeas();
    $('#l-date').value = today();
    syncSegs();
  }
  try {
    const d = JSON.parse(ls.get('studio.draft') || 'null');
    if (d && typeof d === 'object') piece = Object.assign(freshPiece(), d);
  } catch {}
  const saved = ls.get('studio.key');
  if (saved) unlock(saved).catch(() => lock());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
