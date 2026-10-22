import type { Tx } from "./purchaseOps";

// Every writer that can change stock, invoices, payments, or running ledgers
// takes this transaction-scoped lock before reading financial state.
export async function acquireFinancialLock(tx: Tx) {
  // pg_advisory_xact_lock returns PostgreSQL void, which Prisma's pg adapter
  // cannot deserialize. Casting the fixed result to text retains the lock and
  // keeps the query result adapter-safe.
  await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock($1, $2)::text", 746292, 1);
}
