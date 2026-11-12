import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { OrderCreate } from "@/server/validation";
import { createOrder } from "@/server/services/operations";

export const POST = route(async (req) => createOrder(await requireUser("orders.manage"), await parseBody(req, OrderCreate)));
