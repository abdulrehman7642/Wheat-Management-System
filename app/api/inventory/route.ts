import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wheatTypes = await prisma.wheat_types.findMany({
    include: { units: true },
  });

  const stock = [];
  for (const wt of wheatTypes) {
    const last = await prisma.inventory_transactions.findFirst({
      where: { wheat_type_id: wt.id },
      orderBy: { id: "desc" },
    });
    const balanceKg = last ? Number(last.balance_kg) : 0;
    const conversion = wt.units ? Number(wt.units.conversion_to_kg) : 1;

    stock.push({
      wheat_type_id: wt.id,
      name: wt.name,
      category: wt.category,
      balance_kg: balanceKg,
      balance_maunds: balanceKg / conversion,
    });
  }

  return NextResponse.json(stock);
}