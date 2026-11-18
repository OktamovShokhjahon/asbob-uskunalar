import { randomBytes } from "node:crypto";
import request from "supertest";
import { expect } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { TEST_ENV } from "../vitest.config";

export const app = createApp();
export const API = "/api/v1";

export const ADMIN = { username: "admin", password: TEST_ENV.SUPERADMIN_PASSWORD };

export function countRentals() {
  return prisma.rentalRequest.count();
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A valid 1×1 PNG. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Uploads `count` PNGs as `token`'s user (multipart) and returns their upload ids. */
export async function uploadPhotos(token: string, count = 1): Promise<string[]> {
  let req = request(app).post(`${API}/uploads`).set(bearer(token));
  for (let i = 0; i < count; i++) req = req.attach("images", PNG, { filename: `p${i}.png`, contentType: "image/png" });
  const res = await req;
  expect(res.status).toBe(201);
  return (res.body.data as { id: string }[]).map((u) => u.id);
}

/** Body + one freshly uploaded photo (every eʼlon needs at least one). */
export async function withPhotos<T extends object>(token: string, body: T, count = 1) {
  return { ...body, photos: await uploadPhotos(token, count) };
}

/** Unique username per call, so test files never collide in the shared test DB. */
export function uniqueUsername(prefix = "u") {
  return `${prefix}_${randomBytes(4).toString("hex")}`.slice(0, 20);
}

export async function login(username: string, password: string): Promise<string> {
  const res = await request(app).post(`${API}/auth/login`).send({ username, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

export async function registerUser(prefix = "u") {
  const username = uniqueUsername(prefix);
  const password = "secret123";
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ fullName: "Test Foydalanuvchi", username, password, password2: password });
  expect(res.status).toBe(201);
  return { token: res.body.data.token as string, user: res.body.data.user, username, password };
}

export { prisma };
