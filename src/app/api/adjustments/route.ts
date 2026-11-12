import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { AdjustmentCreate } from "@/server/validation";
import { createAdjustment } from "@/server/services/operations";

export const POST = route(async (req) => createAdjustment(await requireUser("adjustments.request"), await parseBody(req, AdjustmentCreate)));
