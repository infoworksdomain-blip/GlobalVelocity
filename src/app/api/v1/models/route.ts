import { NextResponse } from "next/server";
import { db, schema } from "@/db";
export const GET = async () => NextResponse.json({ models: await db.select().from(schema.aiModels) });
