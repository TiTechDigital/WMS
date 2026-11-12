import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { ProductSchema } from "@/server/validation";
import { saveProduct } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const PUT = route<Ctx>(async (req, { params }) => saveProduct(await requireUser("products.manage"), (await params).id, await parseBody(req, ProductSchema)));
