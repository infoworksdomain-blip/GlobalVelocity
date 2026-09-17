import { NextResponse } from "next/server";
/** OpenAPI 3.1 description of the public API (M19). Served at /api/v1/openapi and rendered at /developers. */
export function GET() {
  const B = (name: string) => ({ required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${name}` } } } });
  const R = (desc = "OK") => ({ 200: { description: desc }, 401: { description: "Unauthenticated" }, 402: { description: "Plan limit reached (upgrade_url in body)" } });
  const spec = {
    openapi: "3.1.0", info: { title: `${process.env.APP_NAME ?? "Velocity"} API`, version: "1.0.0", description: "Generate, approve, schedule and publish short-form content programmatically. Authenticate with `Authorization: Bearer sk_...` (create keys in Settings → API)." },
    servers: [{ url: `${process.env.APP_URL}/api/v1` }], security: [{ bearer: [] }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } }, schemas: {
      Generate: { type: "object", required: ["count"], properties: { count: { type: "integer", maximum: 100 }, formats: { type: "array", items: { type: "string", enum: ["ai_ugc", "human_ugc", "slideshow", "hook_demo", "meme", "remix", "wall_of_text", "green_screen"] } }, character_ids: { type: "array", items: { type: "string" } }, trend_ids: { type: "array", items: { type: "string" } }, language: { type: "string" } } },
      Schedule: { type: "object", required: ["content_item_id", "social_account_ids"], properties: { content_item_id: { type: "string" }, social_account_ids: { type: "array", items: { type: "string" } }, scheduled_at: { type: "string", format: "date-time" }, queue: { type: "boolean" }, platform_options: { type: "object" }, caption_override: { type: "string" } } },
      Swipe: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["keep", "skip", "undo"] }, schedule: { $ref: "#/components/schemas/Schedule" } } },
      ContentPatch: { type: "object", properties: { hook: { type: "string" }, script: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } },
    } },
    paths: {
      "/me": { get: { summary: "Current account, plan and usage", responses: R() } },
      "/workspaces": { get: { summary: "List workspaces", responses: R() }, post: { summary: "Create workspace", responses: R() } },
      "/workspaces/{id}/profile": { get: { summary: "Company profile", responses: R() }, post: { summary: "Analyse a website URL (async; returns job_id)", responses: R() }, put: { summary: "Replace profile (new version)", responses: R() } },
      "/jobs/{jobId}": { get: { summary: "Job status/progress", responses: R() } },
      "/workspaces/{id}/generate": { post: { summary: "Generate a content batch (async)", requestBody: B("Generate"), responses: R("batch_id") } },
      "/batches/{batchId}": { get: { summary: "Batch status and items", responses: R() } },
      "/workspaces/{id}/blitz": { get: { summary: "Next Blitz candidates", responses: R() } },
      "/content/{itemId}/swipe": { post: { summary: "Keep / skip / undo", requestBody: B("Swipe"), responses: R() } },
      "/workspaces/{id}/content": { get: { summary: "Content library (cursor paginated)", parameters: [{ name: "status", in: "query" }, { name: "format", in: "query" }, { name: "q", in: "query" }, { name: "cursor", in: "query" }], responses: R() } },
      "/content/{itemId}": { get: { summary: "Content detail (+ ?download=1 for a signed media URL)", responses: R() }, patch: { summary: "Edit copy", requestBody: B("ContentPatch"), responses: R() }, delete: { summary: "Archive", responses: R() } },
      "/content/{itemId}/similar": { post: { summary: "Generate similar variants", responses: R() } },
      "/workspaces/{id}/socials": { get: { summary: "Connected social accounts", responses: R() } },
      "/schedule": { post: { summary: "Schedule content", requestBody: B("Schedule"), responses: R() } },
      "/publish": { post: { summary: "Publish now", requestBody: B("Schedule"), responses: R() } },
      "/workspaces/{id}/calendar": { get: { summary: "Scheduled posts in range", parameters: [{ name: "from", in: "query" }, { name: "to", in: "query" }], responses: R() } },
      "/scheduled-posts/{postId}": { patch: { summary: "Reschedule / approve / retry", responses: R() }, delete: { summary: "Cancel", responses: R() } },
      "/workspaces/{id}/automations": { get: { summary: "List automations", responses: R() }, post: { summary: "Create automation", responses: R() } },
      "/automations/{autoId}/preview": { post: { summary: "Dry-run slot plan + quota impact", responses: R() } },
      "/automations/{autoId}/run": { post: { summary: "Run now", responses: R() } },
      "/workspaces/{id}/analytics": { get: { summary: "Analytics overview", parameters: [{ name: "from", in: "query" }, { name: "to", in: "query" }], responses: R() } },
      "/workspaces/{id}/tracking": { get: { summary: "Attribution report + snippet", responses: R() }, post: { summary: "Register a website for tracking", responses: R() } },
      "/trends": { get: { summary: "Browse trends (for_workspace=id ranks by brand fit)", responses: R() } },
      "/trends/{trendId}/remix": { post: { summary: "Remix a trend for a workspace", responses: R() } },
      "/characters": { get: { summary: "AI UGC characters", responses: R() } },
      "/credits": { get: { summary: "Credit balance and ledger", responses: R() }, post: { summary: "Estimate credit cost", responses: R() } },
      "/plans": { get: { summary: "Plans and entitlements (public)", security: [], responses: R() } },
    },
  };
  return NextResponse.json(spec);
}
