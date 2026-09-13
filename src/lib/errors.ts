import { NextResponse } from "next/server";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}
export const err = (status: number, code: string, message: string, extra?: Record<string, unknown>) => new AppError(status, code, message, extra);
export function toResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, ...(e.extra ?? {}) } }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Unexpected error" } }, { status: 500 });
}
export function planLimit(code: string, message: string) {
  return new AppError(402, code, message, { upgrade_url: "/app/settings/billing" });
}
