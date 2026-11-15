(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

/* ---------- weekly progress photos ----------
   Four relaxed angles each week, compared side by side. Photos are shrunk and kept in this phone's
   IndexedDB (they are too big for the main save); state.photos[weekStart][pose] only notes that one exists.
   They are not part of backup files. */
PT.POSES = [
  ['front', 'Front', 'Face the camera. Feet hip-width apart, arms relaxed by your sides, stand tall. Don\'t flex or suck in.'],
  ['left', 'Left side', 'Left side to the camera. Arms relaxed and slightly forward so they don\'t hide your waist.'],
  ['back', 'Back', 'Back to the camera, same stance as the front, arms relaxed.'],
  ['right', 'Right side', 'Right side to the camera, same as the left.']
];
const TIPS = 'Same day each week, first thing in the morning before eating or training. Same spot, same light, same clothes. Phone at chest height about 2–3 m away (lean it on something and use the timer). These keep the comparison fair.';

let dbp;
const db = () => dbp || (dbp = new Promise((res, rej) => {
  const r = indexedDB.open('pt-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('photos');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => {
  const t = d.transaction('photos', mode), req = fn(t.objectStore('photos'));
  t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
}));
const keyOf = (wk, pose) => wk + '|' + pose;
const putPhoto = (k, blob) => tx('readwrite', st => st.put(blob, k));
const getPhoto = k => tx('readonly', st => st.get(k));
const delPhoto = k => tx('readwrite', st => st.delete(k));

// Shrink to max 1200 px JPEG so a year of photos stays small.
const shrink = file => new Promise((res, rej) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    c.toBlob(b => b ? res(b) : rej(new Error('Could not read that photo')), 'image/jpeg', 0.82);
  };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that photo')); };
  img.src = url;
});
// An <img> that fills itself from storage.
const photoImg = (wk, pose, cls) => {
  const img = h('img', { class: cls || 'pp-img', alt: pose + ' ' + wk });
  getPhoto(keyOf(wk, pose)).then(b => { if (b) { const u = URL.createObjectURL(b); img.onload = () => URL.revokeObjectURL(u); img.src = u; } }).catch(() => {});
  return img;
};
const weeks = () => Object.keys(PT.state.photos || {}).filter(w => Object.values(PT.state.photos[w]).some(Boolean)).sort();
const weekLabel = wk => PT.niceDate(wk) + ' – ' + PT.niceDate(PT.addDays(wk, 6));
const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
PT.photoDaySelect = () => {
  const st = PT.state.settings, cur = st.photoDay == null ? 0 : +st.photoDay;
  return h('select', { onchange: e => { st.photoDay = +e.target.value; PT.save(); } }, DAYS.map(([v, l]) => h('option', { value: v, selected: v === cur }, l)));
};

// Card on the Plan tab on your photo day until this week's four are in.
PT.photoNudge = () => {
  const st = PT.state.settings, day = st.photoDay == null ? 0 : +st.photoDay, today = PT.today();
  if (PT.parse(today).getDay() !== day || st.photoSnooze === today) return null;
  const have = PT.state.photos[PT.weekStart(today)] || {};
  const n = PT.POSES.filter(([p]) => have[p]).length;
  if (n >= PT.POSES.length) return null;
  return h('div', { class: 'card reminder' },
    h('b', { class: 'red' }, 'Progress photos due today'),
    h('div', { class: 'small', style: { margin: '4px 0 10px' } }, n ? n + ' of 4 done this week.' : 'Front, left side, back and right side. Morning, before eating.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn small grow', href: '#/more/photos' }, 'Take photos'),
      h('button', { class: 'btn ghost small', onclick: () => { st.photoSnooze = today; PT.save(); PT.render(); } }, 'Later')));
};

