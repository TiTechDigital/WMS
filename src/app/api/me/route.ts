import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { ProfilePatch } from "@/server/validation";
import { updateProfile } from "@/server/services/master";

export const PATCH = route(async (req) => updateProfile(await requireUser(), await parseBody(req, ProfilePatch)));
