import { db } from "@/lib/db";
import {
  ENROLLMENTS_TABLE,
  PAYMENTS_TABLE,
  REFERRAL_CODES_TABLE,
  REFERRAL_WALLET_LEDGER_TABLE,
  REFERRALS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { getStudentWebUrl } from "@/lib/auth/google";

export const DEFAULT_REFERRAL_REWARD = 500;

export type ReferralCodeRow = {
  id: string;
  user_id: string;
  code: string;
  reward_amount: number;
  currency: string;
  is_active: boolean;
  referrer_email?: string | null;
  referrer_name?: string | null;
};

type Queryable = {
  query: typeof db.query;
};

function client(conn?: Queryable) {
  return conn ?? db;
}

function baseFromName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] || "STUDENT";
  const cleaned = first.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (cleaned.slice(0, 8) || "STUDENT");
}

function randomSuffix(len = 2) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function normalizeReferralCode(raw: string | null | undefined) {
  const code = (raw ?? "").trim().toUpperCase();
  return code || null;
}

const INVALID_CODE_MESSAGE = "Invalid referral code";
const STUDENT_MISSING_MESSAGE =
  "Invalid referral code. Student not found.";
const NOT_ENROLLED_MESSAGE =
  "Invalid referral code. The student must be enrolled in a course.";

export type ReferralInspectOk = {
  valid: true;
  row: ReferralCodeRow;
  code: string;
  referrer_first_name: string;
  friend_discount: number;
  reward_amount: number;
  currency: string;
};

export type ReferralInspectFail = {
  valid: false;
  row: null;
  code: string | null;
  status: number;
  reason:
    | "missing"
    | "not_found"
    | "inactive"
    | "student_missing"
    | "not_enrolled";
  message: string;
};

export type ReferralInspectResult = ReferralInspectOk | ReferralInspectFail;

function rewardFromRow(row: Pick<ReferralCodeRow, "reward_amount">) {
  return Number(row.reward_amount) || DEFAULT_REFERRAL_REWARD;
}

function firstNameFromRow(row: Pick<ReferralCodeRow, "referrer_name">) {
  return (row.referrer_name || "A student").trim().split(/\s+/)[0];
}

function asBool(value: unknown) {
  return (
    value === true || value === "t" || value === "true" || value === 1 || value === "1"
  );
}

