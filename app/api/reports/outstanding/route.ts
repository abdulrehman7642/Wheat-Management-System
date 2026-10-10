import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliers = await prisma.suppliers.findMany();
  const supplierRows = [];
  for (const s of suppliers) {
    const last = await prisma.ledger_entries.findFirst({
      where: { account_type: "supplier", account_id: s.id },
      orderBy: { id: "desc" },
    });
    const balance = last ? Number(last.balance) : 0;
    if (balance !== 0) {
      supplierRows.push({ id: s.id, name: s.name, code: s.code, balance });
    }
  }

  const customers = await prisma.customers.findMany();
  const customerRows = [];
  for (const c of customers) {
    const last = await prisma.ledger_entries.findFirst({
      where: { account_type: "customer", account_id: c.id },
      orderBy: { id: "desc" },
    });
    const balance = last ? Number(last.balance) : 0;
    if (balance !== 0) {
      customerRows.push({ id: c.id, name: c.name, code: c.code, balance });
    }
  }

  return NextResponse.json({ supplierRows, customerRows });
}