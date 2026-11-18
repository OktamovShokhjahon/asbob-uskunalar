import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, API, app, bearer, login, prisma, registerUser, uniqueUsername } from "./helpers";

afterAll(() => prisma.$disconnect());

const REG = `${API}/auth/register`;
const LOGIN = `${API}/auth/login`;

describe("POST /auth/register", () => {
  it("creates a user, logs them in, and never returns the password hash", async () => {
    const username = uniqueUsername("reg");
    const res = await request(app)
      .post(REG)
      .send({ fullName: "  Dilnoza Karimova ", username: username.toUpperCase(), password: "secret123", password2: "secret123" });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username, fullName: "Dilnoza Karimova", role: "user" });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const stored = await prisma.user.findUniqueOrThrow({ where: { username } });
    expect(stored.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(stored.passwordHash).not.toContain("secret123");
  });

  it("409 USERNAME_TAKEN for an existing username (case-insensitive)", async () => {
    const { username } = await registerUser("dup");
    const res = await request(app)
      .post(REG)
      .send({ fullName: "Boshqa", username: username.toUpperCase(), password: "secret123" });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.username.code).toBe("USERNAME_TAKEN");
  });

  it("returns every field error at once", async () => {
    const res = await request(app)
      .post(REG)
      .send({ fullName: "A", username: "a b", password: "123", password2: "1234" });
    expect(res.status).toBe(400);
    const f = res.body.error.fields;
    expect(f.fullName.code).toBe("FULLNAME_LENGTH");
    expect(f.username.code).toBe("USERNAME_INVALID");
    expect(f.password.code).toBe("PASSWORD_TOO_SHORT");
    expect(f.password2.code).toBe("PASSWORD_MISMATCH");
  });

  it("empty body fields → *_REQUIRED", async () => {
    const res = await request(app).post(REG).send({ fullName: "", username: "", password: "", password2: "" });
    const f = res.body.error.fields;
    expect(f.fullName.code).toBe("FULLNAME_REQUIRED");
    expect(f.username.code).toBe("USERNAME_REQUIRED");
    expect(f.password.code).toBe("PASSWORD_REQUIRED");
    expect(f.password2.code).toBe("PASSWORD2_REQUIRED");
  });

  it("cannot self-assign the superadmin role", async () => {
    const res = await request(app)
      .post(REG)
      .send({ fullName: "Hacker", username: uniqueUsername("h"), password: "secret123", role: "superadmin" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.role.code).toBe("UNKNOWN_FIELD");
  });
});

describe("POST /auth/login, GET /auth/me, POST /auth/logout", () => {
  it("superadmin can log in; /me returns the session user", async () => {
    const token = await login(ADMIN.username, ADMIN.password);
    const me = await request(app).get(`${API}/auth/me`).set(bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ username: "admin", role: "superadmin" });
  });

  it("wrong password and unknown user give the same 401", async () => {
    const { username } = await registerUser("pw");
    const wrong = await request(app).post(LOGIN).send({ username, password: "wrong-pass" });
    const unknown = await request(app).post(LOGIN).send({ username: "nobody_here", password: "wrong-pass" });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Foydalanuvchi nomi yoki parol notoʻgʻri");
    }
  });

  it("login is case-insensitive on username", async () => {
    const { username, password } = await registerUser("ci");
    const res = await request(app).post(LOGIN).send({ username: `  ${username.toUpperCase()} `, password });
    expect(res.status).toBe(200);
  });

  it("/me without or with a bad token → 401", async () => {
    expect((await request(app).get(`${API}/auth/me`)).status).toBe(401);
    const res = await request(app).get(`${API}/auth/me`).set(bearer("not-a-real-token"));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Avval tizimga kiring");
  });

  it("logout ends only that session", async () => {
    const { token, username, password } = await registerUser("out");
    const other = await login(username, password);

    expect((await request(app).post(`${API}/auth/logout`).set(bearer(token))).status).toBe(204);
    expect((await request(app).get(`${API}/auth/me`).set(bearer(token))).status).toBe(401);
    expect((await request(app).get(`${API}/auth/me`).set(bearer(other))).status).toBe(200);
  });

  it("expired sessions are rejected", async () => {
    const { token, user } = await registerUser("exp");
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get(`${API}/auth/me`).set(bearer(token))).status).toBe(401);
  });
});
