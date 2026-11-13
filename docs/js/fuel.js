(function () {
'use strict';
const PT = window.PT, h = PT.h;
const num = v => (v === '' || v == null) ? 0 : +v;
const g0 = n => Math.round(n);
const gap = px => h('div', { style: { height: px + 'px' } });

PT.views.fuel = function (parts) {
  if (parts[1] === 'foods') return foodsView();
  if (parts[1] === 'meals') return mealsView();
  return diaryView(parts[1] || PT.today());
};

function meter(label, val, target, unit) {
  const pct = target ? Math.min(100, val / target * 100) : 0;
  return h('div', { style: { marginBottom: '10px' } },
    h('div', { class: 'row between small' }, h('b', {}, label), h('span', { class: 'muted' }, g0(val) + (target ? ' / ' + target : '') + ' ' + unit)),
    h('div', { class: 'bar' + (target && val >= target ? ' ok' : '') }, h('i', { style: { width: pct + '%' } })));
}

/* ---------- daily diary ---------- */
function diaryView(date) {
  const log = PT.state.foodLog[date] || [], t = PT.state.settings.targets, tot = PT.sumMacros(log);
  const hasTargets = num(t.kcal) || num(t.p) || num(t.c) || num(t.f);
  return h('div', {},
    h('h1', {}, 'Fuel'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, -1); } }, '‹'),
      h('div', { class: 'week-title' }, date === PT.today() ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)),
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, 1); } }, '›')),
    h('div', { class: 'card' },
      meter('Calories', tot.kcal, num(t.kcal), 'kcal'), meter('Protein', tot.p, num(t.p), 'g'),
      meter('Carbs', tot.c, num(t.c), 'g'), meter('Fat', tot.f, num(t.f), 'g'),
      !hasTargets ? h('div', { class: 'small muted' }, 'No targets set yet. Tap Targets below.') : null),
    h('button', { class: 'btn block', onclick: () => addSheet(date) }, '+ Add food or meal'),
    h('h2', {}, 'Eaten'),
    log.length ? log.map(e => h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', {}, e.label), h('button', { class: 'btn danger small', onclick: () => { PT.state.foodLog[date] = log.filter(x => x.id !== e.id); PT.save(); PT.render(); } }, '✕')),
      h('div', { class: 'small muted' }, g0(e.kcal) + ' kcal · P ' + PT.r1(e.p) + ' · C ' + PT.r1(e.c) + ' · F ' + PT.r1(e.f)))) : h('div', { class: 'empty' }, 'Nothing logged for this day.'),
    h('h2', {}, 'Set up'),
    h('div', { class: 'grid3' },
      h('a', { class: 'btn ghost small', href: '#/fuel/foods' }, 'My foods'),
      h('a', { class: 'btn ghost small', href: '#/fuel/meals' }, 'My meals'),
      h('button', { class: 'btn ghost small', onclick: targetsSheet }, 'Targets')));
}

function addEntry(date, entry) {
  (PT.state.foodLog[date] = PT.state.foodLog[date] || []).push(Object.assign({ id: PT.uid() }, entry));
  PT.save(); PT.render();
}

