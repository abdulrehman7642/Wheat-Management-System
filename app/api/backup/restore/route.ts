import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const data = body?.data;

  if (!data) {
    return NextResponse.json({ error: "Invalid backup file." }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.ledger_entries.deleteMany({});
        await tx.inventory_transactions.deleteMany({});
        await tx.payments.deleteMany({});
        await tx.labor.deleteMany({});
        await tx.transport.deleteMany({});
        await tx.expenses.deleteMany({});
        await tx.sales.deleteMany({});
        await tx.purchases.deleteMany({});
        await tx.customers.deleteMany({});
        await tx.suppliers.deleteMany({});

        if (data.suppliers?.length) {
          await tx.suppliers.createMany({ data: data.suppliers });
        }
        if (data.customers?.length) {
          await tx.customers.createMany({ data: data.customers });
        }
        if (data.purchases?.length) {
          await tx.purchases.createMany({ data: data.purchases });
        }
        if (data.sales?.length) {
          await tx.sales.createMany({ data: data.sales });
        }
        if (data.inventoryTransactions?.length) {
          await tx.inventory_transactions.createMany({ data: data.inventoryTransactions });
        }
        if (data.payments?.length) {
          await tx.payments.createMany({ data: data.payments });
        }
        if (data.ledgerEntries?.length) {
          await tx.ledger_entries.createMany({
            data: data.ledgerEntries.map((e: { id: string | number }) => ({
              ...e,
              id: BigInt(e.id),
            })),
          });
        }
        if (data.labor?.length) {
          await tx.labor.createMany({ data: data.labor });
        }
        if (data.transport?.length) {
          await tx.transport.createMany({ data: data.transport });
        }
                if (data.expenses?.length) {
          await tx.expenses.createMany({ data: data.expenses });
        }

        // Reset ID counters so new rows do not clash with restored IDs
        const tables = [
          "suppliers", "customers", "purchases", "sales",
          "inventory_transactions", "payments", "ledger_entries",
          "labor", "transport", "expenses",
        ];
        for (const t of tables) {
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), (SELECT COUNT(*) > 0 FROM ${t}))`
          );
        }
      },
      { maxWait: 30000, timeout: 60000 }
    );
await logAction(session.userId, "restore", "backup", 0);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Restore fail ho gaya." },
      { status: 500 }
    );
  }
}
