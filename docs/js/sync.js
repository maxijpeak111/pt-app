/* ---------- cloud save ----------
   Every change is also saved to a PRIVATE GitHub repo the owner chose (one JSON file per app),
   so data survives deleting the home-screen icon, clearing Safari, or a new phone, and is shared
   between iPhone and Mac. Uses a fine-grained GitHub access key limited to that one repo.
   - state._at = time of the last real change (stamped only when content actually changes).
   - meta.syncedAt = the _at both sides last agreed on. Local newer → push; cloud newer → take it;
     both changed since → ask which to keep.
   - Each save is a commit in the data repo, so GitHub keeps a full history too. */
(function () {
'use strict';
const X = window.PT;
const CFG = {
  key: 'pt.v1', file: 'pt.json',
  valid: o => !!(o && Array.isArray(o.sessions) && o.settings),
  refresh: () => { if (X.render) X.render(); },
  toast: m => X.toast(m),
  sheet: (t, c) => { const s = X.sheet(t, c); return () => s.close(); },
  confirm: (m, yes) => X.confirm(m, 'Yes', yes),
  field: (l, el) => X.field(l, el)
};
const h = X.h;
const TOKEN = 'cloud.token', REPO = 'cloud.repo', META = CFG.key + '.cloud';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
};
let meta = {};
try { meta = JSON.parse(ls.get(META)) || {}; } catch (e) { meta = {}; }
const saveMeta = () => ls.set(META, JSON.stringify(meta));
const on = () => !!(meta.linked && ls.get(TOKEN) && ls.get(REPO));
const C = X.cloud = { on, status: 'off', msg: '' };

/* ----- stamp real changes ----- */
const body = st => { const c = Object.assign({}, st); delete c._at; delete c._rev; return JSON.stringify(c); };
let last = body(X.state), applying = false, asking = false, timer = null, busy = false, again = false, warned = false;
const origSave = X.save;
X.save = function () {
  const b = body(X.state);
  if (b !== last) { last = b; if (!applying) { X.state._at = Date.now(); X.state._rev = Math.random().toString(36).slice(2, 10); if (on()) { C.status = 'pending'; schedule(); } } }
  return origSave.apply(this, arguments);
};

/* ----- GitHub API ----- */
const api = (path, opt) => fetch('https://api.github.com/repos/' + ls.get(REPO) + path, Object.assign({ cache: 'no-store' }, opt || {}, {
  headers: Object.assign({ Authorization: 'Bearer ' + ls.get(TOKEN), Accept: 'application/vnd.github+json' }, (opt && opt.headers) || {})
}));
const enc = str => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const dec = b64 => { const s = atob(String(b64).replace(/\s/g, '')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); };
function fail(status) {
  const e = new Error(
    status === 401 ? 'Your GitHub access key has stopped working (it may have expired). Make a new one and reconnect.' :
    status === 403 || status === 404 ? 'Your access key can\'t reach that repo. Check the repo name and that the key has Contents: Read and write.' :
    'GitHub had a problem (' + status + ').');
  e.auth = [401, 403, 404].includes(status);
  return e;
}
async function getRemote() {
  const r = await api('/contents/' + CFG.file);
  if (r.status === 404) return { missing: true };
  if (!r.ok) throw fail(r.status);
  const j = await r.json();
  let txt;
  if (j.content && j.encoding === 'base64') txt = dec(j.content);
  else { // files over 1 MB come without content; fetch the blob instead
    const b = await api('/git/blobs/' + j.sha);
    if (!b.ok) throw fail(b.status);
    txt = dec((await b.json()).content);
  }
  return { sha: j.sha, data: JSON.parse(txt) };
}
async function putRemote(sha) {
  const at = X.state._at || 0;
  const r = await api('/contents/' + CFG.file, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Auto-save ' + new Date().toISOString(), content: enc(JSON.stringify(X.state)), sha: sha || undefined })
  });
  if (r.status === 409 || r.status === 422) return false; // cloud changed meanwhile: go round again
  if (!r.ok) throw fail(r.status);
  meta.sha = (await r.json()).content.sha; meta.syncedAt = at;
  return true;
}
function apply(d) {
  applying = true;
  try { X.replaceState(d); X.state._at = d._at || 0; X.save(); }
  finally { applying = false; }
  last = body(X.state); meta.syncedAt = d._at || 0;
  CFG.refresh();
}
function keepCopy() { ls.set(CFG.key + '.before-cloud', JSON.stringify(X.state)); }

