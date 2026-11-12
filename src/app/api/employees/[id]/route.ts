import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { EmployeeStatus } from "@/server/validation";
import { setEmployeeStatus } from "@/server/services/master";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { status } = await parseBody(req, EmployeeStatus);
  return setEmployeeStatus(await requireUser("employees.manage"), (await params).id, status);
});
