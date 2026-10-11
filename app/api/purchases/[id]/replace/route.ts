import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { logAction } from "@/app/lib/audit";
import { createPurchaseTx, voidPurchaseTx, purchaseSchema } from "@/app/lib/purchaseOps";

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

  const parsed = purchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const old = await tx.purchases.findUnique({ where: { id: oldId } });
        if (!old) throw new Error("Purchase not found.");
        if (old.status === "voided") throw new Error("Ye purchase pehle hi cancel ho chuki hai.");

        const carried = Number(old.paid_amount);

        await voidPurchaseTx(tx, oldId, session.userId, "Edited");
        const created = await createPurchaseTx(tx, parsed.data, session.userId, carried);

        await tx.purchases.update({
          where: { id: oldId },
          data: { void_reason: `Edited: replaced by ${created.voucher_no}` },
        });

        return created;
      },
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "edit", "purchase", result.id, { replaced: oldId });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Edit save nahi ho saka." },
      { status: 500 }
    );
  }
}
