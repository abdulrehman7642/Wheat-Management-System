import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const customerSchema = z.object({
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

  const customers = await prisma.customers.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const customer = await prisma.$transaction(
      async (tx) => {
        const created = await tx.customers.create({ data: parsed.data });

        const amount = Math.abs(Number(parsed.data.opening_balance));
        if (amount > 0) {
          // Customer: DR = they owe us (+), CR = they hold our advance (-)
          const theyOwe = (parsed.data.opening_balance_side ?? "DR") === "DR";
          await tx.ledger_entries.create({
            data: {
              date: new Date(),
              account_type: "customer",
              account_id: created.id,
              voucher_no: "OB-" + created.code,
              description: "Opening Balance",
              debit: theyOwe ? amount : 0,
              credit: theyOwe ? 0 : amount,
              balance: theyOwe ? amount : -amount,
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

    return NextResponse.json(customer);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Customer save nahi ho saka. Code pehle se to nahi hai?" }, { status: 400 });
  }
}