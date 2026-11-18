import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config";
import { API, PNG, app, bearer, prisma, registerUser, uploadPhotos, withPhotos } from "./helpers";

afterAll(() => prisma.$disconnect());

const URL = `${API}/uploads`;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);

let token: string;
beforeAll(async () => {
  ({ token } = await registerUser("img"));
});

const listing = { title: "Bolgarka", description: "Metall kesish uchun", pricePerDay: 30000, icon: "drill" };

describe("POST /uploads (multipart/form-data)", () => {
  it("saves 1–3 images under backend/public, served at /uploads/<file>", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .attach("images", PNG, { filename: "a.png", contentType: "image/png" })
      .attach("images", JPEG, { filename: "b.jpg", contentType: "image/jpeg" })
      .attach("images", WEBP, { filename: "c.webp", contentType: "image/webp" });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((u: { mime: string }) => u.mime)).toEqual(["image/png", "image/jpeg", "image/webp"]);

    for (const u of res.body.data as { id: string; url: string }[]) {
      expect(u.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/);
      const file = path.join(config.uploadDir, path.basename(u.url));
      expect(existsSync(file)).toBe(true);
      expect(config.uploadDir.split(path.sep)).toContain("public");
    }

    const png = res.body.data[0].url as string;
    const served = await request(app).get(png).buffer(true);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(Buffer.from(served.body)).toEqual(PNG);
    expect(readFileSync(path.join(config.uploadDir, path.basename(png)))).toEqual(PNG);
  });

  it("accepts the single `image` field too", async () => {
    const res = await request(app).post(URL).set(bearer(token)).attach("image", PNG, "one.png");
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
  });

  it("file type comes from the bytes, not the name: a fake .jpg is rejected", async () => {
    const before = await prisma.upload.count();
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .attach("images", Buffer.from("<script>alert(1)</script>"), { filename: "x.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UPLOAD_INVALID");
    expect(await prisma.upload.count()).toBe(before);
  });

  it("one bad file rejects the whole batch (nothing saved)", async () => {
    const before = await prisma.upload.count();
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .attach("images", PNG, "ok.png")
      .attach("images", Buffer.from("GIF89a....."), "bad.gif");
    expect(res.status).toBe(400);
    expect(res.body.error.fields["images.1"].code).toBe("UPLOAD_INVALID");
    expect(await prisma.upload.count()).toBe(before);
  });

  it("more than 3 files → UPLOAD_TOO_MANY", async () => {
    let req = request(app).post(URL).set(bearer(token));
    for (let i = 0; i < 4; i++) req = req.attach("images", PNG, `p${i}.png`);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UPLOAD_TOO_MANY");
  });

  it("over 2 MB → 413 UPLOAD_TOO_LARGE", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await request(app).post(URL).set(bearer(token)).attach("images", big, "big.png");
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("UPLOAD_TOO_LARGE");
  });

  it("no file → UPLOAD_REQUIRED; other field names → UPLOAD_INVALID", async () => {
    const none = await request(app).post(URL).set(bearer(token)).field("note", "x");
    expect(none.status).toBe(400);

    const empty = await request(app)
      .post(URL)
      .set(bearer(token))
      .set("Content-Type", "multipart/form-data; boundary=xyz")
      .send("--xyz--\r\n");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("UPLOAD_REQUIRED");

    const wrong = await request(app).post(URL).set(bearer(token)).attach("avatar", PNG, "a.png");
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe("UPLOAD_INVALID");
  });

  it("needs login; other content types → 415", async () => {
    expect((await request(app).post(URL).attach("images", PNG, "a.png")).status).toBe(401);
    const res = await request(app).post(URL).set(bearer(token)).set("Content-Type", "image/png").send(PNG);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UPLOAD_MEDIA_TYPE");
  });
});

describe("POST /uploads (JSON dataUrl, legacy)", () => {
  it("still works for one image", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ dataUrl: `data:image/png;base64,${PNG.toString("base64")}` });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
  });

  it("declared type must match the bytes", async () => {
    const res = await request(app)
      .post(URL)
      .set(bearer(token))
      .send({ dataUrl: `data:image/jpeg;base64,${PNG.toString("base64")}` });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UPLOAD_INVALID");
  });
});

describe("photos on eʼlonlar", () => {
  it("an eʼlon without photos is rejected", async () => {
    for (const body of [listing, { ...listing, photos: [] }]) {
      const res = await request(app).post(`${API}/listings`).set(bearer(token)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.fields.photos.code).toBe("PHOTOS_REQUIRED");
    }
  });

  it("photos come back as /uploads URLs in order", async () => {
    const ids = await uploadPhotos(token, 2);
    const res = await request(app).post(`${API}/listings`).set(bearer(token)).send({ ...listing, photos: ids });
    expect(res.status).toBe(201);
    expect(res.body.data.photos).toHaveLength(2);
    expect(res.body.data.photos[0]).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
  });

  it("someone else's upload cannot be attached", async () => {
    const other = await registerUser("img2");
    const [foreign] = await uploadPhotos(other.token);
    const res = await request(app).post(`${API}/listings`).set(bearer(token)).send({ ...listing, photos: [foreign] });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.photos.code).toBe("PHOTOS_INVALID");
  });

  it("more than 3 photos → PHOTOS_TOO_MANY", async () => {
    const ids = [...(await uploadPhotos(token, 3)), ...(await uploadPhotos(token, 1))];
    const res = await request(app).post(`${API}/listings`).set(bearer(token)).send({ ...listing, photos: ids });
    expect(res.body.error.fields.photos.code).toBe("PHOTOS_TOO_MANY");
  });
});

describe("DELETE /uploads/:id", () => {
  it("removes an unused upload and its file", async () => {
    const res = await request(app).post(URL).set(bearer(token)).attach("images", PNG, "d.png");
    const { id, url } = res.body.data[0];
    const file = path.join(config.uploadDir, path.basename(url));

    expect((await request(app).delete(`${URL}/${id}`).set(bearer(token))).status).toBe(204);
    expect(existsSync(file)).toBe(false);
    expect(await prisma.upload.findUnique({ where: { id } })).toBeNull();
  });

  it("refuses photos already on an eʼlon, and other users' uploads", async () => {
    const body = await withPhotos(token, listing);
    expect((await request(app).post(`${API}/listings`).set(bearer(token)).send(body)).status).toBe(201);

    const inUse = await request(app).delete(`${URL}/${body.photos[0]}`).set(bearer(token));
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe("UPLOAD_IN_USE");

    const other = await registerUser("img3");
    const [theirs] = await uploadPhotos(other.token);
    expect((await request(app).delete(`${URL}/${theirs}`).set(bearer(token))).status).toBe(404);
  });
});
