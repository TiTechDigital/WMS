import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { InboundCreate } from "@/server/validation";
import { createInbound } from "@/server/services/operations";

export const POST = route(async (req) => createInbound(await requireUser("inbound.plan"), await parseBody(req, InboundCreate)));