function addSheet(date) {
  const wrap = h('div', {});
  const sh = PT.sheet('Add to ' + PT.niceDate(date), wrap);
  const tab = { v: PT.state.foods.length || !PT.state.meals.length ? 'foods' : 'meals' };
  function show() {
    wrap.replaceChildren(
      PT.seg([['foods', 'Foods'], ['meals', 'Meals'], ['quick', 'Quick add']], tab.v, v => { tab.v = v; show(); }),
      gap(12), tab.v === 'foods' ? foodPicker() : tab.v === 'meals' ? mealPicker() : quickForm());
  }
  function foodPicker() {
    if (!PT.state.foods.length) return h('div', { class: 'empty' }, 'No foods saved yet.', h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn small', onclick: () => { sh.close(); foodForm(null); } }, '+ Create a food')));
    return h('div', {}, PT.state.foods.map(f => h('div', { class: 'card tap', onclick: () => gramsStep(f) },
      h('b', {}, f.name), h('div', { class: 'small muted' }, 'per 100g: ' + f.kcal + ' kcal · P ' + f.p + ' · C ' + f.c + ' · F ' + f.f))));
  }
  function gramsStep(f) {
    let grams = 100;
    const out = h('div', { class: 'small muted' });
    const upd = () => { const m = PT.macrosOf(f, num(grams)); out.textContent = g0(m.kcal) + ' kcal · P ' + PT.r1(m.p) + ' · C ' + PT.r1(m.c) + ' · F ' + PT.r1(m.f); };
    upd();
    wrap.replaceChildren(h('b', {}, f.name), gap(10),
      PT.field('Amount (grams)', PT.numInput(grams, v => { grams = v; upd(); }, '100', '1')), out, gap(12),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost grow', onclick: show }, 'Back'),
        h('button', { class: 'btn grow', onclick: () => {
          if (!num(grams)) { PT.toast('Enter grams'); return; }
          const m = PT.macrosOf(f, num(grams)); sh.close(); addEntry(date, { label: f.name + ' ' + num(grams) + 'g', grams: num(grams), kcal: m.kcal, p: m.p, c: m.c, f: m.f });
        } }, 'Add')));
  }
  function mealPicker() {
    if (!PT.state.meals.length) return h('div', { class: 'empty' }, 'No meals saved yet.', h('div', { style: { marginTop: '10px' } }, h('a', { class: 'btn small', href: '#/fuel/meals', onclick: () => sh.close() }, 'Build a meal')));
    return h('div', {}, PT.state.meals.map(m => { const t = PT.mealTotals(m); return h('div', { class: 'card tap', onclick: () => portionStep(m) },
      h('b', {}, m.name), h('div', { class: 'small muted' }, g0(t.kcal) + ' kcal · P ' + g0(t.p) + ' · C ' + g0(t.c) + ' · F ' + g0(t.f))); }));
  }
  function portionStep(meal) {
    let mult = 1;
    wrap.replaceChildren(h('b', {}, meal.name), gap(10),
      PT.field('Portions (1 = whole meal, 0.5 = half)', PT.numInput(mult, v => mult = v, '1', '0.25')), gap(12),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost grow', onclick: show }, 'Back'),
        h('button', { class: 'btn grow', onclick: () => {
          const k = num(mult); if (!k) { PT.toast('Enter portions'); return; }
          const t = PT.mealTotals(meal); sh.close();
          addEntry(date, { label: meal.name + (k !== 1 ? ' ×' + k : ''), kcal: t.kcal * k, p: t.p * k, c: t.c * k, f: t.f * k });
        } }, 'Add')));
  }
  function quickForm() {
    const d = { label: '', kcal: '', p: '', c: '', f: '' };
    return h('div', {}, PT.field('What was it?', h('input', { oninput: e => d.label = e.target.value })), gap(10),
      h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(d.kcal, v => d.kcal = v)), PT.field('Protein g', PT.numInput(d.p, v => d.p = v)),
        PT.field('Carbs g', PT.numInput(d.c, v => d.c = v)), PT.field('Fat g', PT.numInput(d.f, v => d.f = v))), gap(12),
      h('button', { class: 'btn block', onclick: () => { sh.close(); addEntry(date, { label: d.label.trim() || 'Quick add', kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.f) }); } }, 'Add'));
  }
  show();
}

/* ---------- your foods ---------- */
function foodsView() {
  return h('div', {}, PT.back('#/fuel', 'Fuel'), h('h1', {}, 'My foods'),
    h('p', { class: 'muted small' }, 'Enter each food once, with macros per 100g (from the packet). Then pick it and type the grams.'),
    h('button', { class: 'btn block', onclick: () => foodForm(null) }, '+ New food'), gap(12),
    PT.state.foods.length ? PT.state.foods.map(f => h('div', { class: 'card tap', onclick: () => foodForm(f) },
      h('b', {}, f.name), h('div', { class: 'small muted' }, 'per 100g: ' + f.kcal + ' kcal · P ' + f.p + ' · C ' + f.c + ' · F ' + f.f))) : h('div', { class: 'empty' }, 'No foods yet.'));
}
function foodForm(food) {
  const d = food ? Object.assign({}, food) : { id: PT.uid(), name: '', kcal: '', p: '', c: '', f: '' };
  const sh = PT.sheet(food ? 'Edit food' : 'New food', h('div', {},
    PT.field('Name', h('input', { value: d.name, placeholder: 'e.g. Chicken breast (raw)', oninput: e => d.name = e.target.value })), gap(10),
    h('p', { class: 'small muted' }, 'Macros per 100g'),
    h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(d.kcal, v => d.kcal = v)), PT.field('Protein g', PT.numInput(d.p, v => d.p = v)),
      PT.field('Carbs g', PT.numInput(d.c, v => d.c = v)), PT.field('Fat g', PT.numInput(d.f, v => d.f = v))), gap(12),
    h('button', { class: 'btn block', onclick: () => {
      if (!d.name.trim()) { PT.toast('Name it first'); return; }
      const out = { id: d.id, name: d.name.trim(), kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.f) };
      const i = PT.state.foods.findIndex(x => x.id === d.id); if (i >= 0) PT.state.foods[i] = out; else PT.state.foods.push(out);
      PT.save(); sh.close(); PT.render();
    } }, 'Save'),
    food ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete "' + food.name + '"? Meals using it will lose that item.', 'Delete', () => {
      PT.state.foods = PT.state.foods.filter(x => x.id !== food.id); PT.state.meals.forEach(m => m.items = m.items.filter(it => it.foodId !== food.id)); PT.save(); PT.render();
    }) }, 'Delete food')) : null));
}

