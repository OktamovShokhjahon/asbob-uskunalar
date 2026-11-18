import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { API, app, prisma } from "./helpers";

afterAll(() => prisma.$disconnect());

describe("POST /quotes", () => {
  it("B1: A01 for 3 days = 90 000", async () => {
    const res = await request(app).post(`${API}/quotes`).send({ toolId: "A01", days: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ toolId: "A01", toolName: "Drel", days: 3, pricePerDay: 30000, total: 90000 });
  });

  // B13: every tool at 1 and 7 days
  const table: Array<[string, number, number]> = [
    ["A01", 30000, 210000],
    ["A02", 20000, 140000],
    ["A03", 100000, 700000],
    ["A04", 40000, 280000],
    ["A05", 60000, 420000],
    ["A06", 80000, 560000],
  ];

  it.each(table)("B13: %s → 1 day %i, 7 days %i", async (toolId, oneDay, sevenDays) => {
    const one = await request(app).post(`${API}/quotes`).send({ toolId, days: 1 });
    const seven = await request(app).post(`${API}/quotes`).send({ toolId, days: 7 });
    expect(one.body.data.total).toBe(oneDay);
    expect(seven.body.data.total).toBe(sevenDays);
  });

  it("rejects out-of-range days", async () => {
    const res = await request(app).post(`${API}/quotes`).send({ toolId: "A01", days: 8 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.days.code).toBe("DAYS_OUT_OF_RANGE");
  });

  it("404 for unknown tool", async () => {
    const res = await request(app).post(`${API}/quotes`).send({ toolId: "A99", days: 2 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TOOL_NOT_FOUND");
  });

  it("415 when body is not JSON", async () => {
    const res = await request(app).post(`${API}/quotes`).type("form").send("toolId=A01&days=3");
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("400 INVALID_JSON for malformed JSON", async () => {
    const res = await request(app).post(`${API}/quotes`).set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