/* ----- the sync loop ----- */
function schedule(ms) { clearTimeout(timer); timer = setTimeout(sync, ms == null ? 1500 : ms); }
async function sync() {
  clearTimeout(timer); timer = null;
  if (!on() || asking) return;
  if (!navigator.onLine) { C.status = 'offline'; paint(); return; }
  if (busy) { again = true; return; }
  busy = true; C.status = 'saving'; paint();
  let asked = false;
  try {
    for (let i = 0; i < 3; i++) {
      const rem = await getRemote();
      if (rem.missing) { if (await putRemote(null)) break; continue; }
      const lAt = X.state._at || 0, rAt = rem.data._at || 0, base = meta.syncedAt || 0;
      meta.sha = rem.sha;
      if (rAt === lAt && rem.data._rev === X.state._rev) { meta.syncedAt = lAt; break; }
      const lc = lAt > base, rc = rAt > base || (rAt === lAt && !lc);
      if (lc && rc) { asked = true; askWhich(rem.data, rem.sha); break; }
      if (lc) { if (await putRemote(rem.sha)) break; continue; }
      if (CFG.valid(rem.data)) apply(rem.data);
      break;
    }
    if (!asked) { C.status = 'ok'; C.msg = ''; meta.lastOk = Date.now(); warned = false; }
  } catch (e) {
    C.status = e.auth ? 'auth' : 'error';
    C.msg = e.auth ? e.message : (e.message && e.message.startsWith('GitHub') ? e.message : 'Couldn\'t reach GitHub.');
    if (e.auth && !warned) { warned = true; CFG.toast('Cloud save stopped. Open Settings to fix it.'); }
    if (!e.auth) schedule(60000);
  } finally {
    saveMeta(); busy = false; paint();
    if (again) { again = false; schedule(0); }
  }
}
C.syncNow = () => { asking = false; return sync(); };

/* both this device and the cloud changed since they last matched */
function askWhich(remote, sha) {
  asking = true; C.status = 'ask'; paint();
  const when = t => t ? new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'unknown';
  const close = CFG.sheet('Which version do you want?', h('div', {},
    h('p', {}, 'This device and your other device both changed things since they last matched. Pick the one to keep. The other is kept as a safety copy.'),
    h('button', { class: 'btn block', onclick: () => { close(); asking = false; keepCopy(); apply(remote); C.status = 'ok'; meta.lastOk = Date.now(); saveMeta(); paint(); CFG.toast('Using the cloud version'); } },
      'Cloud version (changed ' + when(remote._at) + ')'),
    h('button', { class: 'btn ghost block', onclick: () => { close(); asking = false; meta.syncedAt = remote._at || 0; meta.sha = sha; X.state._at = Math.max(Date.now(), (remote._at || 0) + 1); origSave(); saveMeta(); sync(); } },
      'This device (changed ' + when(X.state._at) + ')')));
}

/* ----- triggers ----- */
document.addEventListener('visibilitychange', () => { if (on()) sync(); });
window.addEventListener('online', () => { if (on()) sync(); });
setInterval(() => { if (on() && !document.hidden) sync(); }, 120000);
if (on()) setTimeout(sync, 400);
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