/* ---------- your meals ---------- */
function mealsView() {
  return h('div', {}, PT.back('#/fuel', 'Fuel'), h('h1', {}, 'My meals'),
    h('p', { class: 'muted small' }, 'Build a meal from your foods, e.g. 250g chicken + veg + 300g sweet potato. You get the total macros.'),
    h('button', { class: 'btn block', onclick: () => mealForm(null) }, '+ New meal'), gap(12),
    PT.state.meals.length ? PT.state.meals.map(m => { const t = PT.mealTotals(m); return h('div', { class: 'card tap', onclick: () => mealForm(m) },
      h('b', {}, m.name), h('div', { class: 'small muted' }, g0(t.kcal) + ' kcal · P ' + g0(t.p) + ' · C ' + g0(t.c) + ' · F ' + g0(t.f))); }) : h('div', { class: 'empty' }, 'No meals yet.'));
}
function mealForm(meal) {
  if (!PT.state.foods.length) { PT.toast('Add some foods first'); location.hash = '#/fuel/foods'; return; }
  const d = meal ? JSON.parse(JSON.stringify(meal)) : { id: PT.uid(), name: '', items: [{ foodId: PT.state.foods[0].id, grams: 100 }] };
  const box = h('div', {});
  const totA = h('div', { class: 'stat' }), totB = h('div', { class: 'small muted' });
  function refreshTotals() {
    const t = PT.mealTotals({ items: d.items.map(it => ({ foodId: it.foodId, grams: num(it.grams) })) });
    totA.textContent = g0(t.kcal) + ' kcal'; totB.textContent = 'P ' + g0(t.p) + 'g · C ' + g0(t.c) + 'g · F ' + g0(t.f) + 'g';
  }
  function draw() {
    PT.fill(box,
      PT.field('Meal name', h('input', { value: d.name, placeholder: 'e.g. Chicken, veg and sweet potato', oninput: e => d.name = e.target.value })), gap(10),
      d.items.map((it, i) => h('div', { class: 'row', style: { marginBottom: '8px', flexWrap: 'nowrap' } },
        h('select', { class: 'grow', onchange: e => { it.foodId = e.target.value; refreshTotals(); } }, PT.state.foods.map(f => h('option', { value: f.id, selected: f.id === it.foodId }, f.name))),
        h('div', { style: { width: '90px', flex: 'none' } }, PT.numInput(it.grams, v => { it.grams = v; refreshTotals(); }, 'g', '1')),
        h('button', { class: 'btn danger small', onclick: () => { d.items.splice(i, 1); draw(); } }, '✕'))),
      h('button', { class: 'btn ghost small', onclick: () => { d.items.push({ foodId: PT.state.foods[0].id, grams: 100 }); draw(); } }, '+ Add item'),
      h('div', { class: 'card', style: { marginTop: '12px' } }, totA, totB),
      h('button', { class: 'btn block', onclick: save }, 'Save meal'),
      meal ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete "' + meal.name + '"?', 'Delete', () => { PT.state.meals = PT.state.meals.filter(x => x.id !== meal.id); PT.save(); PT.render(); }) }, 'Delete meal')) : null);
    refreshTotals();
  }
  function save() {
    if (!d.name.trim()) { PT.toast('Name the meal'); return; }
    if (!d.items.length) { PT.toast('Add at least one item'); return; }
    const out = { id: d.id, name: d.name.trim(), items: d.items.map(it => ({ foodId: it.foodId, grams: num(it.grams) })) };
    const i = PT.state.meals.findIndex(x => x.id === d.id); if (i >= 0) PT.state.meals[i] = out; else PT.state.meals.push(out);
    PT.save(); sh.close(); PT.render();
  }
  const sh = PT.sheet(meal ? 'Edit meal' : 'New meal', box);
  draw();
}

/* ---------- targets ---------- */
function targetsSheet() {
  const s = PT.state.settings, t = Object.assign({}, s.targets);
  let kg = s.bodyKg;
  const box = h('div', {});
  function draw() {
    PT.fill(box,
      h('p', { class: 'small muted' }, 'You set the numbers. A common starting point in sports nutrition is about 1.6 to 2.2 g of protein per kg of body weight, and roughly 5 to 8 g of carbs per kg on heavy endurance days. A registered dietitian can tailor this to you.'),
      h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(t.kcal, v => t.kcal = v)), PT.field('Body weight kg', PT.numInput(kg, v => kg = v))), gap(8),
      h('button', { class: 'btn ghost small', onclick: () => {
        if (!num(t.kcal) || !num(kg)) { PT.toast('Enter calories and body weight first'); return; }
        t.p = Math.round(1.8 * num(kg)); t.f = Math.round(num(t.kcal) * 0.25 / 9); t.c = Math.max(0, Math.round((num(t.kcal) - t.p * 4 - t.f * 9) / 4)); draw();
      } }, 'Suggest split (1.8 g/kg protein, 25% fat)'), gap(10),
      h('div', { class: 'grid3' }, PT.field('Protein g', PT.numInput(t.p, v => t.p = v)), PT.field('Carbs g', PT.numInput(t.c, v => t.c = v)), PT.field('Fat g', PT.numInput(t.f, v => t.f = v))), gap(12),
      h('button', { class: 'btn block', onclick: () => { s.targets = { kcal: t.kcal, p: t.p, c: t.c, f: t.f }; s.bodyKg = kg; PT.save(); sh.close(); PT.render(); } }, 'Save targets'));
  }
  const sh = PT.sheet('Daily targets', box);
  draw();
}
})();
