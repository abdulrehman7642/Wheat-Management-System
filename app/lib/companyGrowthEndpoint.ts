import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { growthPeriods, resolveGrowthRange, type GrowthPeriod } from "@/app/lib/companyGrowth";
import { loadCompanyGrowth } from "@/app/lib/companyGrowthAnalytics";

export type CompanyGrowthSession = { userId?: number; roleName?: string };
type SnapshotRunner = <T>(work: (reader: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

const noStore = { "Cache-Control": "no-store" };

export function createCompanyGrowthGetHandler(dependencies: {
  getSession: () => Promise<CompanyGrowthSession>;
  isOwner: (session: CompanyGrowthSession) => boolean;
  withSnapshot: SnapshotRunner;
}) {
  return async function GET(request: Request) {
    const session = await dependencies.getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
    if (!dependencies.isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });

    try {
      const params = new URL(request.url).searchParams;
      const periodParam = params.get("period") || "30d";
      if (!growthPeriods.includes(periodParam as GrowthPeriod)) return NextResponse.json({ error: "Invalid period." }, { status: 400, headers: noStore });
      // Validate before starting the database transaction so malformed client input never opens one.
      resolveGrowthRange(periodParam as GrowthPeriod, params.get("start"), params.get("end"));
      const payload = await dependencies.withSnapshot(reader => loadCompanyGrowth(reader, periodParam as GrowthPeriod, params.get("start"), params.get("end")));
      return NextResponse.json(payload, { headers: noStore });
    } catch (error) {
      if (error instanceof Error && error.message.includes("custom")) return NextResponse.json({ error: "Invalid custom date range." }, { status: 400, headers: noStore });
      console.error("Company growth analytics query failed", error instanceof Error ? error.message : "unknown error");
      return NextResponse.json({ error: "Analytics could not be loaded." }, { status: 500, headers: noStore });
    }
  };
}
