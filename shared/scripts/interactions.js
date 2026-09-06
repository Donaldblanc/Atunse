/* Prototype-only selection behaviour. Real state lives on the server later;
   this exists so the mock responds to taps.

   .svc   multi-select  — toggles independently
   .cat   single-select — clears its siblings first
   .segs  filter chips  — same, but scoped to the strip
   .toggle  on/off switch — flips independently (admin settings) */
function toggle(el){
  el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
}
function selectOne(el, siblingSelector){
  el.parentElement.querySelectorAll(siblingSelector)
    .forEach(s => s.setAttribute('aria-pressed','false'));
  el.setAttribute('aria-pressed','true');
}

document.addEventListener('click', e => {
  const svc = e.target.closest('.svc');
  if (svc) return toggle(svc);

  const cat = e.target.closest('.cat');
  if (cat) return selectOne(cat, '.cat');

  const seg = e.target.closest('.segs button');
  if (seg) return selectOne(seg, 'button');

  const chip = e.target.closest('.chips button');
  if (chip) return selectOne(chip, 'button');

  const toggleSwitch = e.target.closest('.toggle');
  if (toggleSwitch) return toggle(toggleSwitch);
});
