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
  const customerId = parseInt(id);

  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const entries = await prisma.ledger_entries.findMany({
    where: { account_type: "customer", account_id: customerId },
    orderBy: { id: "asc" },
  });

  const serializedEntries = entries.map((e) => ({
  ...e,
  id: Number(e.id),
}));

return NextResponse.json({ customer, entries: serializedEntries });
}