import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  BATCHES_TABLE,
  CALENDAR_EVENTS_TABLE,
  CAMPUSES_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  TREATMENTS_TABLE,
} from "@/lib/db/schema";
import { clampLiveClassDuration } from "@/lib/liveClassDuration";

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseByDay(rule: string): number | null {
  const match = rule.match(/BYDAY=([A-Z]{2})/);
  if (!match) return null;
  return DAY_MAP[match[1]] ?? null;
}

function nextOccurrence(from: Date, weekday: number): Date {
  const d = new Date(from);
  const diff = (weekday + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(from.getHours(), from.getMinutes(), 0, 0);
  return d;
}

export type WeeklySeriesInput = {
  course_id: string;
  batch_id?: string | null;
  title: string;
  description?: string | null;
  platform: "zoom" | "google_meet";
  meeting_url: string;
  instructor_name: string;
  starts_at: string;
  duration_minutes: number;
  recurrence_rule: string;
  recurrence_until: string;
  treatment_ids: string[];
};

export type HandsOnDayInput = {
  course_id: string;
  batch_id?: string | null;
  campus_id?: string | null;
  title: string;
  description?: string | null;
  starts_at: string;
  duration_hours?: number;
  treatment_id: string;
  venue?: string | null;
};

export async function listCourseSchedule(courseId: string, batchId?: string) {
  const where = ["ce.deleted_at IS NULL", "ce.course_id = $1"];
  const params: unknown[] = [courseId];
  if (batchId) {
    where.push(`ce.batch_id = $${params.length + 1}`);
    params.push(batchId);
  }

  const [rows] = await db.query(
    `SELECT ce.*, t.name AS treatment_name, b.name AS batch_name, cp.name AS campus_name
     FROM ${CALENDAR_EVENTS_TABLE} ce
     LEFT JOIN ${TREATMENTS_TABLE} t ON t.id = ce.treatment_id
     LEFT JOIN ${BATCHES_TABLE} b ON b.id = ce.batch_id
     LEFT JOIN ${CAMPUSES_TABLE} cp ON cp.id = ce.campus_id
     WHERE ${where.join(" AND ")}
     ORDER BY ce.starts_at ASC`,
    params,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createWeeklyLiveSeries(input: WeeklySeriesInput) {
  const seriesId = randomUUID();
  const start = new Date(input.starts_at);
  const until = new Date(input.recurrence_until);
  const weekday = parseByDay(input.recurrence_rule);
  if (weekday === null) {
    throw Object.assign(new Error("recurrence_rule must include BYDAY=MO,TU,..."), {
      status: 400,
    });
  }

  const treatmentIds =
    input.treatment_ids.length > 0 ? input.treatment_ids : [null];
  const durationMinutes = clampLiveClassDuration(input.duration_minutes);
  const created: string[] = [];
  let cursor = new Date(start);
  let moduleIndex = 0;

  while (cursor <= until) {
    const occurrenceStart =
      created.length === 0
        ? start
        : (() => {
            const d = new Date(cursor);
            d.setDate(d.getDate() + 7);
            return d;
          })();
    if (occurrenceStart > until) break;

    const endsAt = new Date(
      occurrenceStart.getTime() + durationMinutes * 60 * 1000,
    );
    const treatmentId = treatmentIds[moduleIndex % treatmentIds.length];

    const [tRow] = await db.query<{ name: string }>(
      `SELECT name FROM ${TREATMENTS_TABLE} WHERE id = $1`,
      [treatmentId],
    );
    const treatmentName = Array.isArray(tRow) ? tRow[0]?.name : undefined;

    const title = treatmentName
      ? `${input.title} — ${treatmentName}`
      : input.title;

    const [rows] = await db.query<{ id: string }>(
      `INSERT INTO ${CALENDAR_EVENTS_TABLE} (
         type, title, description, platform, meeting_url, starts_at, ends_at,
         duration_label, status, course_id, batch_id, treatment_id,
         category_label, recurrence_rule, recurrence_until, series_id, is_published
       ) VALUES (
         'live_class', $1, $2, $3, $4, $5, $6, $7, 'scheduled',
         $8, $9, $10, $11, $12, $13, $14, true
       ) RETURNING id`,
      [
        title,
        input.description ?? null,
        input.platform,
        input.meeting_url,
        occurrenceStart.toISOString(),
        endsAt.toISOString(),
        `${durationMinutes} mins`,
        input.course_id,
        input.batch_id ?? null,
        treatmentId,
        input.instructor_name,
        input.recurrence_rule,
        until.toISOString(),
        seriesId,
      ],
    );
    const id = Array.isArray(rows) ? rows[0]?.id : undefined;
    if (id) created.push(id);

    moduleIndex++;
    cursor = new Date(occurrenceStart);
    cursor.setDate(cursor.getDate() + 7);
  }

  return { series_id: seriesId, event_ids: created, count: created.length };
}

export async function createHandsOnDays(
  days: HandsOnDayInput[],
): Promise<{ event_ids: string[] }> {
  const eventIds: string[] = [];

  for (const day of days) {
    const durationHours = day.duration_hours ?? 8;
    const startsAt = new Date(day.starts_at);
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

    const [rows] = await db.query<{ id: string }>(
      `INSERT INTO ${CALENDAR_EVENTS_TABLE} (
         type, title, description, starts_at, ends_at, duration_label, status,
         course_id, batch_id, campus_id, treatment_id, category_label, venue, is_published
       ) VALUES (
         'workshop', $1, $2, $3, $4, $5, 'scheduled',
         $6, $7, $8, $9, 'Hands-on Day', $10, true
       ) RETURNING id`,
      [
        day.title,
        day.description ?? null,
        startsAt.toISOString(),
        endsAt.toISOString(),
        `${durationHours} hours`,
        day.course_id,
        day.batch_id ?? null,
        day.campus_id ?? null,
        day.treatment_id,
        day.venue ?? null,
      ],
    );
    const id = Array.isArray(rows) ? rows[0]?.id : undefined;
    if (id) eventIds.push(id);
  }

  return { event_ids: eventIds };
}

export type ManualHandsOnInput = {
  course_id: string;
  treatment_id: string;
  batch_id?: string | null;
  campus_id?: string | null;
  title?: string | null;
  description?: string | null;
  starts_at: string;
  duration_hours?: number;
  venue?: string | null;
};

export async function createManualHandsOnDay(input: ManualHandsOnInput) {
  const durationHours = input.duration_hours ?? 8;
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

  const [tRow] = await db.query<{ name: string }>(
    `SELECT name FROM ${TREATMENTS_TABLE} WHERE id = $1`,
    [input.treatment_id],
  );
  const treatmentName = Array.isArray(tRow) ? tRow[0]?.name : undefined;
  const title =
    input.title?.trim() ||
    (treatmentName
      ? `Hands-on Day — ${treatmentName}`
      : "Hands-on Campus Day");

  const [rows] = await db.query(
    `INSERT INTO ${CALENDAR_EVENTS_TABLE} (
       type, title, description, starts_at, ends_at, duration_label, status,
       course_id, batch_id, campus_id, treatment_id, category_label, venue, is_published
     ) VALUES (
       'workshop', $1, $2, $3, $4, $5, 'scheduled',
       $6, $7, $8, $9, 'Hands-on Day', $10, true
     ) RETURNING *`,
    [
      title,
      input.description ??
        "Campus hands-on training at Skinfinity Academy of Cosmetology.",
      startsAt.toISOString(),
      endsAt.toISOString(),
      `${durationHours} hours`,
      input.course_id,
      input.batch_id ?? null,
      input.campus_id ?? null,
      input.treatment_id,
      input.venue ?? "Skinfinity Academy of Cosmetology",
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function generatePGDCCHandsOnSchedule(input: {
  course_id: string;
  batch_id?: string | null;
  campus_id?: string | null;
  start_date: string;
  treatment_ids: string[];
  day_interval?: number;
}) {
  const interval = input.day_interval ?? 7;
  const start = new Date(input.start_date);
  const days: HandsOnDayInput[] = [];

  for (let i = 0; i < 9; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * interval);
    const treatmentId =
      input.treatment_ids[i % input.treatment_ids.length] ??
      input.treatment_ids[0];
    days.push({
      course_id: input.course_id,
      batch_id: input.batch_id,
      campus_id: input.campus_id,
      title: `PGDCC Hands-on Day ${i + 1}`,
      description: "Intensive campus hands-on training at Skinfinity Academy.",
      starts_at: d.toISOString(),
      duration_hours: 8,
      treatment_id: treatmentId,
      venue: "Skinfinity Academy of Cosmetology",
    });
  }

  return createHandsOnDays(days);
}

export async function getCourseTreatmentsForSchedule(courseId: string) {
  const [rows] = await db.query(
    `SELECT ct.treatment_id, ct.sort_order, ct.hands_on_default,
            ct.live_sessions_planned, ct.delivery_modes, t.name, t.slug
     FROM ${COURSE_TREATMENTS_TABLE} ct
     JOIN ${TREATMENTS_TABLE} t ON t.id = ct.treatment_id
     WHERE ct.course_id = $1
     ORDER BY ct.sort_order`,
    [courseId],
  );
  return Array.isArray(rows) ? rows : [];
}

export type ModuleScheduleRow = {
  treatment_id: string;
  treatment_name: string;
  treatment_slug: string;
  sort_order: number;
  hands_on_default: boolean;
  live_sessions_planned: number;
  scheduled_live_count: number;
  remaining: number;
};

export async function getModuleScheduleBoard(
  courseId: string,
  batchId?: string,
): Promise<ModuleScheduleRow[]> {
  const modules = await getCourseTreatmentsForSchedule(courseId);
  const result: ModuleScheduleRow[] = [];

  for (const mod of modules) {
    const m = mod as {
      treatment_id: string;
      name: string;
      slug: string;
      sort_order: number;
      hands_on_default: boolean;
      live_sessions_planned: number;
    };

    const countParams: unknown[] = [courseId, m.treatment_id];
    let batchClause = "";
    if (batchId) {
      batchClause = ` AND (batch_id = $3 OR batch_id IS NULL)`;
      countParams.push(batchId);
    }

    const [countRows] = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${CALENDAR_EVENTS_TABLE}
       WHERE course_id = $1 AND treatment_id = $2
         AND type = 'live_class' AND deleted_at IS NULL${batchClause}`,
      countParams,
    );
    const scheduled = parseInt(
      Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
      10,
    );
    const planned = Number(m.live_sessions_planned ?? 1);

    result.push({
      treatment_id: m.treatment_id,
      treatment_name: m.name,
      treatment_slug: m.slug,
      sort_order: m.sort_order,
      hands_on_default: m.hands_on_default,
      live_sessions_planned: planned,
      scheduled_live_count: scheduled,
      remaining: Math.max(0, planned - scheduled),
    });
  }

  return result;
}

export type ManualLiveInput = {
  course_id: string;
  treatment_id: string;
  batch_id?: string | null;
  title?: string | null;
  description?: string | null;
  platform?: "zoom" | "google_meet";
  meeting_url: string;
  host_start_url?: string | null;
  meeting_id?: string | null;
  passcode?: string | null;
  instructor_name?: string;
  starts_at: string;
  duration_minutes?: number;
};

export async function createManualLiveClass(input: ManualLiveInput) {
  const duration = clampLiveClassDuration(input.duration_minutes);
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

  const [tRow] = await db.query<{ name: string }>(
    `SELECT name FROM ${TREATMENTS_TABLE} WHERE id = $1`,
    [input.treatment_id],
  );
  const treatmentName = Array.isArray(tRow) ? tRow[0]?.name : undefined;
  const title =
    input.title?.trim() ||
    (treatmentName ? `Live Lecture — ${treatmentName}` : "Live Lecture");

  const [rows] = await db.query(
    `INSERT INTO ${CALENDAR_EVENTS_TABLE} (
       type, title, description, platform, meeting_url, host_start_url,
       meeting_id, passcode, starts_at, ends_at,
       duration_label, status, course_id, batch_id, treatment_id,
       category_label, is_published
     ) VALUES (
       'live_class', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled',
       $11, $12, $13, $14, true
     ) RETURNING *`,
    [
      title,
      input.description ?? null,
      input.platform ?? "zoom",
      input.meeting_url,
      input.host_start_url ?? null,
      input.meeting_id ?? null,
      input.passcode ?? null,
      startsAt.toISOString(),
      endsAt.toISOString(),
      `${duration} mins`,
      input.course_id,
      input.batch_id ?? null,
      input.treatment_id,
      input.instructor_name ?? "Senior Faculty Doctor",
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export type FillRemainingInput = {
  course_id: string;
  batch_id?: string | null;
  treatment_ids: string[];
  starts_at: string;
  gap_days?: number;
  duration_minutes?: number;
  meeting_url: string;
  platform?: "zoom" | "google_meet";
  instructor_name?: string;
};

export async function fillRemainingLiveSessions(input: FillRemainingInput) {
  const board = await getModuleScheduleBoard(
    input.course_id,
    input.batch_id ?? undefined,
  );
  const gap = Math.max(1, input.gap_days ?? 7);
  const duration = clampLiveClassDuration(input.duration_minutes);
  let cursor = new Date(input.starts_at);
  const eventIds: string[] = [];

  for (const treatmentId of input.treatment_ids) {
    const mod = board.find((m) => m.treatment_id === treatmentId);
    if (!mod || mod.remaining <= 0) continue;

    for (let i = 0; i < mod.remaining; i++) {
      const created = await createManualLiveClass({
        course_id: input.course_id,
        treatment_id: treatmentId,
        batch_id: input.batch_id,
        meeting_url: input.meeting_url,
        platform: input.platform,
        instructor_name: input.instructor_name,
        starts_at: cursor.toISOString(),
        duration_minutes: duration,
        title: `Live Lecture — ${mod.treatment_name} (${mod.scheduled_live_count + i + 1})`,
      });
      if (created && typeof created === "object" && "id" in created) {
        eventIds.push(String((created as { id: string }).id));
      }
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + gap);
    }
  }

  return { event_ids: eventIds, count: eventIds.length };
}

export async function softDeleteScheduleEvent(
  courseId: string,
  eventId: string,
) {
  const [rows] = await db.query(
    `UPDATE ${CALENDAR_EVENTS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [eventId, courseId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getCourseBatches(courseId: string) {
  const [rows] = await db.query(
    `SELECT b.*, c.name AS campus_name
     FROM ${BATCHES_TABLE} b
     LEFT JOIN ${CAMPUSES_TABLE} c ON c.id = b.campus_id
     WHERE b.course_id = $1
     ORDER BY b.starts_on NULLS LAST`,
    [courseId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function getCourseProgrammeMeta(courseId: string) {
  const [rows] = await db.query<{ programme_meta: Record<string, unknown> }>(
    `SELECT programme_meta FROM ${COURSES_TABLE} WHERE id = $1`,
    [courseId],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.programme_meta ?? {};
}
