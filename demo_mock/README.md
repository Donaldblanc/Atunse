# Atunṣe v2 prototype

Static, feature-sliced mock of the v2 app. No build step, no dependencies.
Open `index.html` in a browser — it redirects to the home screen.

The black bar across the top is a prototype-only control strip. On the left is a
**Customer / Admin** toggle that swaps between the two apps; to the right of it,
the screens belonging to whichever role you're in. Both ship out before any of
this becomes real code.

The customer app runs on a light shell, DJ's admin app on a dark one. That isn't
decoration — with a toggle sitting between the two, nobody should ever have to
wonder which view they're looking at.

---

## Structure

```
index.html                    entry point, redirects to home

shared/
  styles/
    tokens.css                every colour, radius and width
    base.css                  reset, typography, layout helpers
    components.css            anything used by two or more features
    chrome.css                app shell, top nav, tab bar, screen switcher
  scripts/
    sprite.js                 shoe artwork as an SVG sprite
    screens.js                screen and tab registry
    shell.js                  builds the nav chrome on every page
    interactions.js           selection behaviour for the mock

features/
  home/          home.html                  dashboard
  new-order/     category.html              pick an item type
                 capture.html               guided camera
                 item.html                  brand, size, material, notes
                 services.html              service selection
                 method.html                drop-off and return
                 confirmed.html             order placed
  orders/        detail.html                drop-off code, items, progress
  invoices/      invoice.html               line items, approval, deposit
  studio/        studio.html                address, hours, directions
  messages/      messages.html              thread with DJ
  shop/          shop.html                  care products

  admin/         queue.html                 the day's jobs, filtered by state
                 order.html                 photos, quote builder, status, messaging
                 customers.html             list, search, spreadsheet import
                 settings.html              prices, payment handles, hours, notifications
```

Each feature owns its own CSS. Anything shared moves up into
`shared/styles/components.css` rather than being duplicated.

---

## Conventions

**Adding a screen.** Create `features/<feature>/<name>.html`, set
`<body data-role="customer|admin" data-screen="my-screen">`, and add an entry
under that role in `ROLES` in `shared/scripts/screens.js`. The switcher, the tab
bar and the active states all follow from that one entry.

**Roles.** `screens.js` holds two independent screen lists and two tab bars. A
page declares which app it belongs to with `data-role`, and `admin.css` re-surfaces
the shared components for the dark shell using `body[data-role="admin"]` — no
component is forked, only re-skinned. In production this toggle disappears and
becomes an auth boundary: DJ signs in, customers don't see any of it.

**Paths.** Every page sits exactly one folder deep inside `features/`, so
`../../shared/...` works everywhere and cross-feature links are `../<feature>/<page>.html`.
Keep that depth or the paths break.

**Selection state** uses `aria-pressed` rather than a class, so the styling and
the accessibility information can't drift apart. `interactions.js` reads it
generically: `.svc` toggles independently, `.cat`, `.segs` and `.chips` clear
their siblings first.

**Scripts are classic, not modules,** and load in order: sprite, screens, shell,
interactions. Browsers refuse to load ES modules over `file://`, and this needs
to work when someone double-clicks the file.

**No build tooling on purpose.** This is a communication artifact for agreeing
on layout and flow. The real app will be a framework project; treat the CSS here
as a reference for spacing and hierarchy rather than something to lift wholesale.

---

## Known placeholders

- Every product and shoe image is a hand-drawn SVG. Real photography needed.
- The studio map is CSS shapes. Swap for a real embed once the address is settled.
- The payment handle on the invoice reads `[payment handle]` — fill in once the
  Zelle and Apple Pay details are confirmed. Don't commit a personal number to a
  public repo.
- The QR block on the order screen is decorative, not a real encoded code.
- Admin has no login screen yet. It needs one before anything is deployed
  anywhere public — right now the toggle is the only thing between the two apps.
- Customer names and lifetime values in the admin screens are invented.
