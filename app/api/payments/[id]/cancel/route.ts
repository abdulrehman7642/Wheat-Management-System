import { cancelPaymentTx } from "@/app/lib/paymentCancellation";
import { isOwner } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actorId = session.userId;
  if (!isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  try {
    const reversal = await prisma.$transaction(tx => cancelPaymentTx(tx, { paymentId: id, actorId, request: body, serverInstant: new Date() }),
      { maxWait: 15000, timeout: 20000, isolationLevel: "ReadCommitted" });
    return NextResponse.json({ success: true, reversal_id: reversal.id.toString(), voucher_no: reversal.voucher_no });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment cancellation failed";
    const status = message === "OWNER_REQUIRED" ? 403 : ["ALREADY_CANCELLED", "IDEMPOTENCY_CONFLICT"].includes(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
