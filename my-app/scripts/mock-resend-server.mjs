import http from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.MOCK_RESEND_PORT || 4200);
const emails = [];

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);

  if (request.method === "GET" && url.pathname === "/__emails") {
    return json(response, 200, { emails });
  }
  if (request.method === "POST" && url.pathname === "/__reset") {
    emails.splice(0, emails.length);
    return json(response, 200, { ok: true });
  }
  if (request.method !== "POST" || url.pathname !== "/emails") {
    return json(response, 404, { name: "not_found", message: "not found" });
  }

  let raw = "";
  for await (const chunk of request) raw += chunk;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(response, 400, { name: "validation_error", message: "invalid json" });
  }

  if (request.headers.authorization !== "Bearer re_test_ci_only") {
    return json(response, 403, { name: "invalid_api_key", message: "invalid api key" });
  }
  if (!String(request.headers["user-agent"] || "").startsWith("borow-borow/")) {
    return json(response, 403, { name: "security_error", message: "missing user agent" });
  }
  const idempotencyKey = String(request.headers["idempotency-key"] || "");
  if (!idempotencyKey) {
    return json(response, 400, { name: "invalid_idempotency_key", message: "missing idempotency key" });
  }
  if (!body?.from || !Array.isArray(body?.to) || !body.to[0] || !body?.subject || !body?.html) {
    return json(response, 400, { name: "validation_error", message: "missing email fields" });
  }

  const existing = emails.find((email) => email.idempotencyKey === idempotencyKey);
  if (existing) return json(response, 200, { id: existing.id });

  const email = {
    id: randomUUID(),
    idempotencyKey,
    from: body.from,
    to: body.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    userAgent: request.headers["user-agent"],
  };
  emails.push(email);
  return json(response, 200, { id: email.id });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock Resend listening on ${port}`);
});
