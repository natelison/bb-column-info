// ==UserScript==
// @name         Blackboard Ultra - Gradebook Column Info Overlay
// @namespace    bb-ultra-gradebook-column-overlay
// @version      1.3.0
// @description  Hover a gradebook column header to see its REST API details (ID, points, category, schema, dates, etc.)
// @author       Nate Lison
// @match        https://*/ultra/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const HOST = location.origin; // works on any Blackboard Learn Ultra host

  // Bail out on non-Blackboard sites that happen to have an /ultra/courses/ path
  if (!document.querySelector('meta[name="application-name"][content*="Blackboard" i], link[href*="blackboardcdn.com"], script[src*="blackboardcdn.com"]')
      && !/blackboard/i.test(document.title)) {
    return;
  }
  const GRADES_PATH = /\/ultra\/courses\/_\d+_1\/grades/;
  const HOVER_DELAY_MS = 350;   // wait before fetching/showing
  const HIDE_DELAY_MS = 250;    // grace period to move mouse into the overlay
  const HEADER_SELECTOR = 'button[data-column-header-id]';

  // ---------- caches ----------
  const columnCache = new Map();    // key: courseId|columnId -> Promise<json>
  const categoryCache = new Map();  // key: courseId|catId -> Promise<string>
  const schemaCache = new Map();    // key: courseId|schemaId -> Promise<string>

  // ---------- helpers ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString();
  };

  const yesNo = (b) => (b === true ? 'Yes' : b === false ? 'No' : '—');

  function getCourseId() {
    const m = location.pathname.match(/\/courses\/(_\d+_1)/);
    return m ? m[1] : null;
  }

  async function getJson(url) {
    const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function cached(map, key, loader) {
    if (!map.has(key)) {
      const p = loader().catch((err) => {
        map.delete(key); // allow retry on next hover
        throw err;
      });
      map.set(key, p);
    }
    return map.get(key);
  }

  const fetchColumn = (courseId, colId) =>
    cached(columnCache, `${courseId}|${colId}`, () =>
      getJson(`${HOST}/learn/api/public/v2/courses/${courseId}/gradebook/columns/${colId}`)
    );

  const fetchCategoryName = (courseId, catId) =>
    cached(categoryCache, `${courseId}|${catId}`, () =>
      getJson(`${HOST}/learn/api/public/v1/courses/${courseId}/gradebook/categories/${catId}`)
        .then((j) => j.title || j.name || catId)
    );

  const fetchSchemaName = (courseId, schemaId) =>
    cached(schemaCache, `${courseId}|${schemaId}`, () =>
      getJson(`${HOST}/learn/api/public/v1/courses/${courseId}/gradebook/schemas/${schemaId}`)
        .then((j) => j.title || schemaId)
    );

  // ---------- overlay ----------
  const style = document.createElement('style');
  style.textContent = `
    #bbColOverlay {
      --bbo-bg: #ffffff;
      --bbo-text: #262626;
      --bbo-muted: #6e6e6e;
      --bbo-border: #cdcdcd;
      --bbo-divider: #e5e5e5;
      --bbo-accent: #006ce0;
      --bbo-accent-hover: #f0f6fd;
      --bbo-code-bg: #f4f4f4;
      --bbo-err: #c01e1e;
      position: fixed; z-index: 2147483647; display: none;
      min-width: 300px; max-width: 420px;
      background: var(--bbo-bg); color: var(--bbo-text);
      border: 1px solid var(--bbo-border); border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
      font-family: var(--bbo-font, "Open Sans", "Segoe UI", system-ui, sans-serif);
      font-size: 13px; line-height: 1.5;
      padding: 12px 14px;
    }
    #bbColOverlay .hdr {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
      margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--bbo-divider);
    }
    #bbColOverlay h4 {
      margin: 0; font-size: 14px; font-weight: 600; color: var(--bbo-text); word-break: break-word;
    }
    #bbColOverlay .mode {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      font-size: 11px; color: var(--bbo-muted); cursor: pointer; user-select: none; margin-top: 2px;
    }
    #bbColOverlay .mode input { position: absolute; opacity: 0; width: 0; height: 0; }
    #bbColOverlay .mode .track {
      position: relative; width: 26px; height: 14px; border-radius: 7px;
      background: var(--bbo-border); transition: background .15s;
    }
    #bbColOverlay .mode .thumb {
      position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%;
      background: #fff; transition: left .15s;
    }
    #bbColOverlay .mode input:checked + .track { background: var(--bbo-accent); }
    #bbColOverlay .mode input:checked + .track .thumb { left: 14px; }
    #bbColOverlay .mode input:checked ~ .lbl { color: var(--bbo-accent); }
    #bbColOverlay .mode input:focus-visible + .track { outline: 2px solid var(--bbo-accent); outline-offset: 1px; }
    #bbColOverlay table { border-collapse: collapse; width: 100%; }
    #bbColOverlay td { padding: 3px 0; vertical-align: top; }
    #bbColOverlay tr + tr td { border-top: 1px solid #f2f2f2; }
    #bbColOverlay td.k { color: var(--bbo-muted); padding-right: 12px; white-space: nowrap; }
    #bbColOverlay td.v { color: var(--bbo-text); word-break: break-all; }
    #bbColOverlay code {
      background: var(--bbo-code-bg); color: var(--bbo-text);
      padding: 0 4px; border-radius: 3px; font-size: 12px;
    }
    #bbColOverlay .actions {
      margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--bbo-divider);
      display: flex; gap: 8px;
    }
    #bbColOverlay .actions a, #bbColOverlay .actions button {
      background: var(--bbo-bg); color: var(--bbo-accent);
      border: 1px solid var(--bbo-accent); border-radius: 4px;
      padding: 3px 10px; font: inherit; font-size: 12px; font-weight: 600;
      cursor: pointer; text-decoration: none;
    }
    #bbColOverlay .actions button:hover, #bbColOverlay .actions a:hover { background: var(--bbo-accent-hover); }
    #bbColOverlay .actions button:focus-visible, #bbColOverlay .actions a:focus-visible {
      outline: 2px solid var(--bbo-accent); outline-offset: 1px;
    }
    #bbColOverlay .err { color: var(--bbo-err); }
    #bbColOverlay .muted { color: var(--bbo-muted); }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'bbColOverlay';
  document.body.appendChild(overlay);

  let showTimer = null;
  let hideTimer = null;
  let activeKey = null;

  function position(anchor) {
    const r = anchor.getBoundingClientRect();
    const ow = overlay.offsetWidth;
    const oh = overlay.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - ow - 8);
    let top = r.bottom + 6;
    if (top + oh > window.innerHeight - 8) top = Math.max(8, r.top - oh - 6);
    overlay.style.left = `${Math.max(8, left)}px`;
    overlay.style.top = `${top}px`;
  }

  function row(k, v) {
    return `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`;
  }

  // ---------- view mode (regular / advanced), persisted per browser ----------
  const MODE_KEY = 'bbColOverlay.advanced';
  let advanced = (() => { try { return localStorage.getItem(MODE_KEY) === '1'; } catch { return false; } })();
  function setAdvanced(on) {
    advanced = on;
    try { localStorage.setItem(MODE_KEY, on ? '1' : '0'); } catch {}
  }

  let lastRender = null;   // args of last render, for re-rendering on toggle
  let lastAnchor = null;

  function render(col, courseId, catName, schemaName) {
    lastRender = [col, courseId, catName, schemaName];
    const g = col.grading || {};
    const adv = advanced;
    const idHint = (id) => (adv ? ` <span class="muted">(${esc(id ?? '—')})</span>` : '');

    const rows = [
      adv ? row('Column ID', `<code>${esc(col.id)}</code>`) : '',
      adv && col.externalId ? row('External ID', esc(col.externalId)) : '',
      row('Points possible', esc(col.score?.possible ?? '—')),
      row('Available', esc(col.availability?.available ?? '—')),
      row('Grading type', esc(g.type ?? '—')),
      g.due ? row('Due', esc(fmtDate(g.due))) : '',
      g.attemptsAllowed != null ? row('Attempts allowed', esc(g.attemptsAllowed)) : '',
      g.scoringModel ? row('Scoring model', esc(g.scoringModel)) : '',
      row('Schema', `${esc(schemaName ?? g.schemaId ?? '—')}${idHint(g.schemaId)}`),
      row('Category', `${esc(catName ?? col.gradebookCategoryId ?? '—')}${idHint(col.gradebookCategoryId)}`),
      row('In calculations', yesNo(col.includeInCalculations)),
      adv ? row('Stats to students', yesNo(col.showStatisticsToStudents)) : '',
      adv && col.contentId ? row('Content ID', `<code>${esc(col.contentId)}</code>`) : '',
      row('Created', esc(fmtDate(col.created))),
      row('Modified', esc(fmtDate(col.modified))),
    ].join('');

    const apiUrl = `${HOST}/learn/api/public/v2/courses/${courseId}/gradebook/columns/${col.id}`;
    overlay.innerHTML = `
      <div class="hdr">
        <h4>${esc(col.name)}</h4>
        <label class="mode" title="Show IDs and API tools">
          <input type="checkbox" data-mode-toggle ${adv ? 'checked' : ''}>
          <span class="track"><span class="thumb"></span></span>
          <span class="lbl">Advanced</span>
        </label>
      </div>
      <table>${rows}</table>
      ${adv ? `
      <div class="actions">
        <button type="button" data-copy="${esc(col.id)}">Copy ID</button>
        <a href="${esc(apiUrl)}" target="_blank" rel="noopener">Raw JSON</a>
      </div>` : ''}`;
  }

  // Pull font + text color from the live gradebook header so the overlay tracks Ultra's theme
  let themeSynced = false;
  function syncTheme(btn) {
    if (themeSynced) return;
    const label = btn.querySelector('span') || btn;
    const cs = getComputedStyle(label);
    if (cs.fontFamily) overlay.style.setProperty('--bbo-font', cs.fontFamily);
    if (cs.color) overlay.style.setProperty('--bbo-text', cs.color);
    themeSynced = true;
  }

  async function show(btn) {
    const courseId = getCourseId();
    const colId = btn.getAttribute('data-column-header-id');
    if (!courseId || !colId) return;

    const key = `${courseId}|${colId}`;
    activeKey = key;

    syncTheme(btn);
    lastAnchor = btn;
    overlay.innerHTML = `<span class="muted">Loading ${esc(colId)}…</span>`;
    overlay.style.display = 'block';
    position(btn);

    try {
      const col = await fetchColumn(courseId, colId);
      const [catName, schemaName] = await Promise.all([
        col.gradebookCategoryId ? fetchCategoryName(courseId, col.gradebookCategoryId).catch(() => null) : null,
        col.grading?.schemaId ? fetchSchemaName(courseId, col.grading.schemaId).catch(() => null) : null,
      ]);
      if (activeKey !== key) return; // user moved on
      render(col, courseId, catName, schemaName);
    } catch (err) {
      if (activeKey !== key) return;
      overlay.innerHTML = `<span class="err">Failed to load ${esc(colId)}: ${esc(err.message)}</span>`;
    }
    position(btn);
  }

  function hide() {
    overlay.style.display = 'none';
    activeKey = null;
  }

  // ---------- events (delegated; survives Ultra re-renders) ----------
  document.addEventListener('mouseover', (e) => {
    if (!GRADES_PATH.test(location.pathname)) return;
    const btn = e.target.closest?.(HEADER_SELECTOR);
    if (btn) {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => show(btn), HOVER_DELAY_MS);
    } else if (overlay.contains(e.target)) {
      clearTimeout(hideTimer);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const from = e.target.closest?.(HEADER_SELECTOR) || (overlay.contains(e.target) ? overlay : null);
    if (!from) return;
    if (e.relatedTarget && (from.contains(e.relatedTarget) || overlay.contains(e.relatedTarget))) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  });

  overlay.addEventListener('change', (e) => {
    if (!e.target.matches('input[data-mode-toggle]')) return;
    setAdvanced(e.target.checked);
    if (lastRender) {
      render(...lastRender);
      overlay.querySelector('input[data-mode-toggle]')?.focus();
      if (lastAnchor?.isConnected) position(lastAnchor);
    }
  });

  overlay.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy ID'), 1200);
    } catch {
      btn.textContent = 'Copy failed';
    }
  });

  // Hide when the grid scrolls horizontally (header positions shift via translateX)
  document.addEventListener('scroll', () => { if (overlay.style.display === 'block') hide(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();
