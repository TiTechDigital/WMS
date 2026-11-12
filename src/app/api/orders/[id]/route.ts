import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { OrderPatch } from "@/server/validation";
import { setOrderPriority } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { priority } = await parseBody(req, OrderPatch);
  return setOrderPriority(await requireUser("orders.manage"), (await params).id, priority);
});
