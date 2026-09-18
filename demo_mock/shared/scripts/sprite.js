/* Shoe artwork used across features, injected as an SVG sprite.
   Held in a global rather than an ES module import so the prototype opens
   straight from the filesystem — browsers block module loading over file://.
   In production this becomes a real .svg asset or a component. */
window.ATUNSE = window.ATUNSE || {};
window.ATUNSE.SPRITE = `
<svg style="display:none" aria-hidden="true">
  <symbol id="shoe" viewBox="0 0 200 110">
    <path d="M16,84 L182,84 C190,84 194,88 194,94 C194,102 186,106 176,106 L32,106 C20,106 10,100 10,92 C10,87 12,84 16,84Z" fill="#F7F8FB" stroke="#C9D0E0" stroke-width="1.5"/>
    <path d="M28,78 C24,50 32,30 54,24 L96,10 C110,5 122,8 130,19 L150,45 C158,55 170,59 186,62 L186,84 L28,84Z" fill="currentColor"/>
    <path d="M56,26 C66,44 92,58 126,64" stroke="#E9A427" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M88,16 L104,28 M110,12 L126,26" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>
    <path d="M28,74 L186,74" stroke="#fff" stroke-width="2" opacity=".25"/>
  </symbol>
  <symbol id="sole" viewBox="0 0 200 90">
    <path d="M22,18 C64,8 152,10 178,25 C192,33 192,58 176,66 C148,80 56,82 22,70 C8,64 8,24 22,18Z" fill="#B0A275"/>
    <ellipse cx="100" cy="44" rx="58" ry="13" fill="#8A8371" opacity=".45"/>
  </symbol>
</svg>`;
