import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { logAction } from "@/app/lib/audit";
import { createSaleTx, voidSaleTx, saleSchema } from "@/app/lib/saleOps";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canVoidOrSettle(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const oldId = parseInt(id);

  const parsed = saleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const old = await tx.sales.findUnique({ where: { id: oldId } });
        if (!old) throw new Error("Sale not found.");
        if (old.status === "voided") throw new Error("Ye sale pehle hi cancel ho chuki hai.");

        const carried = Number(old.received_amount);

        // Void first: it puts the old quantity back in stock, so the stock check
        // for the new sale sees the correct amount.
        await voidSaleTx(tx, oldId, session.userId, "Edited");
        const created = await createSaleTx(tx, parsed.data, session.userId, carried);

        await tx.sales.update({
          where: { id: oldId },
          data: { void_reason: `Edited: replaced by ${created.voucher_no}` },
        });

        return created;
      },
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "edit", "sale", result.id, { replaced: oldId });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Edit save nahi ho saka." },
      { status: 500 }
    );
  }
}
