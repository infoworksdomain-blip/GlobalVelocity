import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: 'API & MCP documentation', description: 'Generate, approve, schedule and publish short-form content programmatically with the Velocity REST API, webhooks and remote MCP server.', path: '/developers' });

export default function Developers() {
  const base = process.env.APP_URL ?? "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-extrabold">API &amp; MCP</h1>
      <p className="mt-3 text-slate-600">Everything in the app is available programmatically. Create an API key under Settings → API (paid plans).</p>
      <h2 className="mt-10 text-2xl font-bold">REST API</h2>
      <p className="mt-2 text-slate-600">Base URL <code className="bg-slate-100 px-1 rounded">{base}/api/v1</code>. OpenAPI spec: <a className="underline" href="/api/v1/openapi">/api/v1/openapi</a>.</p>
      <pre className="mt-3 rounded-xl bg-slate-900 text-slate-100 p-4 text-xs overflow-x-auto">{`curl -X POST ${base}/api/v1/workspaces/WS_ID/generate \\
  -H "Authorization: Bearer sk_live_..." -H "content-type: application/json" \\
  -d '{"count": 10, "formats": ["ai_ugc","slideshow"]}'

# → {"batch_id":"...","status":"queued"}   then GET /api/v1/batches/BATCH_ID`}</pre>
      <h2 className="mt-10 text-2xl font-bold">MCP server</h2>
      <p className="mt-2 text-slate-600">Connect AI agents (Claude, Cursor, etc.) with the remote MCP endpoint and your API key.</p>
      <pre className="mt-3 rounded-xl bg-slate-900 text-slate-100 p-4 text-xs overflow-x-auto">{`{
  "mcpServers": { "velocity": { "url": "${base}/api/mcp", "headers": { "Authorization": "Bearer sk_live_..." } } }
}`}</pre>
      <p className="mt-2 text-sm text-slate-600">Tools: list_workspaces, get_company_profile, generate_content, get_batch, list_content, get_content, list_social_accounts, schedule_post, publish_now, list_scheduled_posts, get_analytics, list_trends, get_credits.</p>
      <h2 className="mt-10 text-2xl font-bold">Website tracking</h2>
      <pre className="mt-3 rounded-xl bg-slate-900 text-slate-100 p-4 text-xs overflow-x-auto">{`<script async src="${base}/t.js" data-site="vt_..."></script>
<script>velocity.track('signup'); velocity.track('purchase', { value: 49, currency: 'USD', order_id: '123' });</script>`}</pre>
      <h2 className="mt-10 text-2xl font-bold">Errors</h2>
      <p className="mt-2 text-sm text-slate-600">Errors are <code>{`{ error: { code, message } }`}</code>. <code>402</code> means a plan limit was hit and includes <code>upgrade_url</code>. Rate limits follow your plan (requests per minute).</p>
    </div>
  );
}
