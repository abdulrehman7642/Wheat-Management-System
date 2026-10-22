import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { postTrackedPayment } from "@/app/lib/paymentPosting";

const paymentSchema = z.object({
  date: z.string(),
  party_type: z.enum(["supplier", "customer"]),
  party_id: z.number(),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank"]),
  description: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [payments, controls] = await Promise.all([prisma.payments.findMany({
    include: { payment_posting: true, payment_reversal: true },
    orderBy: { id: "desc" },
    take: 50,
  }), prisma.financial_controls.findUnique({ where: { id: 1 } })]);

  return NextResponse.json(payments.map(payment => {
    const { payment_posting: posting, payment_reversal: reversal, ...record } = payment;
    return { ...record,
      cancellation_status: reversal ? "cancelled" : posting ? "tracked" : "legacy",
      reversal: reversal ? { voucher_no: reversal.voucher_no, effective_date: reversal.effective_date, reason: reversal.reason } : null,
      can_cancel: controls?.payment_cancellation_enabled === true && !!posting && !reversal && payment.method === "cash",
      cancellation_block_reason: !controls?.payment_cancellation_enabled ? "Not configured" : !posting ? "Legacy/unverified" :
        reversal ? "Already cancelled" : payment.method === "bank" ? "Bank reconciliation unavailable" : null,
    };
  }));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        return postTrackedPayment(tx, { date: new Date(d.date), partyType: d.party_type,
          partyId: d.party_id, amount: d.amount, method: d.method, description: d.description,
          userId, sourcePath: "standalone_fifo", fifo: true });
      },
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "create", "payment", result.id, result);
return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment save nahi ho saka." },
      { status: 500 }
    );
  }
}
