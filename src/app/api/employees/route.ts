import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { EmployeeCreate } from "@/server/validation";
import { createEmployee } from "@/server/services/master";

export const POST = route(async (req) => createEmployee(await requireUser("employees.manage"), await parseBody(req, EmployeeCreate)));
