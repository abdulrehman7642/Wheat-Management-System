import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const expenseSchema = z.object({
  date: z.string(),
  category_id: z.number(),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank"]),
  description: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await prisma.expenses.findMany({
    include: { expense_categories: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = expenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const docNum = await tx.document_numbering.update({
          where: { doc_type: "cash_payment" },
          data: { current_number: { increment: 1 } },
        });
        const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

        const expense = await tx.expenses.create({
          data: {
            voucher_no: voucherNo,
            date: new Date(d.date),
            category_id: d.category_id,
            amount: d.amount,
            method: d.method,
            description: d.description,
            created_by: session.userId,
          },
        });

        return expense;
      },
      { maxWait: 15000, timeout: 20000 }
    );
await logAction(session.userId, "create", "expense", result.id, result);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Expense save nahi ho saka." },
      { status: 500 }
    );
  }
}