import { Decimal } from "@prisma/client/runtime/client";

export const growthPeriods = ["7d", "30d", "90d", "this_month", "last_month", "this_year", "last_year", "custom"] as const;
export type GrowthPeriod = (typeof growthPeriods)[number];

export type DateRange = { start: Date; end: Date; label: string };

const money = (value: Decimal.Value | null | undefined) => new Decimal(value ?? 0);

function utcDate(year: number, month: number, day = 1) {
  return new Date(Date.UTC(year, month, day));
}

function pakistanCalendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return utcDate(value("year"), value("month") - 1, value("day"));
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const date = utcDate(Number(yearText), Number(monthText) - 1, Number(dayText));
  // Date.UTC normalizes invalid calendar values, so require an exact round trip.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function resolveGrowthRange(period: GrowthPeriod, customStart?: string | null, customEnd?: string | null, now = new Date()): DateRange {
  const today = pakistanCalendarDate(now);
  if (period === "custom") {
    const start = customStart ? parseCalendarDate(customStart) : null;
    const finalDate = customEnd ? parseCalendarDate(customEnd) : null;
    if (!start || !finalDate) throw new Error("A valid custom start and end date are required.");
    const end = addDays(finalDate, 1);
    if (start >= end) throw new Error("The custom date range is invalid.");
    return { start, end, label: `${customStart} to ${customEnd}` };
  }
  if (period === "7d" || period === "30d" || period === "90d") {
    const days = Number.parseInt(period, 10);
    return { start: addDays(today, -(days - 1)), end: addDays(today, 1), label: `Last ${days} days` };
  }
  if (period === "this_month") return { start: utcDate(today.getUTCFullYear(), today.getUTCMonth()), end: addDays(today, 1), label: "This month" };
  if (period === "last_month") return { start: utcDate(today.getUTCFullYear(), today.getUTCMonth() - 1), end: utcDate(today.getUTCFullYear(), today.getUTCMonth()), label: "Last month" };
  if (period === "this_year") return { start: utcDate(today.getUTCFullYear(), 0), end: addDays(today, 1), label: "This year" };
  return { start: utcDate(today.getUTCFullYear() - 1, 0), end: utcDate(today.getUTCFullYear(), 0), label: "Last year" };
}

export function comparisonRange(range: DateRange): DateRange {
  const duration = range.end.valueOf() - range.start.valueOf();
  return { start: new Date(range.start.valueOf() - duration), end: new Date(range.start), label: "Previous equivalent period" };
}

export function percentChange(current: Decimal.Value, previous: Decimal.Value): string | null {
  const before = money(previous);
  if (before.isZero()) return null;
  return money(current).minus(before).dividedBy(before).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export type SeriesRecord = { date: Date; amount: Decimal.Value };
export type SeriesPoint = { label: string; value: string };

export function bucketSeries(records: SeriesRecord[], range: DateRange): SeriesPoint[] {
  const monthBuckets = range.end.getTime() - range.start.getTime() > 1000 * 60 * 60 * 24 * 92;
  const totals = new Map<string, Decimal>();
  for (const record of records) {
    if (record.date < range.start || record.date >= range.end) continue;
    const date = new Date(record.date);
    const key = monthBuckets
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
      : date.toISOString().slice(0, 10);
    totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(money(record.amount)));
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value: value.toFixed(2) }));
}

export function sumMoney(values: Array<Decimal.Value | null | undefined>) {
  return values.reduce<Decimal>((total, value) => total.plus(money(value)), new Decimal(0));
}

export function decimalText(value: Decimal.Value | null | undefined) {
  return money(value).toFixed(2);
}
