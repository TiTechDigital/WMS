import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { AdjustmentReview } from "@/server/validation";
import { reviewAdjustments } from "@/server/services/operations";

export const POST = route(async (req) => {
  const b = await parseBody(req, AdjustmentReview);
  return reviewAdjustments(await requireUser("adjustments.approve"), b.ids, b.decision);
});
