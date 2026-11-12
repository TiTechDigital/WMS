import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { ScheduleCreate } from "@/server/validation";

export const POST = route(async (req) => {
  await requireUser("reports.schedule");
  const b = await parseBody(req, ScheduleCreate);
  return db.reportSchedule.create({ data: { ...b, recipients: b.recipients.split(/[,;\s]+/).filter(Boolean).join(", ") } });
});
