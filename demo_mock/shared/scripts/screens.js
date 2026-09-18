/* Screen registry, split by role.

   The prototype shows two entirely separate apps that happen to share a
   component library: what a customer sees, and what DJ sees. The role toggle
   in the chrome swaps between them.

   `href` is relative from any features/<name>/ folder, so every page uses it
   as-is. When this becomes a real app these turn into routes, and the role
   split becomes an auth boundary rather than a toggle. */
window.ATUNSE = window.ATUNSE || {};

window.ATUNSE.ROLES = {

  customer: {
    label: 'Customer',
    entry: '../home/home.html',
    screens: [
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
    ],
    tabs: [
      {id:'home',     label:'Home',      icon:'<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'},
      {id:'messages', label:'Messages',  icon:'<path d="M4 5h16v11H9l-5 4z"/>'},
      {id:'category', label:'New order', icon:'<path d="M12 6v12M6 12h12"/>', add:true},
      {id:'invoice',  label:'Invoices',  icon:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'},
      {id:'studio',   label:'Studio',    initials:'AL'}
    ]
  },

  admin: {
    label: 'Admin',
    entry: '../admin/queue.html',
    screens: [
      {id:'queue',        label:'Queue',     href:'../admin/queue.html'},
      {id:'admin-order',  label:'Job',       href:'../admin/order.html'},
      {id:'customers',    label:'Customers', href:'../admin/customers.html'},
      {id:'settings',     label:'Settings',  href:'../admin/settings.html'}
    ],
    tabs: [
      {id:'queue',     label:'Queue',     icon:'<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/>'},
      {id:'customers', label:'Customers', icon:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'},
      {id:'settings',  label:'Settings',  icon:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'}
    ]
  }
};
