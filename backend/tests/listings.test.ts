import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, API, app, bearer, login, prisma, registerUser, withPhotos } from "./helpers";

afterAll(() => prisma.$disconnect());

const URL = `${API}/listings`;
const valid = { title: "Perforator", description: "Beton teshish uchun kuchli", pricePerDay: 45000, icon: "drill" };

describe("public catalog", () => {
  it("lists approved listings with the 6 seeded tools first", async () => {
    const res = await request(app).get(URL);
    expect(res.status).toBe(200);
    expect(res.body.data.slice(0, 6).map((l: { id: string }) => l.id)).toEqual(["A01", "A02", "A03", "A04", "A05", "A06"]);
    expect(res.body.data[0]).toMatchObject({
      title: "Drel",
      icon: "drill",
      status: "approved",
      ownerUsername: "admin",
      ownerName: "Superadmin",
    });
    expect(res.body.data.every((l: { status: string }) => l.status === "approved")).toBe(true);
  });

  it("GET /listings/:id works for approved, 404 otherwise", async () => {
    expect((await request(app).get(`${URL}/a03`)).body.data.title).toBe("Proyektor");
    const res = await request(app).get(`${URL}/E999`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LISTING_NOT_FOUND");
  });
});

describe("POST /listings (Eʼlon berish)", () => {
  it("401 without login", async () => {
    const res = await request(app).post(URL).send(valid);
    expect(res.status).toBe(401);
  });

  it("user eʼlon is pending: hidden from catalog, not rentable, visible in /me/listings", async () => {
    const { token, user } = await registerUser("own");
    const res = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, valid));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...valid,
      status: "pending",
      ownerId: user.id,
      ownerUsername: user.username,
      ownerName: "Test Foydalanuvchi",
    });
    expect(res.body.data.id).toMatch(/^E\d{3,}$/);
    expect(res.body.data.reviewedAt).toBeUndefined();
    const id = res.body.data.id as string;

    expect((await request(app).get(`${URL}/${id}`)).status).toBe(404);
    const catalog = await request(app).get(URL);
    expect(catalog.body.data.some((l: { id: string }) => l.id === id)).toBe(false);

    const quote = await request(app).post(`${API}/quotes`).send({ toolId: id, days: 2 });
    expect(quote.status).toBe(404);

    const mine = await request(app).get(`${API}/me/listings`).set(bearer(token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((l: { id: string }) => l.id)).toEqual([id]);
  });

  it("ids increase: E001, E002, …", async () => {
    const { token } = await registerUser("seq");
    const a = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, valid));
    const b = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, valid));
    expect(Number(b.body.data.id.slice(1))).toBe(Number(a.body.data.id.slice(1)) + 1);
  });

  it("superadmin's own eʼlon is approved at once and rentable", async () => {
    const token = await login(ADMIN.username, ADMIN.password);
    const res = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, { ...valid, title: "Payvand apparati", pricePerDay: 70000 }));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("approved");
    expect(res.body.data.reviewedAt).toBeDefined();

    const rent = await request(app)
      .post(`${API}/rental-requests`)
      .send({ toolId: res.body.data.id, days: 3, customerName: "Ali" });
    expect(rent.status).toBe(201);
    expect(rent.body.data).toMatchObject({ toolName: "Payvand apparati", total: 210000 });
  });

  it("validates every field at once", async () => {
    const { token } = await registerUser("val");
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ title: "X", description: "abc", pricePerDay: 500, icon: "rocket" });
    expect(res.status).toBe(400);
    const f = res.body.error.fields;
    expect(f.title.code).toBe("TITLE_LENGTH");
    expect(f.description.code).toBe("DESCRIPTION_LENGTH");
    expect(f.pricePerDay.code).toBe("PRICE_OUT_OF_RANGE");
    expect(f.icon.code).toBe("ICON_INVALID");
  });

  it("required fields, non-integer price, and client-set status are handled", async () => {
    const { token } = await registerUser("req");
    const empty = await request(app).post(URL).set(bearer(token)).send({ title: " ", description: "", icon: "box" });
    expect(empty.body.error.fields.title.code).toBe("TITLE_REQUIRED");
    expect(empty.body.error.fields.description.code).toBe("DESCRIPTION_REQUIRED");
    expect(empty.body.error.fields.pricePerDay.code).toBe("PRICE_REQUIRED");
    expect(empty.body.error.fields.photos.code).toBe("PHOTOS_REQUIRED");

    const frac = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, { ...valid, pricePerDay: 25000.5 }));
    expect(frac.body.error.fields.pricePerDay.code).toBe("PRICE_NOT_INTEGER");

    // status is server-owned: dropped silently, the eʼlon still goes to review
    const sneaky = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, { ...valid, status: "approved" }));
    expect(sneaky.status).toBe(201);
    expect(sneaky.body.data.status).toBe("pending");
  });

  it("icon defaults to box", async () => {
    const { token } = await registerUser("ico");
    const { icon: _drop, ...noIcon } = valid;
    const res = await request(app).post(URL).set(bearer(token)).send(await withPhotos(token, noIcon));
    expect(res.body.data.icon).toBe("box");
  });
});
