(function () {
'use strict';
/* Import calendar data (shifts, other events, planned sessions) pasted from Claude or any other source.
   Data stays on the phone: the text is read here and saved into local storage, nothing is sent anywhere. */
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

/* The instructions you paste into any Claude chat so it replies in the format this app reads. */
PT.IMPORT_PROMPT = [
  'Read my calendar (and my work rota in Notion if you can see it) for the dates I ask for, then reply with ONE code block of JSON in exactly this format for my PT app. No other text inside the code block.',
  '',
  '{',
  '  "ptImport": 1,',
  '  "days": [',
  '    {',
  '      "date": "2026-11-16",',
  '      "shift": { "start": "07:00", "end": "15:00", "label": "Early" },',
  '      "events": [ { "title": "Dentist", "start": "10:00", "end": "10:30" } ],',
  '      "sessions": [ { "name": "Chest day", "intensity": 7 } ],',
  '      "note": ""',
  '    }',
  '  ]',
  '}',
  '',
  'Rules:',
  '- One entry per date, dates as YYYY-MM-DD, times as 24-hour HH:MM.',
  '- "shift" is my paid work shift only (null if I am not working). Only one shift per day.',
  '- "events" is everything else in the calendar that day (appointments, social plans). Leave out all-day events unless they matter; give them no start or end.',
  '- "sessions" is only training I have planned in the calendar. Use the session name as written there. Intensity 1-10, default 7. Leave it empty if unsure.',
  '- Leave out anything you are not sure about rather than guessing.'
].join('\n');

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const t = h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.append(t); t.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ } t.remove(); return Promise.resolve();
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const time = t => { t = String(t || '').trim(); if (!TIME.test(t)) return ''; const [a, b] = t.split(':'); return a.padStart(2, '0') + ':' + b; };
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);

/* Pull the JSON out of whatever was pasted: Claude's code block, extra words around it, or plain JSON. */
function extractJson(text) {
  text = String(text || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch (e) { /* fall through */ }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { /* fall through */ } }
  const c = text.indexOf('['), d = text.lastIndexOf(']');
  if (c >= 0 && d > c) { try { return JSON.parse(text.slice(c, d + 1)); } catch (e) { /* fall through */ } }
  return null;
}

/* Check and tidy the pasted data. Returns { days, problems }. */
function normalise(obj) {
  const list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.days) ? obj.days : null);
  if (!list) return null;
  const problems = [], byDate = {};
  list.forEach((d, i) => {
    if (!d || !DATE.test(String(d.date || '')) || isNaN(PT.parse(d.date))) { problems.push('Skipped entry ' + (i + 1) + ': missing or bad date'); return; }
    const out = byDate[d.date] || (byDate[d.date] = { date: d.date, shift: undefined, events: [], sessions: [], note: '' });
    if (d.shift === null) out.shift = null;
    else if (d.shift && typeof d.shift === 'object') {
      const s = time(d.shift.start), e = time(d.shift.end);
      if (s && e) out.shift = { start: s, end: e, label: str(d.shift.label, 40) };
      else problems.push(d.date + ': shift skipped (times need to be HH:MM)');
    }
    (Array.isArray(d.events) ? d.events : []).forEach(ev => {
      const title = str(ev && ev.title, 80); if (!title) return;
      out.events.push({ title, start: time(ev.start), end: time(ev.end) });
    });
    (Array.isArray(d.sessions) ? d.sessions : []).forEach(se => {
      const name = str(typeof se === 'string' ? se : se && se.name, 80); if (!name) return;
      let i2 = Math.round(+((se && se.intensity) || 7)); if (!(i2 >= 1 && i2 <= 10)) i2 = 7;
      out.sessions.push({ name, intensity: i2 });
    });
    const note = str(d.note, 1000); if (note) out.note = out.note ? out.note + '\n' + note : note;
  });
  const days = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : 1);
  return { days, problems };
}

const findSession = name => {
  const n = name.toLowerCase();
  return PT.state.sessions.find(s => s.name.trim().toLowerCase() === n);
};

