import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, API, app, bearer, login, prisma, registerUser, withPhotos } from "./helpers";

afterAll(() => prisma.$disconnect());

const ADM = `${API}/admin`;
let adminToken: string;
let user: Awaited<ReturnType<typeof registerUser>>;

async function newPending(title = "Elektr arra") {
  const res = await request(app)
    .post(`${API}/listings`)
    .set(bearer(user.token))
    .send(await withPhotos(user.token, { title, description: "Yogʻoch kesish uchun", pricePerDay: 35000, icon: "drill" }));
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

beforeAll(async () => {
  adminToken = await login(ADMIN.username, ADMIN.password);
  user = await registerUser("adm");
});

describe("access", () => {
  it("401 without login, 403 for a normal user", async () => {
    for (const path of ["/stats", "/listings", "/users"]) {
      expect((await request(app).get(`${ADM}${path}`)).status).toBe(401);
      const res = await request(app).get(`${ADM}${path}`).set(bearer(user.token));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("review queue", () => {
  it("approve: leaves the queue, appears in the catalog, becomes rentable", async () => {
    const id = await newPending("Shurupovyort");

    const queue = await request(app).get(`${ADM}/listings`).set(bearer(adminToken));
    expect(queue.status).toBe(200);
    expect(queue.body.data.some((l: { id: string }) => l.id === id)).toBe(true);

    const res = await request(app)
      .post(`${ADM}/listings/${id}/review`)
      .set(bearer(adminToken))
      .send({ decision: "approve" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, status: "approved" });
    expect(res.body.data.reviewedAt).toBeDefined();

    expect((await request(app).get(`${API}/listings/${id}`)).status).toBe(200);
    const quote = await request(app).post(`${API}/quotes`).send({ toolId: id, days: 4 });
    expect(quote.body.data.total).toBe(140000);
  });

  it("reject with a reason: owner sees it in /me/listings; not public", async () => {
    const id = await newPending("Eski arra");
    const res = await request(app)
      .post(`${ADM}/listings/${id}/review`)
      .set(bearer(adminToken))
      .send({ decision: "reject", reason: "  Rasm va tavsif yetarli emas " });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "rejected", rejectReason: "Rasm va tavsif yetarli emas" });

    const mine = await request(app).get(`${API}/me/listings`).set(bearer(user.token));
    expect(mine.body.data.find((l: { id: string }) => l.id === id)).toMatchObject({ status: "rejected" });
    expect((await request(app).get(`${API}/listings/${id}`)).status).toBe(404);

    const rejected = await request(app).get(`${ADM}/listings?status=rejected`).set(bearer(adminToken));
    expect(rejected.body.data.some((l: { id: string }) => l.id === id)).toBe(true);
  });

  it("a listing is reviewed only once (409)", async () => {
    const id = await newPending();
    const first = await request(app).post(`${ADM}/listings/${id}/review`).set(bearer(adminToken)).send({ decision: "approve" });
    expect(first.status).toBe(200);
    const again = await request(app).post(`${ADM}/listings/${id}/review`).set(bearer(adminToken)).send({ decision: "reject" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_REVIEWED");
  });

  it("validation and not-found", async () => {
    const id = await newPending();
    const bad = await request(app).post(`${ADM}/listings/${id}/review`).set(bearer(adminToken)).send({ decision: "maybe" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.decision.code).toBe("DECISION_INVALID");

    const long = await request(app)
      .post(`${ADM}/listings/${id}/review`)
      .set(bearer(adminToken))
      .send({ decision: "reject", reason: "x".repeat(201) });
    expect(long.body.error.fields.reason.code).toBe("REASON_TOO_LONG");

    const missing = await request(app).post(`${ADM}/listings/E999/review`).set(bearer(adminToken)).send({ decision: "approve" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("LISTING_NOT_FOUND");

    const status = await request(app).get(`${ADM}/listings?status=everything`).set(bearer(adminToken));
    expect(status.status).toBe(400);
    expect(status.body.error.fields.status.code).toBe("STATUS_INVALID");
  });
});

describe("stats and users", () => {
  it("stats match the database", async () => {
    const res = await request(app).get(`${ADM}/stats`).set(bearer(adminToken));
    expect(res.status).toBe(200);
    const count = (status: string) => prisma.listing.count({ where: { status } });
    expect(res.body.data).toEqual({
      pending: await count("pending"),
      approved: await count("approved"),
      rejected: await count("rejected"),
      users: await prisma.user.count({ where: { role: "user" } }),
    });
  });

  it("users list includes listing counts and no password hashes", async () => {
    const res = await request(app).get(`${ADM}/users`).set(bearer(adminToken));
    expect(res.status).toBe(200);
    const me = res.body.data.find((u: { id: string }) => u.id === user.user.id);
    expect(me.listingCount).toBeGreaterThanOrEqual(3);
    expect(res.body.data.every((u: Record<string, unknown>) => !("passwordHash" in u))).toBe(true);
  });
});

// Runs last in this file: it wipes users, user eʼlonlar, rentals and all sessions.
describe("POST /admin/reset-demo", () => {
  it("normal user cannot reset", async () => {
    expect((await request(app).post(`${ADM}/reset-demo`).set(bearer(user.token))).status).toBe(403);
  });

  it("resets to the superadmin + 6 seeded tools and ends every session", async () => {
    const res = await request(app).post(`${ADM}/reset-demo`).set(bearer(adminToken));
    expect(res.status).toBe(204);

    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.listing.findMany({ select: { id: true } })).map((l) => l.id).sort()).toEqual([
      "A01", "A02", "A03", "A04", "A05", "A06",
    ]);
    expect(await prisma.rentalRequest.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect((await request(app).get(`${API}/auth/me`).set(bearer(adminToken))).status).toBe(401);

    // superadmin password survives the reset
    await login(ADMIN.username, ADMIN.password);
  });
});
