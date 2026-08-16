import http from "node:http";

const port = Number(process.env.MOCK_OMISE_PORT || 4100);
const charges = new Map();
let sequence = 1;
let transferCalls = 0;

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function chargePayload(charge) {
  return {
    object: "charge",
    id: charge.id,
    livemode: false,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    source: {
      type: "promptpay",
      scannable_code: {
        image: { download_uri: `https://mock.omise.local/qr/${charge.id}.svg` },
      },
    },
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  if (request.method === "POST" && url.pathname === "/charges") {
    const params = new URLSearchParams(raw);
    const amount = Number(params.get("amount"));
    const currency = (params.get("currency") || "").toUpperCase();
    const sourceType = params.get("source[type]");
    if (!Number.isInteger(amount) || amount < 2000 || currency !== "THB" || sourceType !== "promptpay") {
      return send(response, 400, { object: "error", message: "invalid mock PromptPay charge" });
    }
    const id = `chrg_test_mock${String(sequence++).padStart(4, "0")}`;
    const charge = { id, amount, currency, status: "pending" };
    charges.set(id, charge);
    return send(response, 200, chargePayload(charge));
  }

  if (request.method === "GET" && url.pathname.startsWith("/charges/")) {
    const id = decodeURIComponent(url.pathname.slice("/charges/".length));
    const charge = charges.get(id);
    return charge ? send(response, 200, chargePayload(charge)) : send(response, 404, { object: "error", message: "not found" });
  }

  if (request.method === "POST" && url.pathname.startsWith("/__control/charges/")) {
    const id = decodeURIComponent(url.pathname.slice("/__control/charges/".length));
    const charge = charges.get(id);
    if (!charge) return send(response, 404, { error: "not found" });
    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch { return send(response, 400, { error: "invalid json" }); }
    if (typeof body.status === "string") charge.status = body.status;
    if (Number.isInteger(body.amount)) charge.amount = body.amount;
    if (typeof body.currency === "string") charge.currency = body.currency.toUpperCase();
    return send(response, 200, chargePayload(charge));
  }

  if (request.method === "GET" && url.pathname === "/__charges") {
    return send(response, 200, { charges: [...charges.values()].map(chargePayload), transferCalls });
  }

  if (request.method === "POST" && url.pathname === "/transfers") {
    transferCalls += 1;
    return send(response, 500, { object: "error", message: "live transfer should be disabled in CI" });
  }

  send(response, 404, { error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock Omise listening on ${port}`);
});