/* ----- status + settings ----- */
const ago = t => { if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
C.text = () => !on() ? 'Off. Your data is only on this device.' :
  C.status === 'saving' ? 'Saving to the cloud…' :
  C.status === 'pending' ? 'Saving shortly…' :
  C.status === 'offline' ? 'No internet. Saved on this device and will go to the cloud when you\'re back online.' :
  C.status === 'auth' ? '⚠ ' + C.msg :
  C.status === 'error' ? '⚠ ' + C.msg + ' Saved on this device; it will try again.' :
  C.status === 'ask' ? 'Waiting for you to pick a version.' :
  '✓ Saved to the cloud' + (meta.lastOk ? ' · ' + ago(meta.lastOk) : '');
function paint() { document.querySelectorAll('.cloud-status').forEach(el => { el.textContent = C.text(); }); }

C.card = () => h('div', {},
  h('p', { class: 'small muted', style: { marginTop: 0 } }, on()
    ? 'Every change is saved to your private GitHub repo. If you delete the app or clear Safari, connect again and everything comes back. Your phone and Mac share the same data.'
    : 'Save everything to your own private GitHub repo automatically, so nothing is lost if you delete the app, clear Safari or change phone, and use it on your Mac too.'),
  h('p', { class: 'small cloud-status', style: { fontWeight: 700 } }, C.text()),
  on()
    ? h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn small grow', onclick: () => C.syncNow() }, 'Save now'),
        h('button', { class: 'btn ghost small grow', onclick: connectSheet }, 'Change'))
    : h('button', { class: 'btn small block', onclick: connectSheet }, 'Set up cloud save'),
  on() ? h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => CFG.confirm('Stop cloud saving on this device? Your cloud copy stays safe on GitHub.', () => { meta.linked = false; saveMeta(); C.status = 'off'; CFG.refresh(); CFG.toast('Cloud save off on this device'); }) }, 'Turn off on this device') : null);

function connectSheet() {
  let repo = ls.get(REPO) || '', tok = ls.get(TOKEN) || '';
  const msg = h('p', { class: 'small', style: { fontWeight: 700 } });
  const btn = h('button', { class: 'btn block', onclick: () => go() }, 'Connect');
  const close = CFG.sheet('Cloud save', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'One-time setup on GitHub: make a private repo (for example app-data), then a fine-grained access key for only that repo with Contents set to Read and write. Keep the key somewhere safe, like the Passwords app. You\'ll paste it here on each device.'),
    CFG.field('Repo (yourname/repo)', h('input', { value: repo, placeholder: 'yourname/app-data', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', oninput: e => { repo = e.target.value.trim(); } })),
    CFG.field('Access key', h('input', { type: 'password', value: tok, placeholder: 'github_pat_…', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', oninput: e => { tok = e.target.value.trim(); } })),
    msg, btn));
  async function go() {
    repo = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { msg.textContent = 'Type the repo as yourname/repo-name.'; return; }
    if (!tok) { msg.textContent = 'Paste your access key.'; return; }
    ls.set(REPO, repo); ls.set(TOKEN, tok);
    btn.disabled = true; msg.textContent = 'Checking…';
    try {
      const r = await api('');
      if (!r.ok) throw fail(r.status);
      if (!(await r.json()).private) { msg.textContent = 'That repo is public, so anyone could read your data. Make it private on GitHub (Settings → Danger Zone → Change visibility), then try again.'; btn.disabled = false; return; }
      const rem = await getRemote();
      if (rem.missing) { meta = { linked: true, syncedAt: 0 }; saveMeta(); close(); CFG.toast('Cloud save is on'); await sync(); CFG.refresh(); return; }
      if (!CFG.valid(rem.data)) { msg.textContent = 'The file ' + CFG.file + ' in that repo isn\'t from this app.'; btn.disabled = false; return; }
      close();
      const when = rem.data._at ? new Date(rem.data._at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'earlier';
      const c2 = CFG.sheet('You already have cloud data', h('div', {},
        h('p', {}, 'There\'s saved data in the cloud (last changed ' + when + '). Which do you want?'),
        h('button', { class: 'btn block', onclick: () => { c2(); keepCopy(); meta = { linked: true, sha: rem.sha }; apply(rem.data); meta.lastOk = Date.now(); C.status = 'ok'; saveMeta(); CFG.refresh(); CFG.toast('Your data is back'); } }, 'Use the cloud data (new or reset device)'),
        h('button', { class: 'btn ghost block', onclick: () => CFG.confirm('Replace the cloud copy with what\'s on this device? GitHub still keeps the old version in its history.', () => { meta = { linked: true, sha: rem.sha, syncedAt: rem.data._at || 0 }; X.state._at = Math.max(Date.now(), (rem.data._at || 0) + 1); X.state._rev = 'k' + Date.now(); origSave(); last = body(X.state); saveMeta(); c2(); sync().then(CFG.refresh); }) }, 'Keep this device\'s data')));
    } catch (e) { msg.textContent = e.auth ? e.message : 'Couldn\'t reach GitHub. Check your internet and try again.'; btn.disabled = false; }
  }
}
C.connect = connectSheet;
})();
