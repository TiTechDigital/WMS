import { route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { advanceInbound } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route<Ctx>(async (_req, { params }) => advanceInbound(await requireUser("tasks.execute"), (await params).id));
