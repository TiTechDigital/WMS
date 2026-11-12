import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { InboundLineUpdate } from "@/server/validation";
import { updateInboundLine } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => {
  const b = await parseBody(req, InboundLineUpdate);
  return updateInboundLine(await requireUser("tasks.execute"), (await params).id, b.sku, b.received, b.damaged);
});
