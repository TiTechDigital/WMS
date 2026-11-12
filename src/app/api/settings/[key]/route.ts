import { route, parseBody, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { SETTING_KEYS, SettingBody } from "@/server/validation";
import { putSetting } from "@/server/services/master";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ key: string }> };
export const PUT = route<Ctx>(async (req, { params }) => {
  const { key } = await params;
  if (!(SETTING_KEYS as readonly string[]).includes(key)) throw new HttpError(404, "Unknown setting.");
  // Notification preferences are personal-ish and safe for any signed-in user to change.
  const user = await requireUser(key === "notificationPrefs" ? "data.read" : "settings.manage");
  const { value } = await parseBody(req, SettingBody);
  return putSetting(user, key, value as Prisma.InputJsonValue);
});
