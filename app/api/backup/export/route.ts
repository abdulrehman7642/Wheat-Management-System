import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canAccessBackup } from "@/app/lib/permissions";

function jsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessBackup(session)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

  const [
    suppliers,
    customers,
    wheatTypes,
    units,
    purchases,
    sales,
    inventoryTransactions,
    payments,
    ledgerEntries,
    labor,
    transport,
    expenses,
    expenseCategories,
    vehicles,
    drivers,
    settings,
  ] = await Promise.all([
    prisma.suppliers.findMany(),
    prisma.customers.findMany(),
    prisma.wheat_types.findMany(),
    prisma.units.findMany(),
    prisma.purchases.findMany(),
    prisma.sales.findMany(),
    prisma.inventory_transactions.findMany(),
    prisma.payments.findMany(),
    prisma.ledger_entries.findMany(),
    prisma.labor.findMany(),
    prisma.transport.findMany(),
    prisma.expenses.findMany(),
    prisma.expense_categories.findMany(),
    prisma.vehicles.findMany(),
    prisma.drivers.findMany(),
    prisma.settings.findMany(),
  ]);

  const backup = {
    exported_at: new Date().toISOString(),
    exported_by: session.username,
    data: {
      suppliers,
      customers,
      wheatTypes,
      units,
      purchases,
      sales,
      inventoryTransactions,
      payments,
      ledgerEntries,
      labor,
      transport,
      expenses,
      expenseCategories,
      vehicles,
      drivers,
      settings,
    },
  };
await logAction(session.userId, "backup_export", "backup", 0);
  const json = JSON.stringify(jsonSafe(backup), null, 2);
  const fileName = `malik-yaseen-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