/** Active code + existing student. Does not require an enrollment (for display). */
export async function lookupReferralCode(
  raw: string | null | undefined,
  conn?: Queryable,
): Promise<ReferralCodeRow | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const [rows] = await client(conn).query<ReferralCodeRow>(
    `SELECT rc.id, rc.user_id, rc.code,
            rc.reward_amount::float8 AS reward_amount,
            rc.currency, rc.is_active,
            u.email AS referrer_email,
            u.full_name AS referrer_name
     FROM ${REFERRAL_CODES_TABLE} rc
     JOIN ${USERS_TABLE} u ON u.id = rc.user_id AND u.deleted_at IS NULL
     WHERE upper(rc.code) = $1 AND rc.is_active = true
     LIMIT 1`,
    [code],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function inspectReferralCode(
  raw: string | null | undefined,
  conn?: Queryable,
): Promise<ReferralInspectResult> {
  const code = normalizeReferralCode(raw);
  if (!code) {
    return {
      valid: false,
      row: null,
      code: null,
      status: 400,
      reason: "missing",
      message: "Referral code is required",
    };
  }

  const [rows] = await client(conn).query<{
    id: string;
    user_id: string;
    code: string;
    reward_amount: number;
    currency: string;
    is_active: boolean;
    referrer_email: string | null;
    referrer_name: string | null;
    referrer_exists: boolean;
    enrolled: boolean;
  }>(
    `SELECT rc.id, rc.user_id, rc.code,
            rc.reward_amount::float8 AS reward_amount,
            rc.currency, rc.is_active,
            u.email AS referrer_email,
            u.full_name AS referrer_name,
            (u.id IS NOT NULL) AS referrer_exists,
            EXISTS (
              SELECT 1
              FROM ${ENROLLMENTS_TABLE} e
              WHERE e.user_id = rc.user_id
                AND e.deleted_at IS NULL
                AND e.status IN ('active', 'completed')
            ) AS enrolled
     FROM ${REFERRAL_CODES_TABLE} rc
     LEFT JOIN ${USERS_TABLE} u ON u.id = rc.user_id AND u.deleted_at IS NULL
     WHERE upper(rc.code) = $1
     LIMIT 1`,
    [code],
  );

  const found = Array.isArray(rows) ? rows[0] ?? null : null;
  if (!found) {
    return {
      valid: false,
      row: null,
      code,
      status: 404,
      reason: "not_found",
      message: INVALID_CODE_MESSAGE,
    };
  }
  if (!found.is_active) {
    return {
      valid: false,
      row: null,
      code,
      status: 404,
      reason: "inactive",
      message: INVALID_CODE_MESSAGE,
    };
  }
  if (!asBool(found.referrer_exists)) {
    return {
      valid: false,
      row: null,
      code,
      status: 404,
      reason: "student_missing",
      message: STUDENT_MISSING_MESSAGE,
    };
  }
  if (!asBool(found.enrolled)) {
    return {
      valid: false,
      row: null,
      code,
      status: 422,
      reason: "not_enrolled",
      message: NOT_ENROLLED_MESSAGE,
    };
  }

  const row: ReferralCodeRow = {
    id: found.id,
    user_id: found.user_id,
    code: found.code,
    reward_amount: Number(found.reward_amount),
    currency: found.currency,
    is_active: found.is_active,
    referrer_email: found.referrer_email,
    referrer_name: found.referrer_name,
  };
  const reward = rewardFromRow(row);
  return {
    valid: true,
    row,
    code: row.code,
    referrer_first_name: firstNameFromRow(row),
    friend_discount: reward,
    reward_amount: reward,
    currency: row.currency || "INR",
  };
}

/** Usable coupon: existing student who is enrolled in a course/workshop. */
export async function lookupActiveReferralCode(
  raw: string | null | undefined,
  conn?: Queryable,
): Promise<ReferralCodeRow | null> {
  const inspected = await inspectReferralCode(raw, conn);
  return inspected.valid ? inspected.row : null;
}

export function toAdminReferralValidation(inspected: ReferralInspectResult) {
  if (!inspected.valid) {
    return {
      valid: false as const,
      empty: false as const,
      code: inspected.code,
      reason: inspected.reason,
      message: inspected.message,
      referrer_first_name: null as string | null,
      referrer_name: null as string | null,
      referrer_email: null as string | null,
      friend_discount: null as number | null,
      reward_amount: null as number | null,
      currency: null as string | null,
    };
  }
  return {
    valid: true as const,
    empty: false as const,
    code: inspected.code,
    reason: null as null,
    message: `${inspected.code} from ${inspected.referrer_first_name} — ₹${inspected.friend_discount.toLocaleString()} off.`,
    referrer_first_name: inspected.referrer_first_name,
    referrer_name: inspected.row.referrer_name ?? null,
    referrer_email: inspected.row.referrer_email ?? null,
    friend_discount: inspected.friend_discount,
    reward_amount: inspected.reward_amount,
    currency: inspected.currency,
  };
}

export async function ensureStudentReferralCode(userId: string) {
  const [existing] = await db.query<ReferralCodeRow>(
    `SELECT id, user_id, code, reward_amount::float8 AS reward_amount,
            currency, is_active
     FROM ${REFERRAL_CODES_TABLE}
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId],
  );
  const row = Array.isArray(existing) ? existing[0] : null;
  if (row) return row;

  const [userRows] = await db.query<{ full_name: string }>(
    `SELECT full_name FROM ${USERS_TABLE} WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }

  const base = baseFromName(user.full_name);
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = `${base}${randomSuffix(2)}`;
    try {
      const [created] = await db.query<ReferralCodeRow>(
        `INSERT INTO ${REFERRAL_CODES_TABLE}
           (user_id, code, reward_amount, currency, is_active)
         VALUES ($1, $2, $3, 'INR', true)
         RETURNING id, user_id, code, reward_amount::float8 AS reward_amount,
                   currency, is_active`,
        [userId, code, DEFAULT_REFERRAL_REWARD],
      );
      const inserted = Array.isArray(created) ? created[0] : null;
      if (inserted) return inserted;
    } catch (err) {
      const codeName = (err as { code?: string }).code;
      if (codeName === "23505") continue;
      throw err;
    }
  }

  throw Object.assign(new Error("Could not allocate a referral code"), {
    status: 500,
  });
}

