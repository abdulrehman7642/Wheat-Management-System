import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { logAction } from "@/app/lib/audit";
import { createSaleTx, saleSchema } from "@/app/lib/saleOps";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sales = await prisma.sales.findMany({
    include: { customers: true, wheat_types: true, vehicles: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = saleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => createSaleTx(tx, parsed.data, session.userId),
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "create", "sale", result.id, result);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sale save nahi ho saka." },
      { status: 500 }
    );
  }
}