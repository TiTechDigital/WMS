import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { ProductSchema } from "@/server/validation";
import { saveProduct } from "@/server/services/master";

export const POST = route(async (req) => saveProduct(await requireUser("products.manage"), null, await parseBody(req, ProductSchema)));
