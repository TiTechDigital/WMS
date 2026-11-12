import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "../auth/session";
import { ROLE_LABEL } from "@/lib/permissions";
import { HttpError } from "../http";

export type Tx = Prisma.TransactionClient;

/** Next document number, e.g. nextNumber(tx, "SO") → "SO-104562". Atomic under concurrency. */
export async function nextNumber(tx: Tx, name: string, prefix = name) {
  const seq = await tx.sequence.upsert({ where: { name }, create: { name, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${seq.value}`;
}

export interface LogInput {
  module: string;
  action: string;
  entity: string;
  details: string;
  severity?: "info" | "success" | "warning" | "critical";
  source?: "Web" | "RF Scanner" | "API" | "System";
}

/** Append-only audit trail: every state change records who, what, when. */
export async function logActivity(tx: Tx, user: CurrentUser, warehouseId: string, e: LogInput) {
  await tx.activityEvent.create({
    data: {
      warehouseId,
      actor: user.name,
      actorRole: ROLE_LABEL[user.role],
      module: e.module,
      action: e.action,
      entity: e.entity,
      details: e.details,
      severity: e.severity ?? "info",
      source: e.source ?? "Web",
    },
  });
}

export function notFound(what: string): never {
  throw new HttpError(404, `${what} not found.`);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}
