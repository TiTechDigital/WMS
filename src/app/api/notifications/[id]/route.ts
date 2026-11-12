import { route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { dismissNotification } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const DELETE = route<Ctx>(async (_req, { params }) => dismissNotification(await requireUser(), (await params).id));
