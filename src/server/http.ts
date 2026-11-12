import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from "zod";
import { Prisma } from "@prisma/client";

/** An error with an HTTP status and a message that is safe to show the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/**
 * Wraps a route handler: JSON responses, consistent error shape
 * `{ error: { message, details? } }`, validation and database errors mapped to 4xx.
 */
export function route<C = { params: Promise<Record<string, string>> }>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first ? `${first.path.join(".") || "Request"}: ${first.message}` : "Invalid request.";
    return NextResponse.json({ error: { message, details: err.issues } }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: { message: "A record with this value already exists." } }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: { message: "Record not found." } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { message: "Something went wrong on the server. Try again." } }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<ZodInfer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return schema.parse(json);
}
