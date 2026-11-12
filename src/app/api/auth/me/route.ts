import { route } from "@/server/http";
import { requireUser } from "@/server/auth/session";

export const GET = route(async () => ({ user: await requireUser() }));
