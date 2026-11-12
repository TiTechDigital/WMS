import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { UserCreate } from "@/server/validation";
import { createUser } from "@/server/services/master";

export const POST = route(async (req) => createUser(await requireUser("users.manage"), await parseBody(req, UserCreate)));
