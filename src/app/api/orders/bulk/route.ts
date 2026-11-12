import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { OrderBulk } from "@/server/validation";
import { advanceOrders, setOrderStatus } from "@/server/services/operations";

export const POST = route(async (req) => {
  const user = await requireUser("orders.manage");
  const body = await parseBody(req, OrderBulk);
  return body.action === "advance" ? advanceOrders(user, body.ids) : setOrderStatus(user, body.ids, body.status);
});
