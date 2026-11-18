import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { TOOL_ICONS, TOOL_SEED } from "../src/data/tools.seed";
import { API, app, prisma } from "./helpers";

afterAll(() => prisma.$disconnect());

describe("GET /tools", () => {
  it("B12: the 6 seeded tools come first, in id order, with the task data", async () => {
    const res = await request(app).get(`${API}/tools`);
    expect(res.status).toBe(200);
    // Approved user eʼlonlar may follow them (catalog grows with the new feature).
    expect(res.body.data.slice(0, 6)).toEqual(TOOL_SEED.map((t) => ({ ...t, icon: TOOL_ICONS[t.id] })));
  });

  it("filters by name, case-insensitive", async () => {
    const res = await request(app).get(`${API}/tools`).query({ q: "DRE" });
    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { id: string }) => t.id)).toEqual(["A01"]);
  });
});

describe("GET /tools/:id", () => {
  it("returns one tool (case-insensitive id)", async () => {
    const res = await request(app).get(`${API}/tools/a03`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: "A03",
      name: "Proyektor",
      description: "Taqdimot uchun",
      pricePerDay: 100000,
      icon: "projector",
    });
  });

  it("404 TOOL_NOT_FOUND for unknown id", async () => {
    const res = await request(app).get(`${API}/tools/A99`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TOOL_NOT_FOUND");
    expect(res.body.error.message).toBe("Bunday asbob topilmadi");
  });
});

describe("misc", () => {
  it("GET /health reports ok", async () => {
    const res = await request(app).get(`${API}/health`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "ok", db: "ok" });
  });

  it("unknown route returns NOT_FOUND envelope", async () => {
    const res = await request(app).get(`${API}/nope`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
