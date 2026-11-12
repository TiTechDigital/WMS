import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { UserPatch } from "@/server/validation";
import { updateUser } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => updateUser(await requireUser("users.manage"), (await params).id, await parseBody(req, UserPatch)));
