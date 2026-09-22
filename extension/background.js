// Keeps dynamic content-script registrations in sync with the Blackboard sites
// the user has granted access to from the popup.

const idFor = (origin) => 'bbcol-' + origin.replace(/[^a-z0-9]/gi, '_');
const originOf = (pattern) => pattern.replace(/\/\*$/, '');

async function register(origin) {
  const id = idFor(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [`${origin}/ultra/*`],
    js: ['content.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }]);
}

async function unregister(origin) {
  const id = idFor(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
}

// Inject into already-open tabs for this site so it works without a reload.
// (The popup often closes when Chrome shows the permission prompt, so this
// can't rely on the popup finishing its own work.)
async function injectOpenTabs(origin) {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: `${origin}/ultra/*` }); } catch {}
  for (const t of tabs) {
    try { await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: false }, files: ['content.js'] }); } catch {}
  }
}

async function syncAll() {
  const { origins = [] } = await chrome.permissions.getAll();
  const granted = origins.filter((o) => o.startsWith('https://') && o !== 'https://*/*').map(originOf);
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  for (const s of scripts) {
    const origin = s.matches[0].replace(/\/ultra\/\*$/, '');
    if (!granted.includes(origin)) await chrome.scripting.unregisterContentScripts({ ids: [s.id] });
  }
  for (const o of granted) await register(o);
}

chrome.runtime.onInstalled.addListener(syncAll);
chrome.runtime.onStartup.addListener(syncAll);

chrome.permissions.onAdded.addListener(async ({ origins = [] }) => {
  for (const o of origins) {
    const origin = originOf(o);
    await register(origin);
    await injectOpenTabs(origin);
  }
});
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  for (const o of origins) await unregister(originOf(o));
});

// Popup asks us to register + inject right away after a grant
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'enable' && msg.origin) {
    (async () => {
      await register(msg.origin);
      if (msg.tabId != null) {
        try { await chrome.scripting.executeScript({ target: { tabId: msg.tabId }, files: ['content.js'] }); } catch {}
      }
      sendResponse({ ok: true });
    })().catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
