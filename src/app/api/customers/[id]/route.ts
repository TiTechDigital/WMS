import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { CustomerSchema } from "@/server/validation";
import { saveCustomer } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const PUT = route<Ctx>(async (req, { params }) => saveCustomer(await requireUser("partners.manage"), (await params).id, await parseBody(req, CustomerSchema)));
