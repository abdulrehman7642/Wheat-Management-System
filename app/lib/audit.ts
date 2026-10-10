import { prisma } from "./prisma";

export async function logAction(
  userId: number | undefined,
  action: string,
  recordType: string,
  recordId: number,
  newValue?: unknown
) {
  try {
    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        action,
        record_type: recordType,
        record_id: recordId,
        new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
      },
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}