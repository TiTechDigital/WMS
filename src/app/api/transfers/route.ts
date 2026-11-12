import { route, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { TransferCreate } from "@/server/validation";
import { createTransfer } from "@/server/services/operations";

export const POST = route(async (req) => createTransfer(await requireUser("transfers.request"), await parseBody(req, TransferCreate)));
