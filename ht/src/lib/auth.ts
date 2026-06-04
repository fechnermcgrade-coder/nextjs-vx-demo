import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/lib/env";
import type { Role } from "@/types";

const DEV_SECRET = "dev-only-jwt-secret-change-me";

export type TokenPayload = {
  sub: string;
  role: Role;
};

function getSecret() {
  const secret = getEnv().jwtSecret || (process.env.NODE_ENV !== "production" ? DEV_SECRET : "");
  if (secret.length < 16) throw new Error("JWT_SECRET must be at least 16 characters");
  return new TextEncoder().encode(secret);
}

export async function signAppToken(payload: TokenPayload) {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAppToken(token: string) {
  const verified = await jwtVerify(token, getSecret());
  const sub = verified.payload.sub;
  const role = verified.payload.role;
  if (!sub || (role !== "user" && role !== "admin")) return null;
  return { sub, role } as TokenPayload;
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}