/* Save it. Re-importing the same dates updates them instead of doubling up. */
function apply(days) {
  const r = { shifts: 0, events: 0, sessions: 0, unknown: new Set() };
  days.forEach(d => {
    const day = PT.ensureDay(d.date);
    if (d.shift !== undefined) { day.shift = d.shift ? Object.assign({}, d.shift) : null; if (d.shift) r.shifts++; }
    if (d.events.length || d.shift !== undefined) {
      // imported events for this date are replaced by the new import; ones you typed in the app are kept
      day.events = (day.events || []).filter(e => !e.imported).concat(d.events.map(e => Object.assign({ id: PT.uid(), imported: true }, e)));
      r.events += d.events.length;
    }
    d.sessions.forEach(se => {
      const s = findSession(se.name);
      if (!s) { r.unknown.add(se.name); return; }
      if (day.items.some(it => it.sessionId === s.id)) return; // already planned that day
      day.items.push({ id: PT.uid(), sessionId: s.id, intensity: se.intensity, logId: null }); r.sessions++;
    });
    if (d.note && !(day.note || '').includes(d.note)) day.note = day.note ? day.note + '\n' + d.note : d.note;
  });
  PT.save();
  return r;
}

function summary(days) {
  const n = k => days.reduce((a, d) => a + (k === 'shift' ? (d.shift ? 1 : 0) : d[k].length), 0);
  return days.length + ' days (' + PT.niceDate(days[0].date) + ' to ' + PT.niceDate(days[days.length - 1].date) + '): ' +
    n('shift') + ' shifts, ' + n('events') + ' other events, ' + n('sessions') + ' sessions.';
}

PT.importSheet = function () {
  let text = '';
  const status = h('div', { class: 'small muted' });
  const area = h('textarea', { placeholder: 'Paste what Claude gave you here', style: { minHeight: '140px' }, oninput: e => { text = e.target.value; status.textContent = ''; } });
  const sh = PT.sheet('Import calendar', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } }, '1. Tap "Copy instructions" and paste them into a Claude chat with your calendar connected, e.g. "Do this for the next 2 weeks". 2. Copy Claude\'s reply. 3. Paste it below and tap Import.'),
    h('button', { class: 'btn ghost small block', onclick: () => copyText(PT.IMPORT_PROMPT).then(() => PT.toast('Instructions copied')) }, 'Copy instructions for Claude'),
    gap(10),
    h('button', { class: 'btn ghost small block', onclick: () => {
      if (!navigator.clipboard || !navigator.clipboard.readText) { PT.toast('Long-press the box and tap Paste'); return; }
      navigator.clipboard.readText().then(t => { text = t; area.value = t; }).catch(() => PT.toast('Long-press the box and tap Paste'));
    } }, 'Paste from clipboard'),
    gap(8), area, gap(8), status, gap(8),
    h('button', { class: 'btn block', onclick: () => {
      const res = normalise(extractJson(text));
      if (!res) { status.textContent = 'Could not read that. Make sure you copied the whole code block from Claude.'; return; }
      if (!res.days.length) { status.textContent = 'Nothing to import. ' + res.problems.join('. '); return; }
      const msg = 'Import ' + summary(res.days) + ' Shifts on these days will be replaced; your sessions and logs are kept.' + (res.problems.length ? ' Warnings: ' + res.problems.join('; ') + '.' : '');
      PT.confirm(msg, 'Import', () => {
        const r = apply(res.days);
        sh.close();
        const pl = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
        PT.toast('Imported ' + pl(r.shifts, 'shift') + ', ' + pl(r.events, 'event') + ', ' + pl(r.sessions, 'session'));
        if (r.unknown.size) {
          PT.sheet('Some sessions not found', h('div', {},
            h('p', {}, 'These names did not match a saved session, so they were not added. Build them in Sessions (same name) and import again, or add them by hand:'),
            h('ul', { class: 'plain' }, [...r.unknown].map(n => h('li', {}, n)))));
        }
        location.hash = '#/plan'; PT.render();
      });
    } }, 'Import')));
  return sh;
};

/* Small list of a day's other calendar events, used on the week and day screens. */
PT.eventsText = ev => (ev.start ? ev.start + (ev.end ? '–' + ev.end : '') + ' ' : '') + ev.title;
})();
