import { route, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { COLLECTIONS, loadCollections, type Collection } from "@/server/data";

export const dynamic = "force-dynamic";

/** GET /api/data?collections=orders,pickTasks — omit to load everything (initial app load). */
export const GET = route(async (req) => {
  const user = await requireUser();
  const param = new URL(req.url).searchParams.get("collections");
  const wanted = (param ? param.split(",") : [...COLLECTIONS]) as Collection[];
  const unknown = wanted.filter((c) => !(COLLECTIONS as readonly string[]).includes(c));
  if (unknown.length) throw new HttpError(400, `Unknown collections: ${unknown.join(", ")}`);
  return { user, data: await loadCollections(user, wanted) };
});
