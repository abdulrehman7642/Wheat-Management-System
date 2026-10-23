import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/session";
import { isOwner } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { createCompanyGrowthGetHandler } from "@/app/lib/companyGrowthEndpoint";

// This is a read-only analytics snapshot. It cannot write because the callback only uses read queries.
// RepeatableRead keeps every aggregate, latest-balance lookup, and chart in one consistent database view.
const withSnapshot = <T,>(work: (reader: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(
  async transaction => {
    await transaction.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    return work(transaction);
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 3_000, timeout: 10_000 },
);

export const GET = createCompanyGrowthGetHandler({ getSession, isOwner, withSnapshot });
