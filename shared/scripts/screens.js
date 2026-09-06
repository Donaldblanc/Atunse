/* Single source of truth for the screen list.
   `href` is relative from any features/<name>/ folder, so every page uses it as-is.
   When this becomes a real app these turn into routes. */
window.ATUNSE = window.ATUNSE || {};

window.ATUNSE.SCREENS = [
  {id:'home',      label:'Home',      href:'../home/home.html'},
  {id:'category',  label:'Category',  href:'../new-order/category.html'},
  {id:'capture',   label:'Camera',    href:'../new-order/capture.html'},
  {id:'item',      label:'Item',      href:'../new-order/item.html'},
  {id:'services',  label:'Services',  href:'../new-order/services.html'},
  {id:'method',    label:'Method',    href:'../new-order/method.html'},
  {id:'confirmed', label:'Confirmed', href:'../new-order/confirmed.html'},
  {id:'order',     label:'Order',     href:'../orders/detail.html'},
  {id:'invoice',   label:'Invoice',   href:'../invoices/invoice.html'},
  {id:'studio',    label:'Studio',    href:'../studio/studio.html'},
  {id:'messages',  label:'Messages',  href:'../messages/messages.html'},
  {id:'shop',      label:'Shop',      href:'../shop/shop.html'}
];

/* The five destinations in the bottom tab bar. */
window.ATUNSE.TABS = [
  {id:'home',     label:'Home',      icon:'<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'},
  {id:'messages', label:'Messages',  icon:'<path d="M4 5h16v11H9l-5 4z"/>'},
  {id:'category', label:'New order', icon:'<path d="M12 6v12M6 12h12"/>', add:true},
  {id:'invoice',  label:'Invoices',  icon:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'},
  {id:'studio',   label:'Studio',    initials:'AL'}
];
