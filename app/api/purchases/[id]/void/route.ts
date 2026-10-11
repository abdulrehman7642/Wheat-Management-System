import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { logAction } from "@/app/lib/audit";
import { voidPurchaseTx } from "@/app/lib/purchaseOps";

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
  const purchaseId = parseInt(id);

  try {
    await prisma.$transaction(
      async (tx) => voidPurchaseTx(tx, purchaseId, session.userId, "Voided by user"),
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "void", "purchase", purchaseId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Void fail ho gaya." },
      { status: 500 }
    );
  }
}