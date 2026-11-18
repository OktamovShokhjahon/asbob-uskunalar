import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, API, app, bearer, countRentals, login, prisma, registerUser } from "./helpers";

afterAll(() => prisma.$disconnect());

const URL = `${API}/rental-requests`;

/** Sends an invalid body and checks that nothing was saved. */
async function expectRejected(body: Record<string, unknown>) {
  const before = await countRentals();
  const res = await request(app).post(URL).send(body);
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.data).toBeUndefined();
  expect(await countRentals()).toBe(before);
  return res.body.error.fields as Record<string, { code: string; message: string }>;
}

describe("POST /rental-requests — valid", () => {
  it("B2 + B3: A03 for 2 days by Ali → Proyektor, 200 000; readable by id", async () => {
    const res = await request(app).post(URL).send({ toolId: "A03", days: 2, customerName: "Ali" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      toolId: "A03",
      toolName: "Proyektor",
      days: 2,
      pricePerDay: 100000,
      total: 200000,
      customerName: "Ali",
      status: "PENDING",
    });
    expect(res.headers.location).toBe(`${URL}/${res.body.data.id}`);

    const read = await request(app).get(`${URL}/${res.body.data.id}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toEqual(res.body.data);
  });

  it("trims the name and accepts a lowercase tool id", async () => {
    const res = await request(app).post(URL).send({ toolId: "a01", days: 3, customerName: "  Dilnoza  " });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ toolId: "A01", customerName: "Dilnoza", total: 90000 });
  });

  it("B11: client-sent total and price are ignored", async () => {
    const res = await request(app)
      .post(URL)
      .send({ toolId: "A01", days: 3, customerName: "Ali", total: 1, pricePerDay: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(90000);
    expect(res.body.data.pricePerDay).toBe(30000);
  });

  it("Idempotency-Key: the same key does not create a second record", async () => {
    const before = await countRentals();
    const body = { toolId: "A02", days: 1, customerName: "Ali" };
    const first = await request(app).post(URL).set("Idempotency-Key", "test-key-1").send(body);
    const second = await request(app).post(URL).set("Idempotency-Key", "test-key-1").send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await countRentals()).toBe(before + 1);
  });
});

describe("POST /rental-requests — rejected (nothing saved)", () => {
  it("B4: days = 0", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 0, customerName: "Ali" });
    expect(fields.days.code).toBe("DAYS_OUT_OF_RANGE");
    expect(fields.days.message).toBe("Kunlar soni 1 dan 7 gacha boʻlishi kerak");
  });

  it("B5: days = 8", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 8, customerName: "Ali" });
    expect(fields.days.code).toBe("DAYS_OUT_OF_RANGE");
  });

  it("B6: days = 2.5", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 2.5, customerName: "Ali" });
    expect(fields.days.code).toBe("DAYS_NOT_INTEGER");
  });

  it('days as string "3" is not accepted', async () => {
    const fields = await expectRejected({ toolId: "A01", days: "3", customerName: "Ali" });
    expect(fields.days.code).toBe("DAYS_NOT_INTEGER");
  });

  it("days = -1", async () => {
    const fields = await expectRejected({ toolId: "A01", days: -1, customerName: "Ali" });
    expect(fields.days.code).toBe("DAYS_OUT_OF_RANGE");
  });

  it("B7: days missing (and null)", async () => {
    expect((await expectRejected({ toolId: "A01", customerName: "Ali" })).days.code).toBe("DAYS_REQUIRED");
    expect((await expectRejected({ toolId: "A01", days: null, customerName: "Ali" })).days.code).toBe(
      "DAYS_REQUIRED",
    );
  });

  it('B8: empty or whitespace-only name', async () => {
    const empty = await expectRejected({ toolId: "A01", days: 3, customerName: "" });
    expect(empty.customerName.code).toBe("NAME_REQUIRED");
    expect(empty.customerName.message).toBe("Ismni kiriting");

    const spaces = await expectRejected({ toolId: "A01", days: 3, customerName: "   " });
    expect(spaces.customerName.code).toBe("NAME_REQUIRED");
  });

  it("name longer than 50 characters", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 3, customerName: "a".repeat(51) });
    expect(fields.customerName.code).toBe("NAME_TOO_LONG");
  });

  it("name with control characters", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 3, customerName: "Ali\u0000" });
    expect(fields.customerName.code).toBe("NAME_INVALID");
  });

  it("B9: days = 0 and empty name → both errors at once", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 0, customerName: "" });
    expect(fields.days.code).toBe("DAYS_OUT_OF_RANGE");
    expect(fields.customerName.code).toBe("NAME_REQUIRED");
  });

  it("missing toolId", async () => {
    const fields = await expectRejected({ days: 3, customerName: "Ali" });
    expect(fields.toolId.code).toBe("TOOL_REQUIRED");
  });

  it("unknown extra field is rejected", async () => {
    const fields = await expectRejected({ toolId: "A01", days: 3, customerName: "Ali", discount: 50 });
    expect(fields.discount.code).toBe("UNKNOWN_FIELD");
  });

  it("B10: unknown tool → 404 TOOL_NOT_FOUND, nothing saved", async () => {
    const before = await countRentals();
    const res = await request(app).post(URL).send({ toolId: "A99", days: 2, customerName: "Ali" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TOOL_NOT_FOUND");
    expect(await countRentals()).toBe(before);
  });
});

describe("GET /rental-requests/:id", () => {
  it("404 REQUEST_NOT_FOUND for unknown id", async () => {
    const res = await request(app).get(`${URL}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("REQUEST_NOT_FOUND");
  });

  it("rental list needs a superadmin session", async () => {
    expect((await request(app).get(URL)).status).toBe(401);

    const { token } = await registerUser("rent");
    expect((await request(app).get(URL).set(bearer(token))).status).toBe(403);

    const adminToken = await login(ADMIN.username, ADMIN.password);
    const res = await request(app).get(URL).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});
