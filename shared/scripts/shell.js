/* Builds the chrome every screen shares: the sprite, the prototype screen
   switcher, and the floating tab bar. Each page declares which screen it is
   with <body data-screen="..."> and this marks the matching item active.

   Load order matters: sprite.js and screens.js must come first. */
(function(){
  const {SPRITE, SCREENS, TABS} = window.ATUNSE;
  const current = document.body.dataset.screen;
  const find = id => SCREENS.find(s => s.id === id);

  const protoBar = () =>
    '<nav class="proto-bar" aria-label="Prototype screens"><b>V2</b>' +
    SCREENS.map(s =>
      `<a href="${s.href}"${s.id === current ? ' aria-current="page"' : ''}>${s.label}</a>`
    ).join('') +
    '</nav>';

  const tabBar = () =>
    '<nav class="tabs" aria-label="Main">' +
    TABS.map(t => {
      const screen = find(t.id);
      const active = t.id === current ? ' aria-current="page"' : '';
      const inner  = t.initials
        ? `<span class="me">${t.initials}</span>`
        : `<svg viewBox="0 0 24 24">${t.icon}</svg>`;
      return `<a class="${t.add ? 'add' : ''}" href="${screen.href}" aria-label="${t.label}"${active}>${inner}</a>`;
    }).join('') +
    '</nav>';

  /* Sprite and switcher sit above the shell. The tab bar is fixed, so it can
     live at the end of the shell regardless of page length. */
  document.body.insertAdjacentHTML('afterbegin', SPRITE + protoBar());
  const shell = document.querySelector('.shell');
  if (shell) shell.insertAdjacentHTML('beforeend', tabBar());
})();
