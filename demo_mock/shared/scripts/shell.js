/* Builds the chrome every screen shares: the sprite, the role toggle, the
   prototype screen switcher, and the floating tab bar.

   Each page declares itself with
     <body data-role="customer|admin" data-screen="...">
   and this picks the right screen list and marks the active item.

   Load order matters: sprite.js and screens.js must come first. */
(function(){
  const {SPRITE, ROLES} = window.ATUNSE;
  const role    = document.body.dataset.role || 'customer';
  const screen  = document.body.dataset.screen;
  const config  = ROLES[role];
  const find    = id => config.screens.find(s => s.id === id);

  /* Toggle between the two apps. Each link lands on that role's entry screen. */
  const roleSwitch = () =>
    '<div class="role-switch" role="group" aria-label="View as">' +
    Object.entries(ROLES).map(([key, r]) =>
      `<a href="${r.entry}"${key === role ? ' aria-current="page"' : ''}>${r.label}</a>`
    ).join('') +
    '</div>';

  const protoBar = () =>
    '<nav class="proto-bar" aria-label="Prototype screens">' + roleSwitch() +
    config.screens.map(s =>
      `<a href="${s.href}"${s.id === screen ? ' aria-current="page"' : ''}>${s.label}</a>`
    ).join('') +
    '</nav>';

  const tabBar = () =>
    '<nav class="tabs" aria-label="Main">' +
    config.tabs.map(t => {
      const target = find(t.id);
      const active = t.id === screen ? ' aria-current="page"' : '';
      const inner  = t.initials
        ? `<span class="me">${t.initials}</span>`
        : `<svg viewBox="0 0 24 24">${t.icon}</svg>`;
      return `<a class="${t.add ? 'add' : ''}" href="${target.href}" aria-label="${t.label}"${active}>${inner}</a>`;
    }).join('') +
    '</nav>';

  document.body.insertAdjacentHTML('afterbegin', SPRITE + protoBar());
  const shell = document.querySelector('.shell');
  if (shell) shell.insertAdjacentHTML('beforeend', tabBar());
})();
