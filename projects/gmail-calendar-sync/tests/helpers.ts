import { DateTime } from "luxon";
import type { RawWhen } from "../src/dates.js";
import { resolveTimezoneFrom } from "../src/timezones.js";

export const tz = (c: Array<string | null | undefined>, fb: string) => resolveTimezoneFrom(c, fb);

export const ref = (iso: string) => DateTime.fromISO(iso, { zone: "Asia/Tokyo" });

export function raw(p: Partial<RawWhen> & Pick<RawWhen, "kind" | "date_text">): RawWhen {
  return {
    start_time_text: "",
    end_date_text: "",
    end_time_text: "",
    timezone_text: "",
    end_timezone_text: "",
    location: "",
    end_location: "",
    all_day: false,
    ...p,
  };
}
