import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { ActivityCreate } from "@/server/validation";
import { logClientEvent } from "@/server/services/master";

/** Records UI-originated events (label printed, count scheduled, report generated…). */
export const POST = route(async (req) => {
  const { warehouseId, ...e } = await parseBody(req, ActivityCreate);
  return logClientEvent(await requireUser(), warehouseId, e);
});
