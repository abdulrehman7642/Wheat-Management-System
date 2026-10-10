import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const transportSchema = z.object({
  date: z.string(),
  driver_name: z.string().optional(),
  vehicle_no: z.string().optional(),
  book_no: z.string().optional(),
  source: z.string().optional(),
  destination: z.string().optional(),
  total_amount: z.number().positive(),
  paid_amount: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.transport.findMany({
    include: { drivers: true, vehicles: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = transportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let driverId: number | null = null;
        if (d.driver_name && d.driver_name.trim() !== "") {
          const existing = await tx.drivers.findFirst({ where: { name: d.driver_name.trim() } });
          driverId = existing
            ? existing.id
            : (await tx.drivers.create({ data: { name: d.driver_name.trim() } })).id;
        }

        let vehicleId: number | null = null;
        if (d.vehicle_no && d.vehicle_no.trim() !== "") {
          const vehicle = await tx.vehicles.upsert({
            where: { vehicle_no: d.vehicle_no.trim() },
            update: {},
            create: { vehicle_no: d.vehicle_no.trim() },
          });
          vehicleId = vehicle.id;
        }

        const docNum = await tx.document_numbering.update({
          where: { doc_type: "cash_payment" },
          data: { current_number: { increment: 1 } },
        });
        const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

        return tx.transport.create({
          data: {
            voucher_no: voucherNo,
            date: new Date(d.date),
            driver_id: driverId,
            vehicle_id: vehicleId,
            book_no: d.book_no,
            source: d.source,
            destination: d.destination,
            total_amount: d.total_amount,
            paid_amount: d.paid_amount,
            remaining_amount: d.total_amount - d.paid_amount,
            created_by: session.userId,
          },
        });
      },
      { maxWait: 15000, timeout: 20000 }
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Freight entry save nahi ho saki." },
      { status: 500 }
    );
  }
}