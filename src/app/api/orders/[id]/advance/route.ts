import { route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { advanceOrder } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route<Ctx>(async (_req, { params }) => advanceOrder(await requireUser("orders.manage"), (await params).id));
