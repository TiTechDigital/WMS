import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { LocationCreate, LocationDeleteBody, LocationStatusBody } from "@/server/validation";
import { createLocations, deleteLocations, setLocationStatus } from "@/server/services/master";

/** Bulk-create a zone's positions. */
export const POST = route(async (req) => createLocations(await requireUser("locations.manage"), await parseBody(req, LocationCreate)));
/** Change status of one or more locations. */
export const PATCH = route(async (req) => {
  const { ids, status } = await parseBody(req, LocationStatusBody);
  return setLocationStatus(await requireUser("locations.status"), ids, status);
});
/** Delete empty locations (locations holding stock are skipped and reported). */
export const DELETE = route(async (req) => {
  const { ids } = await parseBody(req, LocationDeleteBody);
  return deleteLocations(await requireUser("locations.manage"), ids);
});
