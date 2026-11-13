(function () {
'use strict';
const PT = window.PT, h = PT.h;
const NAV = [['plan', 'Plan'], ['sessions', 'Sessions'], ['recover', 'Recover'], ['fuel', 'Fuel'], ['more', 'More']];

PT.render = function () {
  const parts = (location.hash || '#/plan').replace(/^#\/?/, '').split('/');
  const key = parts[0] === 'log' ? 'plan' : parts[0];
  const view = PT.views[parts[0]] || PT.views.plan;
  let node;
  try { node = view(parts); }
  catch (e) { console.error(e); node = h('div', { class: 'card' }, h('h3', {}, 'Something went wrong'), h('p', { class: 'small muted' }, String(e.message || e)), h('a', { class: 'btn small', href: '#/plan' }, 'Back to Plan')); }
  document.getElementById('app').replaceChildren(node);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === key));
};

document.getElementById('nav').replaceChildren(...NAV.map(([k, l]) => h('a', { href: '#/' + k, 'data-k': k }, l)));
window.addEventListener('hashchange', () => {
  document.getElementById('modal').replaceChildren(); document.body.classList.remove('noscroll');
  window.scrollTo(0, 0); PT.render();
});
if (!location.hash) location.hash = '#/plan';
PT.render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
