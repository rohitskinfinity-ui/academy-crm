"use client";

import type { ReactNode } from "react";

export type RegistrationApplicationView = {
  registration_id?: string | null;
  full_name?: string | null;
  guardian_name?: string | null;
  course_preference?: string | null;
  course_title?: string | null;
  workshop_title?: string | null;
  application_kind?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  highest_qualification?: string | null;
  profession?: string | null;
  medical_background?: string | null;
  registration_no?: string | null;
  currently_working?: string | null;
  whatsapp?: string | null;
  alternate_no?: string | null;
  email?: string | null;
  address?: string | null;
  city_state?: string | null;
  pin_code?: string | null;
  source?: string | null;
  quoted_price?: number | string | null;
  currency?: string | null;
  photo_url?: string | null;
  document_url?: string | null;
  status?: string | null;
};

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function titleCase(value: string | null | undefined) {
  if (!value) return null;
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
        {title}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function RegistrationApplicationPanel({
  application,
  title = "Registration form",
}: {
  application: RegistrationApplicationView;
  title?: string;
}) {
  const program =
    application.workshop_title ||
    application.course_title ||
    application.course_preference;

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        {application.registration_id ? (
          <span className="font-mono text-xs text-muted-foreground">
            {application.registration_id}
          </span>
        ) : null}
      </div>

      <Section title="Personal details">
        <Field label="Full name" value={application.full_name} />
        <Field
          label="Father's / Husband's name"
          value={application.guardian_name}
        />
        <Field
          label={
            application.application_kind === "workshop" ? "Workshop" : "Course"
          }
          value={program}
        />
        <Field
          label="Date of birth"
          value={
            application.date_of_birth
              ? formatShortDate(String(application.date_of_birth))
              : null
          }
        />
        <Field label="Gender" value={titleCase(application.gender)} />
        <Field
          label="Photo"
          value={
            application.photo_url ? (
              <div className="space-y-2">
                <img
                  src={application.photo_url}
                  alt="Applicant photo"
                  className="h-24 w-24 rounded-lg border object-cover"
                />
                <a
                  href={application.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-teal-700 hover:underline"
                >
                  Open full size
                </a>
              </div>
            ) : (
              "—"
            )
          }
        />
      </Section>

      <Section title="Education & profession">
        <Field
          label="Highest qualification"
          value={application.highest_qualification}
        />
        <Field label="Profession" value={application.profession} />
        <Field
          label="Qualification document"
          value={
            application.document_url ? (
              <a
                href={application.document_url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 hover:underline"
              >
                View document
              </a>
            ) : (
              "—"
            )
          }
        />
      </Section>

      <Section title="Medical / declaration">
        <Field
          label="Medical background"
          value={titleCase(application.medical_background)}
        />
        <Field label="Registration no" value={application.registration_no} />
        <Field
          label="Currently working"
          value={titleCase(application.currently_working)}
        />
      </Section>

      <Section title="Contact details">
        <Field label="WhatsApp" value={application.whatsapp} />
        <Field label="Alternate no" value={application.alternate_no} />
        <Field label="Email" value={application.email} />
        <Field label="Address" value={application.address} />
        <Field label="City / State" value={application.city_state} />
        <Field label="PIN code" value={application.pin_code} />
      </Section>

      <Section title="Other">
        <Field label="How did you find us?" value={application.source} />
        <Field
          label="Quoted fee"
          value={
            application.quoted_price != null
              ? `${application.currency || "INR"} ${application.quoted_price}`
              : null
          }
        />
        <Field label="Application status" value={titleCase(application.status)} />
      </Section>
    </div>
  );
}
