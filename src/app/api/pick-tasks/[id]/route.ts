import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { TaskStatus } from "@/server/validation";
import { setTaskStatus } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => setTaskStatus(await requireUser("tasks.execute"), (await params).id, (await parseBody(req, TaskStatus)).status));
