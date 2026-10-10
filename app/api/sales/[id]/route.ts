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
  const sale = await prisma.sales.findUnique({
    where: { id: parseInt(id) },
    include: { customers: true, wheat_types: true, vehicles: true },
  });

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(sale);
}