export async function getStudentReferralDashboard(userId: string) {
  const codeRow = await ensureStudentReferralCode(userId);
  const reward = Number(codeRow.reward_amount) || DEFAULT_REFERRAL_REWARD;
  const currency = codeRow.currency || "INR";
  const web = getStudentWebUrl();

  const [rows] = await db.query<{
    id: string;
    invitee_name: string | null;
    invitee_email: string | null;
    status: string;
    reward_amount: number | null;
    currency: string;
    avatar_url: string | null;
    enrolled_at: string | null;
    created_at: string;
  }>(
    `SELECT id, invitee_name, invitee_email, status::text AS status,
            reward_amount::float8 AS reward_amount, currency, avatar_url,
            enrolled_at::text AS enrolled_at, created_at::text AS created_at
     FROM ${REFERRALS_TABLE}
     WHERE referrer_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  const wallet = await getReferralWallet(userId);

  return {
    code: codeRow.code,
    link: `${web}/join/${encodeURIComponent(codeRow.code.toLowerCase())}`,
    reward_amount: reward,
    friend_discount: reward,
    currency,
    wallet,
    available_balance: wallet.available,
    referrals: (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      invitee_name: r.invitee_name,
      invitee_email: r.invitee_email,
      status: r.status,
      reward_amount:
        r.status === "enrolled" || r.status === "rewarded"
          ? Number(r.reward_amount ?? reward)
          : null,
      currency: r.currency || currency,
      avatar_url: r.avatar_url,
      enrolled_at: r.enrolled_at,
      created_at: r.created_at,
    })),
  };
}

export type ReferralWallet = {
  available: number;
  earned: number;
  redeemed: number;
  currency: string;
};

function money2(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export async function getReferralWallet(
  userId: string,
  conn?: Queryable,
): Promise<ReferralWallet> {
  const [rows] = await client(conn).query<{
    earned: number;
    redeemed: number;
    available: number;
    currency: string | null;
  }>(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::float8 AS earned,
       COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0)), 0)::float8 AS redeemed,
       COALESCE(SUM(amount), 0)::float8 AS available,
       COALESCE(MAX(currency), 'INR') AS currency
     FROM ${REFERRAL_WALLET_LEDGER_TABLE}
     WHERE user_id = $1`,
    [userId],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    earned: money2(row?.earned),
    redeemed: money2(row?.redeemed),
    available: Math.max(0, money2(row?.available)),
    currency: row?.currency || "INR",
  };
}

