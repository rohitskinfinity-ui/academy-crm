import jwt from "jsonwebtoken";

export type AdminJwtPayload = {
  userId: string;
  email: string;
  role: "admin" | "staff";
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as AdminJwtPayload;
  if (!decoded?.userId || !decoded?.role) {
    throw new Error("Invalid token payload");
  }
  if (decoded.role !== "admin" && decoded.role !== "staff") {
    throw new Error("Not an admin token");
  }
  return decoded;
}
