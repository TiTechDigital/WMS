import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { TaskAssign } from "@/server/validation";
import { assignTask } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route<Ctx>(async (req, { params }) => assignTask(await requireUser("orders.manage"), (await params).id, (await parseBody(req, TaskAssign)).employeeId));
