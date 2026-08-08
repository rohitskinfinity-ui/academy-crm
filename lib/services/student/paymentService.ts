import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  PAYMENTS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function methodLabel(
  method: string | null | undefined,
  description: string | null | undefined,
): string {
  const desc = (description || "").trim().toLowerCase();
  if (desc === "referral wallet") return "Referral wallet";
  switch ((method || "").toLowerCase()) {
    case "credit_card":
      return "Credit Card";
    case "upi":
      return "UPI";
    case "bank_transfer":
      return "Bank Transfer";
    case "cash":
      return "Cash";
    case "other":
      return "QR / Cash";
    default:
      return method ? method.replace(/_/g, " ") : "Payment";
  }
}

export type StudentPaymentItem = {
  id: string;
  txn_code: string;
  course: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  payment_option: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string;
};

export type StudentPaymentsPayload = {
  summary: {
    total_spent: number;
    pending: number;
    courses_purchased: number;
    currency: string;
  };
  items: StudentPaymentItem[];
};

export async function getStudentPayments(
  userId: string,
): Promise<StudentPaymentsPayload> {
  const [paymentRows] = await db.query<{
    id: string;
    txn_code: string;
    amount: number | string;
    currency: string;
    method: string | null;
    status: string;
    payment_option: string | null;
    description: string | null;
    paid_at: string | null;
    created_at: string;
    course: string | null;
  }>(
    `SELECT p.id,
            p.txn_code,
            p.amount::float8 AS amount,
            p.currency,
            p.method::text AS method,
            p.status::text AS status,
            p.payment_option::text AS payment_option,
            p.description,
            p.paid_at::text AS paid_at,
            p.created_at::text AS created_at,
            COALESCE(NULLIF(e.title, ''), c.title, w.title, p.description, 'Payment') AS course
     FROM ${PAYMENTS_TABLE} p
     LEFT JOIN ${ENROLLMENTS_TABLE} e
       ON e.id = p.enrollment_id AND e.deleted_at IS NULL
     LEFT JOIN ${COURSES_TABLE} c
       ON c.id = COALESCE(p.course_id, e.course_id) AND c.deleted_at IS NULL
     LEFT JOIN ${WORKSHOPS_TABLE} w
       ON w.id = e.workshop_id AND w.deleted_at IS NULL
     WHERE p.user_id = $1
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC`,
    [userId],
  );

  const items: StudentPaymentItem[] = (
    Array.isArray(paymentRows) ? paymentRows : []
  ).map((row) => ({
    id: row.id,
    txn_code: row.txn_code,
    course: row.course?.trim() || "Payment",
    amount: money(row.amount),
    currency: row.currency || "INR",
    method: methodLabel(row.method, row.description),
    status: row.status || "pending",
    payment_option: row.payment_option,
    description: row.description,
    paid_at: row.paid_at,
    created_at: row.created_at,
  }));

  const [spentRows] = await db.query<{ total: number | string }>(
    `SELECT COALESCE(SUM(amount), 0)::float8 AS total
     FROM ${PAYMENTS_TABLE}
     WHERE user_id = $1 AND status = 'paid'`,
    [userId],
  );

  const [pendingRows] = await db.query<{ pending: number | string }>(
    `SELECT COALESCE(SUM(
              GREATEST(e.agreed_price - COALESCE(pay.amount_paid, 0), 0)
            ), 0)::float8 AS pending
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN (
       SELECT enrollment_id, SUM(amount) AS amount_paid
       FROM ${PAYMENTS_TABLE}
       WHERE user_id = $1
         AND status = 'paid'
         AND enrollment_id IS NOT NULL
       GROUP BY enrollment_id
     ) pay ON pay.enrollment_id = e.id
     WHERE e.user_id = $1
       AND e.deleted_at IS NULL
       AND e.agreed_price IS NOT NULL`,
    [userId],
  );

  const [courseRows] = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT COALESCE(p.enrollment_id, p.course_id, p.id))::text AS count
     FROM ${PAYMENTS_TABLE} p
     WHERE p.user_id = $1 AND p.status = 'paid'`,
    [userId],
  );

  const currency =
    items.find((i) => i.currency)?.currency ||
    (Array.isArray(paymentRows) ? paymentRows[0]?.currency : null) ||
    "INR";

  return {
    summary: {
      total_spent: money(Array.isArray(spentRows) ? spentRows[0]?.total : 0),
      pending: money(Array.isArray(pendingRows) ? pendingRows[0]?.pending : 0),
      courses_purchased: parseInt(
        Array.isArray(courseRows) ? (courseRows[0]?.count ?? "0") : "0",
        10,
      ),
      currency,
    },
    items,
  };
}
