import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { SupplierSchema } from "@/server/validation";
import { saveSupplier } from "@/server/services/master";

export const POST = route(async (req) => saveSupplier(await requireUser("partners.manage"), null, await parseBody(req, SupplierSchema)));
