import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  STUDENT_PROFILES_TABLE,
  TREATMENTS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";

export type StudentListItem = {
  id: string;
  email: string | null;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  phone: string | null;
  enrollment_count: number;
  active_enrollment_id: string | null;
  active_enrollment_title: string | null;
};

export type StudentProfile = {
  phone: string | null;
  whatsapp: string | null;
  alternate_phone: string | null;
  location: string | null;
  address_line: string | null;
  city_state: string | null;
  pin_code: string | null;
  date_of_birth: string | null;
  gender: string | null;
  membership_tier: string | null;
  program_label: string | null;
  highest_qualification: string | null;
  profession: string | null;
  medical_background: string | null;
  registration_no: string | null;
  currently_working: boolean | null;
  guardian_name: string | null;
  weekly_goal_hours: number | null;
};

export type StudentEnrollmentTreatment = {
  id: string;
  treatment_id: string;
  treatment_name: string;
  sort_order: number;
  hands_on_included: boolean;
  current_stage: string | null;
  unlocked_at: string | null;
  completed_at: string | null;
};

export type StudentEnrollment = {
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  status: string;
  origin: string;
  progress_pct: number | null;
  agreed_price: number | null;
  currency: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  treatments: StudentEnrollmentTreatment[];
};

export type StudentDetail = {
  id: string;
  email: string | null;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  profile: StudentProfile | null;
  enrollments: StudentEnrollment[];
  active_enrollments: StudentEnrollment[];
};

export async function listStudents(opts: {
  search?: string;
  page: number;
  limit: number;
  is_active?: boolean;
}) {
  const where: string[] = [
    `u.deleted_at IS NULL`,
    `u.role = 'student'`,
  ];
  const params: unknown[] = [];
  let i = 1;

  if (opts.is_active !== undefined) {
    where.push(`u.is_active = $${i++}`);
    params.push(opts.is_active);
  }
  if (opts.search?.trim()) {
    where.push(
      `(u.full_name ILIKE $${i} OR u.email ILIKE $${i} OR u.display_name ILIKE $${i} OR sp.phone ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${USERS_TABLE} u
     LEFT JOIN ${STUDENT_PROFILES_TABLE} sp ON sp.user_id = u.id
     ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query<StudentListItem>(
    `SELECT
       u.id,
       u.email,
       u.full_name,
       u.display_name,
       u.avatar_url,
       u.is_active,
       u.last_login_at::text,
       u.created_at::text,
       sp.phone,
       (
         SELECT COUNT(*)::int
         FROM ${ENROLLMENTS_TABLE} e
         WHERE e.user_id = u.id AND e.deleted_at IS NULL
       ) AS enrollment_count,
       (
         SELECT e.id
         FROM ${ENROLLMENTS_TABLE} e
         WHERE e.user_id = u.id
           AND e.deleted_at IS NULL
           AND e.status = 'active'
         ORDER BY e.started_at DESC NULLS LAST, e.created_at DESC
         LIMIT 1
       ) AS active_enrollment_id,
       (
         SELECT COALESCE(c.title, e.title)
         FROM ${ENROLLMENTS_TABLE} e
         LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
         WHERE e.user_id = u.id
           AND e.deleted_at IS NULL
           AND e.status = 'active'
         ORDER BY e.started_at DESC NULLS LAST, e.created_at DESC
         LIMIT 1
       ) AS active_enrollment_title
     FROM ${USERS_TABLE} u
     LEFT JOIN ${STUDENT_PROFILES_TABLE} sp ON sp.user_id = u.id
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  return {
    items: Array.isArray(rows) ? rows : [],
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}

async function loadEnrollmentTreatments(
  enrollmentId: string,
): Promise<StudentEnrollmentTreatment[]> {
  const [rows] = await db.query<StudentEnrollmentTreatment>(
    `SELECT
       et.id,
       et.treatment_id,
       t.name AS treatment_name,
       et.sort_order,
       et.hands_on_included,
       et.current_stage,
       et.unlocked_at::text,
       et.completed_at::text
     FROM ${ENROLLMENT_TREATMENTS_TABLE} et
     JOIN ${TREATMENTS_TABLE} t ON t.id = et.treatment_id
     WHERE et.enrollment_id = $1
     ORDER BY et.sort_order`,
    [enrollmentId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function getStudentDetail(
  id: string,
): Promise<StudentDetail | null> {
  const [userRows] = await db.query<{
    id: string;
    email: string | null;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, email, full_name, display_name, avatar_url, role, is_active,
            last_login_at::text, created_at::text, updated_at::text
     FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL AND role = 'student'
     LIMIT 1`,
    [id],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user) return null;

  const [profileRows] = await db.query<StudentProfile>(
    `SELECT
       phone,
       whatsapp,
       alternate_phone,
       location,
       address_line,
       city_state,
       pin_code,
       date_of_birth::text,
       gender::text,
       membership_tier::text,
       program_label,
       highest_qualification,
       profession,
       medical_background,
       registration_no,
       currently_working,
       guardian_name,
       weekly_goal_hours
     FROM ${STUDENT_PROFILES_TABLE}
     WHERE user_id = $1`,
    [id],
  );
  const profile = Array.isArray(profileRows) ? (profileRows[0] ?? null) : null;

  const [enrollmentRows] = await db.query<Omit<StudentEnrollment, "treatments">>(
    `SELECT
       e.id,
       e.title,
       e.course_id,
       c.title AS course_title,
       e.status::text AS status,
       e.origin::text AS origin,
       e.progress_pct,
       e.agreed_price,
       e.currency,
       e.started_at::text,
       e.completed_at::text,
       e.created_at::text
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
     WHERE e.user_id = $1 AND e.deleted_at IS NULL
     ORDER BY
       CASE e.status WHEN 'active' THEN 0 ELSE 1 END,
       e.created_at DESC`,
    [id],
  );

  const baseEnrollments = Array.isArray(enrollmentRows) ? enrollmentRows : [];
  const enrollments: StudentEnrollment[] = [];
  for (const e of baseEnrollments) {
    const treatments = await loadEnrollmentTreatments(e.id);
    enrollments.push({ ...e, treatments });
  }

  return {
    ...user,
    profile,
    enrollments,
    active_enrollments: enrollments.filter((e) => e.status === "active"),
  };
}
