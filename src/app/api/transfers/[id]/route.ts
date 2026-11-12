import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { TransferStatus } from "@/server/validation";
import { setTransferStatus } from "@/server/services/operations";

type Ctx = { params: Promise<{ id: string }> };
export const PATCH = route<Ctx>(async (req, { params }) => setTransferStatus(await requireUser("tasks.execute"), (await params).id, (await parseBody(req, TransferStatus)).status));
