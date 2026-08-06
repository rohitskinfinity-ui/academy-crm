export const COURSE_DELIVERY_MODES = [
  "observation",
  "theory",
  "demonstration",
  "training",
  "handson",
] as const;

export type CourseDeliveryMode = (typeof COURSE_DELIVERY_MODES)[number];

export const COURSE_DELIVERY_MODE_LABELS: Record<CourseDeliveryMode, string> = {
  observation: "Observation",
  theory: "Theory",
  demonstration: "Demonstration",
  training: "Training",
  handson: "HandsOn",
};

export type CourseDeliveryModeFlags = Record<CourseDeliveryMode, boolean>;

export function emptyDeliveryModeFlags(
  defaults?: Partial<CourseDeliveryModeFlags>,
): CourseDeliveryModeFlags {
  return {
    observation: false,
    theory: false,
    demonstration: false,
    training: false,
    handson: false,
    ...defaults,
  };
}

/** Map legacy delivery_modes values to the new set. */
export function normalizeDeliveryModes(
  modes: string[] | null | undefined,
  handsOnDefault?: boolean,
): CourseDeliveryMode[] {
  const legacyMap: Record<string, CourseDeliveryMode> = {
    lecture: "theory",
    practical: "demonstration",
    hands_on: "handson",
    observation: "observation",
    theory: "theory",
    demonstration: "demonstration",
    training: "training",
    handson: "handson",
  };

  const out: CourseDeliveryMode[] = [];
  for (const raw of modes ?? []) {
    const mapped = legacyMap[raw];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }

  if (out.length === 0) {
    return handsOnDefault ? ["handson"] : ["theory"];
  }
  return out;
}

export function modesToFlags(
  modes: CourseDeliveryMode[],
): CourseDeliveryModeFlags {
  return emptyDeliveryModeFlags(
    Object.fromEntries(modes.map((m) => [m, true])) as Partial<CourseDeliveryModeFlags>,
  );
}

export function flagsToModes(
  flags: CourseDeliveryModeFlags,
): CourseDeliveryMode[] {
  return COURSE_DELIVERY_MODES.filter((m) => flags[m]);
}

export function isHandsOnDelivery(modes: CourseDeliveryMode[]): boolean {
  return modes.includes("handson") || modes.includes("training");
}
