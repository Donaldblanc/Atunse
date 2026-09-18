// Reachable only past src/middleware.ts's admin guard (AdminCheck) — the
// admin surface is protected from the very first deployment.
//
// This is the admin landing page from the MVP screen inventory
// (docs/SPEC.md): a dashboard that orients the owner and links into the
// working screens as they're built. The queues/detail screens themselves
// are Phase 2 — this page names them rather than linking to routes that
// don't exist yet.

const PLANNED_SCREENS: { title: string; description: string }[] = [
  { title: "Orders queue", description: "All orders/items, filterable by status — the main working view." },
  { title: "Under-Review queue", description: "Items awaiting a quote (every Item requires manual review)." },
  { title: "Awaiting payment confirmation", description: "Zelle/Cash items with a deposit or balance not yet marked received." },
  { title: "Customers", description: "Customer list, order history, linked guest orders." },
  { title: "Settings", description: "Service/pricing reference and policy documents." },
];

export default function AdminHomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 720 }}>
      <h1>Admin</h1>
      <p>RestoredByDJ — internal dashboard.</p>

      <h2 style={{ marginTop: "2rem" }}>Coming next</h2>
      <ul>
        {PLANNED_SCREENS.map((screen) => (
          <li key={screen.title} style={{ marginBottom: "0.75rem" }}>
            <strong>{screen.title}</strong>
            <div>{screen.description}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
