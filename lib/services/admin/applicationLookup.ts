import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  LEADS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";

const APPLICATION_SELECT = `
  a.id,
  a.registration_id,
  a.lead_id,
  a.user_id,
  a.full_name,
  a.guardian_name,
  a.course_preference,
  a.course_id,
  a.workshop_id,
  a.application_kind,
  to_char(a.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
  a.gender::text AS gender,
  a.highest_qualification,
  a.profession,
  a.medical_background::text AS medical_background,
  a.registration_no,
  a.currently_working::text AS currently_working,
  a.whatsapp,
  a.alternate_no,
  a.email,
  a.address,
  a.city_state,
  a.pin_code,
  a.source,
  a.quoted_price,
  a.currency,
  a.photo_url,
  a.document_url,
  a.status::text AS status,
  a.created_at::text AS created_at,
  c.title AS course_title,
  w.title AS workshop_title
`;

export type RegistrationApplication = {
  id: string;
  registration_id: string | null;
  lead_id: string | null;
  user_id: string | null;
  full_name: string;
  guardian_name: string | null;
  course_preference: string | null;
  course_id: string | null;
  workshop_id: string | null;
  application_kind: string | null;
  date_of_birth: string | null;
  gender: string | null;
  highest_qualification: string | null;
  profession: string | null;
  medical_background: string | null;
  registration_no: string | null;
  currently_working: string | null;
  whatsapp: string | null;
  alternate_no: string | null;
  email: string;
  address: string | null;
  city_state: string | null;
  pin_code: string | null;
  source: string | null;
  quoted_price: number | string | null;
  currency: string | null;
  photo_url: string | null;
  document_url: string | null;
  status: string | null;
  created_at: string | null;
  course_title: string | null;
  workshop_title: string | null;
};

export async function getApplicationForEnrollment(
  enrollmentId: string,
  userId?: string | null,
): Promise<RegistrationApplication | null> {
  const [byLead] = await db.query<RegistrationApplication>(
    `SELECT ${APPLICATION_SELECT}
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     JOIN ${LEADS_TABLE} l ON l.id = a.lead_id
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
     WHERE l.enrollment_id = $1
     ORDER BY a.created_at DESC
     LIMIT 1`,
    [enrollmentId],
  );
  if (Array.isArray(byLead) && byLead[0]) return byLead[0];

  if (userId) {
    const [byUser] = await db.query<RegistrationApplication>(
      `SELECT ${APPLICATION_SELECT}
       FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
       LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
       LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [userId],
    );
    if (Array.isArray(byUser) && byUser[0]) return byUser[0];
  }

  return null;
}

export async function listApplicationsForUser(
  userId: string,
): Promise<RegistrationApplication[]> {
  const [rows] = await db.query<RegistrationApplication>(
    `SELECT ${APPLICATION_SELECT}
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId],
  );
  return Array.isArray(rows) ? rows : [];
}
