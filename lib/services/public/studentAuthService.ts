import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  OAUTH_ACCOUNTS_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import type { GoogleProfile } from "@/lib/auth/google";
import { signStudentToken } from "@/lib/auth/jwt";

export type EnrolledStudent = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type StudentEnrollmentSummary = {
  id: string;
  course_id: string | null;
  status: string;
  course_title: string | null;
};

/**
 * Find an active student with at least one active/completed enrollment
 * matching the Google email. Does not create users.
 */
export async function findEnrolledStudentByEmail(
  email: string,
): Promise<EnrolledStudent | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const [rows] = await db.query<EnrolledStudent>(
    `SELECT u.id, u.email::text AS email, u.full_name, u.display_name,
            u.avatar_url, u.is_active
     FROM ${USERS_TABLE} u
     WHERE lower(u.email::text) = $1
       AND u.role = 'student'
       AND u.deleted_at IS NULL
       AND u.is_active = true
       AND EXISTS (
         SELECT 1
         FROM ${ENROLLMENTS_TABLE} e
         WHERE e.user_id = u.id
           AND e.deleted_at IS NULL
           AND e.status IN ('active', 'completed')
       )
     LIMIT 1`,
    [normalized],
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function upsertGoogleOAuthAccount(input: {
  userId: string;
  profile: GoogleProfile;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}) {
  const expiresAt =
    input.expiresIn != null
      ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
      : null;

  await db.query(
    `INSERT INTO ${OAUTH_ACCOUNTS_TABLE}
       (user_id, provider, provider_user_id, access_token, refresh_token,
        expires_at, raw_profile)
     VALUES ($1, 'google', $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, ${OAUTH_ACCOUNTS_TABLE}.refresh_token),
       expires_at = EXCLUDED.expires_at,
       raw_profile = EXCLUDED.raw_profile,
       updated_at = now()`,
    [
      input.userId,
      input.profile.sub,
      input.accessToken,
      input.refreshToken ?? null,
      expiresAt,
      JSON.stringify(input.profile),
    ],
  );
}

export async function recordStudentGoogleLogin(input: {
  userId: string;
  avatarUrl?: string | null;
}) {
  await db.query(
    `UPDATE ${USERS_TABLE}
     SET last_login_at = now(),
         email_verified_at = COALESCE(email_verified_at, now()),
         avatar_url = COALESCE($2, avatar_url),
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [input.userId, input.avatarUrl ?? null],
  );
}

export async function completeGoogleStudentLogin(input: {
  profile: GoogleProfile;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}): Promise<{ token: string; student: EnrolledStudent } | { error: string }> {
  const email = input.profile.email?.trim().toLowerCase();
  if (!email) {
    return { error: "not_enrolled" };
  }

  const student = await findEnrolledStudentByEmail(email);
  if (!student) {
    return { error: "not_enrolled" };
  }

  await upsertGoogleOAuthAccount({
    userId: student.id,
    profile: input.profile,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresIn: input.expiresIn,
  });

  await recordStudentGoogleLogin({
    userId: student.id,
    avatarUrl: input.profile.picture ?? null,
  });

  const token = signStudentToken({
    userId: student.id,
    email: student.email,
    role: "student",
  });

  return { token, student };
}

export async function getStudentMe(userId: string) {
  const [userRows] = await db.query<{
    id: string;
    email: string;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
  }>(
    `SELECT id, email::text AS email, full_name, display_name, avatar_url,
            role, is_active, last_login_at::text
     FROM ${USERS_TABLE}
     WHERE id = $1 AND role = 'student' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );

  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user) return null;

  const [profileRows] = await db.query<{
    phone: string | null;
    whatsapp: string | null;
    alternate_phone: string | null;
    location: string | null;
    address_line: string | null;
    city_state: string | null;
    pin_code: string | null;
    date_of_birth: string | null;
    gender: string | null;
    program_label: string | null;
    highest_qualification: string | null;
    profession: string | null;
    medical_background: string | null;
    registration_no: string | null;
    currently_working: string | null;
    guardian_name: string | null;
  }>(
    `SELECT phone, whatsapp, alternate_phone, location, address_line, city_state,
            pin_code, date_of_birth::text AS date_of_birth, gender::text AS gender,
            program_label, highest_qualification, profession,
            medical_background::text AS medical_background, registration_no,
            currently_working::text AS currently_working, guardian_name
     FROM ${STUDENT_PROFILES_TABLE}
     WHERE user_id = $1`,
    [userId],
  );
  const profile = Array.isArray(profileRows) ? profileRows[0] ?? null : null;

  const [enrollmentRows] = await db.query<StudentEnrollmentSummary>(
    `SELECT e.id, e.course_id, e.status::text AS status, c.title AS course_title
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id AND c.deleted_at IS NULL
     WHERE e.user_id = $1
       AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')
     ORDER BY e.created_at DESC`,
    [userId],
  );

  return {
    ...user,
    phone: profile?.phone ?? null,
    whatsapp: profile?.whatsapp ?? null,
    alternate_phone: profile?.alternate_phone ?? null,
    location: profile?.location ?? null,
    address_line: profile?.address_line ?? null,
    city_state: profile?.city_state ?? null,
    pin_code: profile?.pin_code ?? null,
    date_of_birth: profile?.date_of_birth ?? null,
    gender: profile?.gender ?? null,
    program_label: profile?.program_label ?? null,
    highest_qualification: profile?.highest_qualification ?? null,
    profession: profile?.profession ?? null,
    medical_background: profile?.medical_background ?? null,
    registration_no: profile?.registration_no ?? null,
    currently_working: profile?.currently_working ?? null,
    guardian_name: profile?.guardian_name ?? null,
    enrollments: Array.isArray(enrollmentRows) ? enrollmentRows : [],
  };
}
