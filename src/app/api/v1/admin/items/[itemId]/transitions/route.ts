import { NextResponse, type NextRequest } from "next/server";
import { checkAdminAccess } from "@/features/accounts/admin-check";
import { UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { ITEM_STATUSES, type ItemStatus } from "@/features/orders/domain";
import {
  InvalidTransitionError,
  transitionItemStatus,
} from "@/features/orders/use-cases/transition-item-status";

// POST /api/v1/admin/items/:itemId/transitions — every admin action on the
// item pipeline (review started, quote sent, manual payment confirmed,
// approved, ...) goes through this one endpoint (ADR-0001: every Item is
// reviewed; the generalized transitionItemStatus use-case backs every step).
//
// Reachable only past src/middleware.ts's admin guard (matcher includes
// /api/v1/admin/:path*) — but the authz check here is a second, independent
// gate via the same checkAdminAccess, since a use-case must never trust a
// route just because middleware let the request through (ADR-0012).
export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
  const { allowed, accountId } = await checkAdminAccess(req);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTransitionBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // accountId comes from the verified session cookie above — recorded on
  // every audit entry the use-case writes (ADR-0012).
  const actingUser = { accountId, role: "ADMIN" as const };

  try {
    const item = await transitionItemStatus(buildOrderUseCaseDeps(), actingUser, {
      itemId: params.itemId,
      ...parsed.value,
    });
    if (item === null) {
      // Idempotency key already applied (ADR-0012) — not an error.
      return NextResponse.json({ item: null, alreadyApplied: true }, { status: 200 });
    }
    return NextResponse.json({ item }, { status: 200 });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}

function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && (ITEM_STATUSES as readonly string[]).includes(value);
}

function parseTransitionBody(
  body: unknown,
):
  | { ok: true; value: Omit<Parameters<typeof transitionItemStatus>[2], "itemId"> }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }
  const b = body as Record<string, unknown>;

  if (!isItemStatus(b.fromStatus)) {
    return { ok: false, error: `fromStatus must be one of: ${ITEM_STATUSES.join(", ")}` };
  }
  if (!isItemStatus(b.toStatus)) {
    return { ok: false, error: `toStatus must be one of: ${ITEM_STATUSES.join(", ")}` };
  }
  if (typeof b.action !== "string" || b.action.length === 0) {
    return { ok: false, error: "action is required" };
  }

  return {
    ok: true,
    value: {
      fromStatus: b.fromStatus,
      toStatus: b.toStatus,
      action: b.action,
      idempotencyKey: typeof b.idempotencyKey === "string" ? b.idempotencyKey : undefined,
      notifyEmail: typeof b.notifyEmail === "string" ? b.notifyEmail : undefined,
      notifySubject: typeof b.notifySubject === "string" ? b.notifySubject : undefined,
    },
  };
}
