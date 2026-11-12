import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { NotificationsRead } from "@/server/validation";
import { markNotifications } from "@/server/services/master";

export const PATCH = route(async (req) => markNotifications(await requireUser(), (await parseBody(req, NotificationsRead)).ids));
