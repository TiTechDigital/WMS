import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { CustomerSchema } from "@/server/validation";
import { saveCustomer } from "@/server/services/master";

export const POST = route(async (req) => saveCustomer(await requireUser("partners.manage"), null, await parseBody(req, CustomerSchema)));
