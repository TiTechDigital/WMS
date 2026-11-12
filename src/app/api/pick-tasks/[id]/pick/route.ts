import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { TaskPick } from "@/server/validation";
import { confirmPick } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route<Ctx>(async (req, { params }) => {
  const b = await parseBody(req, TaskPick);
  return confirmPick(await requireUser("tasks.execute"), (await params).id, b.lineIndex, b.picked);
});
