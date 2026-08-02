import jwt from "jsonwebtoken";

export type AdminJwtPayload = {
  userId: string;
  email: string;
  role: "admin" | "staff";
};

export type StudentJwtPayload = {
  userId: string;
  email: string;
  role: "student";
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

export function signStudentToken(payload: StudentJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyStudentToken(token: string): StudentJwtPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as StudentJwtPayload;
  if (!decoded?.userId || !decoded?.email || decoded.role !== "student") {
    throw new Error("Not a student token");
  }
  return decoded;
}
