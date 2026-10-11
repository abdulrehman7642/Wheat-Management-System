import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const supplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  opening_balance: z.number().default(0),
  opening_balance_side: z.enum(["DR", "CR"]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliers = await prisma.suppliers.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const supplier = await prisma.$transaction(
      async (tx) => {
        const created = await tx.suppliers.create({ data: parsed.data });

        const amount = Math.abs(Number(parsed.data.opening_balance));
        if (amount > 0) {
          // Supplier: CR = we owe them (+), DR = they hold our advance (-)
          const weOwe = (parsed.data.opening_balance_side ?? "CR") === "CR";
          await tx.ledger_entries.create({
            data: {
              date: new Date(),
              account_type: "supplier",
              account_id: created.id,
              voucher_no: "OB-" + created.code,
              description: "Opening Balance",
              debit: weOwe ? 0 : amount,
              credit: weOwe ? amount : 0,
              balance: weOwe ? amount : -amount,
              ref_type: "opening",
              ref_id: created.id,
              created_by: session.userId,
            },
          });
        }
        return created;
      },
      { maxWait: 15000, timeout: 20000 }
    );

    return NextResponse.json(supplier);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Supplier save nahi ho saka. Code pehle se to nahi hai?" }, { status: 400 });
  }
}