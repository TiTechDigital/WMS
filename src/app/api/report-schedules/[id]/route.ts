import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { SchedulePatch } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireUser("reports.schedule");
  return db.reportSchedule.update({ where: { id: (await params).id }, data: await parseBody(req, SchedulePatch) });
});
export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireUser("reports.schedule");
  await db.reportSchedule.delete({ where: { id: (await params).id } });
  return { ok: true };
});
