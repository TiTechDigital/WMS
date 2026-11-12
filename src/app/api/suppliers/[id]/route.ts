import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { SupplierSchema } from "@/server/validation";
import { saveSupplier } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const PUT = route<Ctx>(async (req, { params }) => saveSupplier(await requireUser("partners.manage"), (await params).id, await parseBody(req, SupplierSchema)));
