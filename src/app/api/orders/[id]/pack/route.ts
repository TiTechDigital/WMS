import { route, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { setOrderStatus } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
/** Pack station: verified and labelled → Ready to ship. Allowed for floor operators. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser("tasks.execute");
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, select: { status: true } });
  if (!o) throw new HttpError(404, "Order not found.");
  if (o.status !== "packing") throw new HttpError(409, `${id} isn't at the pack station.`);
  return setOrderStatus(user, [id], "ready_to_ship");
});
