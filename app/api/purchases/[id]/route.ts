import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const purchase = await prisma.purchases.findUnique({
    where: { id: parseInt(id) },
    include: { suppliers: true, wheat_types: true, vehicles: true },
  });

  if (!purchase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(purchase);
}