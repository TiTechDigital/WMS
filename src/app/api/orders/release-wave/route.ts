import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { WaveRelease } from "@/server/validation";
import { releaseWave } from "@/server/services/operations";

export const POST = route(async (req) => releaseWave(await requireUser("orders.manage"), (await parseBody(req, WaveRelease)).warehouseId));