PT.moreViews.photos = function () {
  const s = PT.state, wk = PT.weekStart(PT.today());
  s.photos = s.photos || {};
  const root = h('div', {});
  function tile(pose, label) {
    const has = !!(s.photos[wk] || {})[pose];
    const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    input.addEventListener('change', () => {
      const f = input.files[0]; if (!f) return;
      PT.toast('Saving…');
      shrink(f).then(b => putPhoto(keyOf(wk, pose), b)).then(() => {
        (s.photos[wk] = s.photos[wk] || {})[pose] = true; PT.save(); PT.toast(label + ' saved'); draw();
      }).catch(e => PT.toast(e.message || 'Could not save the photo'));
    });
    return h('div', { class: 'pp-tile', onclick: () => input.click() }, input,
      has ? photoImg(wk, pose) : h('div', { class: 'pp-empty' }, h('b', {}, '+'), h('span', { class: 'small' }, 'Add')),
      h('div', { class: 'pp-label' }, label, has ? h('span', { class: 'red' }, ' · retake') : null));
  }
  function compare() {
    const box = h('div', {});
    const all = weeks();
    if (all.length < 2) return h('div', { class: 'small muted' }, 'Once you have two weeks of photos you can compare them here.');
    let pose = 'front', a = all[0], b = all[all.length - 1];
    const draw2 = () => {
      const withPose = all.filter(w => (s.photos[w] || {})[pose]);
      if (!withPose.includes(a)) a = withPose[0]; if (!withPose.includes(b)) b = withPose[withPose.length - 1];
      const sel = (val, on) => h('select', { onchange: e => { on(e.target.value); draw2(); } }, withPose.map(w => h('option', { value: w, selected: w === val }, 'Week of ' + PT.niceDate(w))));
      PT.fill(box,
        PT.seg(PT.POSES.map(([p, l]) => [p, l]), pose, v => { pose = v; draw2(); }), gap(8),
        withPose.length < 2 ? h('div', { class: 'small muted' }, 'Need this pose in at least two weeks.') : [
          h('div', { class: 'grid2' }, sel(a, v => a = v), sel(b, v => b = v)), gap(8),
          h('div', { class: 'grid2' },
            h('div', {}, photoImg(a, pose, 'pp-img big'), h('div', { class: 'small muted' }, PT.niceDate(a))),
            h('div', {}, photoImg(b, pose, 'pp-img big'), h('div', { class: 'small muted' }, PT.niceDate(b))))]);
    };
    draw2();
    return box;
  }
  function draw() {
    const past = weeks().filter(w => w !== wk).reverse();
    PT.fill(root, PT.back('#/more', 'More'), h('h1', {}, 'Progress photos'),
      h('details', { class: 'section' }, h('summary', {}, h('div', { class: 'grow' }, h('div', { class: 'sec-title' }, 'How to take them')), h('span', { class: 'chev' })),
        h('div', { class: 'sec-body' }, h('p', { class: 'small', style: { marginTop: 0 } }, TIPS),
          PT.POSES.map(([p, l, how]) => h('div', { class: 'small', style: { margin: '6px 0' } }, h('b', {}, l + ': '), how)))),
      h('h2', {}, 'This week · ' + weekLabel(wk)),
      h('div', { class: 'pp-grid' }, PT.POSES.map(([p, l]) => tile(p, l))),
      h('h2', {}, 'Compare'), h('div', { class: 'card' }, compare()),
      h('h2', {}, past.length ? 'Past weeks' : 'Past weeks · none yet'),
      past.map(w => h('div', { class: 'card' }, h('b', {}, weekLabel(w)),
        h('div', { class: 'pp-row' }, PT.POSES.map(([p, l]) => (s.photos[w] || {})[p] ? h('div', { onclick: () => { const sh = PT.sheet(l + ' · ' + PT.niceDate(w), h('div', {}, photoImg(w, p, 'pp-img big'))); return sh; } }, photoImg(w, p, 'pp-thumb')) : h('div', { class: 'pp-thumb pp-none' }, '–'))),
        h('button', { class: 'btn ghost small', style: { marginTop: '8px' }, onclick: () => PT.confirm('Delete the photos for ' + weekLabel(w) + '?', 'Delete', () => {
          Promise.all(PT.POSES.map(([p]) => delPhoto(keyOf(w, p)))).then(() => { delete s.photos[w]; PT.save(); draw(); });
        }) }, 'Delete this week'))),
      h('h2', {}, 'Photo day'),
      h('div', { class: 'card' }, PT.field('Remind me on', PT.photoDaySelect()), h('p', { class: 'small muted' }, 'A card appears on the Plan tab that day until your four photos are in.')),
      h('p', { class: 'small muted' }, 'Your photos stay on this phone only. They are not sent anywhere and are not included in backup files.'));
  }
  draw();
  return root;
};
})();
