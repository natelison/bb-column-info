const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function grantedOrigins() {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((o) => o.startsWith('https://') && o !== 'https://*/*').map((o) => o.replace(/\/\*$/, ''));
}

async function renderSites() {
  const list = await grantedOrigins();
  const ul = $('sites');
  if (!list.length) { ul.innerHTML = '<li class="muted">None yet</li>'; return; }
  ul.innerHTML = list.map((o) =>
    `<li><span>${esc(new URL(o).host)}</span><button class="link" data-remove="${esc(o)}">Remove</button></li>`).join('');
}

async function renderCurrent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const box = $('current');
  let url;
  try { url = new URL(tab?.url || ''); } catch { url = null; }

  if (!url || url.protocol !== 'https:' || !url.pathname.startsWith('/ultra')) {
    box.innerHTML = `<p class="muted">Open your Blackboard Learn Ultra site (any page under <code>/ultra</code>), then click this icon to turn it on.</p>`;
    return;
  }

  const origin = url.origin;
  const enabled = (await grantedOrigins()).includes(origin);
  if (enabled) {
    box.innerHTML = `<p class="ok">✓ On for <span class="host">${esc(url.host)}</span></p>
      <p class="muted">Hover any column header in the gradebook grid view.</p>`;
    return;
  }

  box.innerHTML = `<p>Turn on column info for <span class="host">${esc(url.host)}</span>?</p>
    <p class="muted">Chrome will ask to allow access to this site only.</p>
    <button id="enable">Enable on this site</button>`;

  $('enable').addEventListener('click', async (e) => {
    e.target.disabled = true;
    // Must be called directly from the click (user gesture)
    const ok = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!ok) { e.target.disabled = false; return; }
    await chrome.runtime.sendMessage({ type: 'enable', origin, tabId: tab.id });
    await renderCurrent();
    await renderSites();
  });
}

$('sites').addEventListener('click', async (e) => {
  const origin = e.target.dataset?.remove;
  if (!origin) return;
  await chrome.permissions.remove({ origins: [`${origin}/*`] }); // background unregisters on onRemoved
  await renderCurrent();
  await renderSites();
});

renderCurrent();
renderSites();
