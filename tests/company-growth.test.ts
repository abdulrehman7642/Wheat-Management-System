import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketSeries, comparisonRange, percentChange, resolveGrowthRange, sumMoney } from "../app/lib/companyGrowth";

test("growth ranges use an inclusive start and exclusive following-day end", () => {
  const range = resolveGrowthRange("7d", null, null, new Date("2026-10-20T16:00:00Z"));
  assert.equal(range.start.toISOString(), "2026-10-14T00:00:00.000Z"); assert.equal(range.end.toISOString(), "2026-10-21T00:00:00.000Z"); assert.equal(comparisonRange(range).end.toISOString(), range.start.toISOString());
});
test("preset ranges use the Pakistan business date at the UTC day boundary", () => {
  const range = resolveGrowthRange("7d", null, null, new Date("2026-10-20T20:30:00Z"));
  assert.equal(range.end.toISOString(), "2026-10-22T00:00:00.000Z");
});
test("custom dates include their final date, accept leap dates, and reject invalid calendar values", () => {
  assert.equal(resolveGrowthRange("custom", "2024-02-29", "2024-02-29").end.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(resolveGrowthRange("custom", "2026-12-31", "2026-12-31").start.toISOString(), "2026-12-31T00:00:00.000Z");
  for (const value of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2025-02-29"]) assert.throws(() => resolveGrowthRange("custom", value, "2026-12-31"));
  assert.throws(() => resolveGrowthRange("custom", "2026-02-01", "2026-01-31"));
});
test("revenue growth uses exact decimals and N/A for zero prior revenue", () => { assert.equal(percentChange("125.00", "100.00"), "25.00"); assert.equal(percentChange("1.00", "0.00"), null); assert.equal(sumMoney(["0.10", "0.20"]).toFixed(2), "0.30"); });
test("series bucketing excludes records outside the selected range", () => {
  const range = resolveGrowthRange("custom", "2026-01-01", "2026-01-03"); const series = bucketSeries([{ date: new Date("2026-01-01T00:00:00Z"), amount: "10.10" }, { date: new Date("2026-01-03T00:00:00Z"), amount: "5.00" }, { date: new Date("2026-01-04T00:00:00Z"), amount: "99.00" }], range); assert.deepEqual(series, [{ label: "2026-01-01", value: "10.10" }, { label: "2026-01-03", value: "5.00" }]);
});
