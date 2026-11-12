import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { WarehouseCreate } from "@/server/validation";
import { createWarehouse } from "@/server/services/master";

export const POST = route(async (req) => createWarehouse(await requireUser("settings.manage"), await parseBody(req, WarehouseCreate)));