export async function creditReferralReward(
  input: {
    referrerId: string;
    referralId: string;
    amount: number;
    currency?: string | null;
  },
  conn?: Queryable,
) {
  const amount = money2(input.amount);
  if (amount <= 0) return;
  try {
    await client(conn).query(
      `INSERT INTO ${REFERRAL_WALLET_LEDGER_TABLE}
         (user_id, amount, currency, kind, referral_id)
       VALUES ($1, $2, $3, 'referral_reward', $4)`,
      [
        input.referrerId,
        amount,
        input.currency?.trim() || "INR",
        input.referralId,
      ],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return;
    throw err;
  }
}

export async function getEnrollmentReferralCredit(
  enrollmentId: string,
  conn?: Queryable,
) {
  const [rows] = await client(conn).query<{ applied: number }>(
    `SELECT COALESCE(ABS(SUM(amount)), 0)::float8 AS applied
     FROM ${REFERRAL_WALLET_LEDGER_TABLE}
     WHERE enrollment_id = $1 AND kind = 'enrollment_redeem'`,
    [enrollmentId],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return money2(row?.applied);
}

export async function redeemReferralCredit(
  input: {
    userId: string;
    enrollmentId: string;
    courseId?: string | null;
    maxAmount?: number | null;
    currency?: string | null;
  },
  conn?: Queryable,
): Promise<{ applied: number; currency: string }> {
  const wallet = await getReferralWallet(input.userId, conn);
  if (wallet.available <= 0) {
    return { applied: 0, currency: wallet.currency };
  }

  const already = await getEnrollmentReferralCredit(input.enrollmentId, conn);
  if (already > 0) {
    return { applied: already, currency: wallet.currency };
  }

  let cap = wallet.available;
  if (input.maxAmount != null && Number.isFinite(Number(input.maxAmount))) {
    cap = Math.min(cap, Math.max(0, money2(input.maxAmount)));
  }
  const applied = money2(cap);
  if (applied <= 0) {
    return { applied: 0, currency: wallet.currency };
  }

  const currency = input.currency?.trim() || wallet.currency || "INR";
  const txn = `RWL-${Date.now().toString(36).toUpperCase()}`;

  try {
    await client(conn).query(
      `INSERT INTO ${REFERRAL_WALLET_LEDGER_TABLE}
         (user_id, amount, currency, kind, enrollment_id)
       VALUES ($1, $2, $3, 'enrollment_redeem', $4)`,
      [input.userId, -applied, currency, input.enrollmentId],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      const credited = await getEnrollmentReferralCredit(
        input.enrollmentId,
        conn,
      );
      return { applied: credited, currency };
    }
    throw err;
  }

  await client(conn).query(
    `INSERT INTO ${PAYMENTS_TABLE}
       (txn_code, user_id, enrollment_id, course_id, amount, currency, method,
        status, payment_option, description, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'other', 'paid', 'full', $7, now())`,
    [
      txn,
      input.userId,
      input.enrollmentId,
      input.courseId ?? null,
      applied,
      currency,
      "Referral wallet",
    ],
  );

  return { applied, currency };
}

export async function validatePublicReferralCode(
  raw: string,
  opts?: { inviteeEmail?: string | null },
) {
  const inspected = await inspectReferralCode(raw);
  if (!inspected.valid) {
    throw Object.assign(new Error(inspected.message), {
      status: inspected.status,
    });
  }
  const invitee = opts?.inviteeEmail?.trim().toLowerCase();
  if (
    invitee &&
    inspected.row.referrer_email &&
    inspected.row.referrer_email.toLowerCase() === invitee
  ) {
    throw Object.assign(new Error("You cannot use your own referral code"), {
      status: 400,
    });
  }
  return {
    valid: true,
    code: inspected.code,
    referrer_first_name: inspected.referrer_first_name,
    friend_discount: inspected.friend_discount,
    reward_amount: inspected.reward_amount,
    currency: inspected.currency,
  };
}

export async function applyReferralToApplication(input: {
  referralCode?: string | null;
  inviteeName: string;
  inviteeEmail: string;
  quotedPrice: number | null;
  source?: string | null;
}) {
  const provided = normalizeReferralCode(input.referralCode);
  if (!provided) {
    return {
      referral_code: null as string | null,
      quoted_price: input.quotedPrice,
      source: input.source ?? null,
      applied: false,
      row: null as ReferralCodeRow | null,
    };
  }

  const inspected = await inspectReferralCode(provided);
  if (!inspected.valid) {
    throw Object.assign(new Error(inspected.message), { status: 400 });
  }

  const row = inspected.row;
  const email = input.inviteeEmail.toLowerCase().trim();
  if (row.referrer_email && row.referrer_email.toLowerCase() === email) {
    throw Object.assign(new Error("You cannot use your own referral code"), {
      status: 400,
    });
  }

  const discount = rewardFromRow(row);
  const quoted =
    input.quotedPrice != null
      ? Math.max(0, Number(input.quotedPrice) - discount)
      : null;

  return {
    referral_code: row.code,
    quoted_price: quoted,
    source: input.source?.trim() || "Referral",
    applied: true,
    row,
  };
}

export async function recordPendingReferral(input: {
  codeRow: ReferralCodeRow;
  inviteeName: string;
  inviteeEmail: string;
}) {
  const email = input.inviteeEmail.toLowerCase().trim();
  const [existing] = await db.query<{ id: string; status: string }>(
    `SELECT id, status::text AS status FROM ${REFERRALS_TABLE}
     WHERE lower(invitee_email) = $1 AND status <> 'expired'
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );
  const found = Array.isArray(existing) ? existing[0] : null;
  if (found?.status === "enrolled" || found?.status === "rewarded") {
    return found;
  }
  if (found) {
    await db.query(
      `UPDATE ${REFERRALS_TABLE}
       SET referral_code_id = $1,
           referrer_id = $2,
           invitee_name = $3,
           invitee_email = $4,
           status = 'pending',
           reward_amount = NULL,
           updated_at = now()
       WHERE id = $5`,
      [
        input.codeRow.id,
        input.codeRow.user_id,
        input.inviteeName,
        email,
        found.id,
      ],
    );
    return found;
  }

  const [created] = await db.query<{ id: string }>(
    `INSERT INTO ${REFERRALS_TABLE}
       (referral_code_id, referrer_id, invitee_name, invitee_email, status, currency)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [
      input.codeRow.id,
      input.codeRow.user_id,
      input.inviteeName,
      email,
      input.codeRow.currency || "INR",
    ],
  );
  return Array.isArray(created) ? created[0] : null;
}

export async function markReferralEnrolled(input: {
  inviteeUserId: string;
  inviteeEmail: string;
  inviteeName?: string | null;
  referralCode?: string | null;
}) {
  const email = input.inviteeEmail.toLowerCase().trim();
  const code = normalizeReferralCode(input.referralCode);

  const [self] = await db.query<{ email: string | null }>(
    `SELECT email FROM ${USERS_TABLE} WHERE id = $1`,
    [input.inviteeUserId],
  );
  const inviteeAccountEmail = Array.isArray(self)
    ? self[0]?.email?.toLowerCase() ?? email
    : email;

  let codeRow: ReferralCodeRow | null = null;
  if (code) {
    codeRow = await lookupActiveReferralCode(code);
    if (codeRow?.user_id === input.inviteeUserId) return null;
    if (
      codeRow?.referrer_email &&
      codeRow.referrer_email.toLowerCase() === inviteeAccountEmail
    ) {
      return null;
    }
  }

  const [existing] = await db.query<{
    id: string;
    status: string;
    referral_code_id: string;
    referrer_id: string;
  }>(
    `SELECT id, status::text AS status, referral_code_id, referrer_id
     FROM ${REFERRALS_TABLE}
     WHERE lower(invitee_email) = $1
        OR invitee_user_id = $2
     ORDER BY
       CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [email, input.inviteeUserId],
  );
  let row = Array.isArray(existing) ? existing[0] : null;

  if (!row && codeRow) {
    const created = await recordPendingReferral({
      codeRow,
      inviteeName: input.inviteeName || email,
      inviteeEmail: email,
    });
    if (created?.id) {
      row = {
        id: created.id,
        status: "pending",
        referral_code_id: codeRow.id,
        referrer_id: codeRow.user_id,
      };
    }
  }

  if (!row || row.referrer_id === input.inviteeUserId) return null;
  if (row.status === "enrolled" || row.status === "rewarded") {
    await db.query(
      `UPDATE ${REFERRALS_TABLE}
       SET invitee_user_id = $1, updated_at = now()
       WHERE id = $2 AND invitee_user_id IS NULL`,
      [input.inviteeUserId, row.id],
    );
    const [existingReward] = await db.query<{
      reward_amount: number | null;
      currency: string | null;
    }>(
      `SELECT reward_amount::float8 AS reward_amount, currency
       FROM ${REFERRALS_TABLE} WHERE id = $1`,
      [row.id],
    );
    const existing = Array.isArray(existingReward) ? existingReward[0] : null;
    await creditReferralReward({
      referrerId: row.referrer_id,
      referralId: row.id,
      amount:
        Number(existing?.reward_amount) ||
        Number(codeRow?.reward_amount) ||
        DEFAULT_REFERRAL_REWARD,
      currency: existing?.currency || codeRow?.currency || "INR",
    });
    return row;
  }

  const [codeAmount] = await db.query<{
    reward_amount: number;
    currency: string;
  }>(
    `SELECT reward_amount::float8 AS reward_amount, currency
     FROM ${REFERRAL_CODES_TABLE} WHERE id = $1`,
    [row.referral_code_id],
  );
  const amountRow = Array.isArray(codeAmount) ? codeAmount[0] : null;
  const amount = Number(amountRow?.reward_amount) || DEFAULT_REFERRAL_REWARD;

  await db.query(
    `UPDATE ${REFERRALS_TABLE}
     SET invitee_user_id = $1,
         invitee_name = COALESCE($2, invitee_name),
         status = 'enrolled',
         reward_amount = $3,
         currency = COALESCE($4, currency),
         enrolled_at = now(),
         updated_at = now()
     WHERE id = $5`,
    [
      input.inviteeUserId,
      input.inviteeName ?? null,
      amount,
      amountRow?.currency ?? "INR",
      row.id,
    ],
  );
  await creditReferralReward({
    referrerId: row.referrer_id,
    referralId: row.id,
    amount,
    currency: amountRow?.currency ?? "INR",
  });
  return row;
}
