import process from "node:process";

const strict = process.argv.includes("--strict");
const failures = [];
const warnings = [];
const passes = [];

function value(name) {
  return process.env[name]?.trim() || "";
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  failures.push(message);
}

function requireValue(name, label = name) {
  if (!value(name)) {
    fail(`${label} is required`);
    return false;
  }
  pass(`${label} is configured`);
  return true;
}

function parseBoolean(name, fallback = false) {
  const raw = value(name).toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  fail(`${name} must be true or false`);
  return fallback;
}

function validateUrl(name, { https = false } = {}) {
  const raw = value(name);
  if (!raw) {
    fail(`${name} is required`);
    return null;
  }

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      fail(`${name} must use http:// or https://`);
      return null;
    }
    if (https && url.protocol !== "https:") {
      fail(`${name} must use https:// in production`);
      return null;
    }
    pass(`${name} is a valid${https ? " HTTPS" : ""} URL`);
    return url;
  } catch {
    fail(`${name} is not a valid URL`);
    return null;
  }
}

function validatePositiveInteger(name, min, max) {
  const raw = value(name);
  if (!raw) return;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`${name} must be an integer between ${min} and ${max}`);
    return;
  }
  pass(`${name} is within the supported range`);
}

const databaseUrl = value("DATABASE_URL");
if (!databaseUrl) {
  fail("DATABASE_URL is required");
} else if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  fail("DATABASE_URL must be a PostgreSQL connection string");
} else {
  pass("DATABASE_URL is configured for PostgreSQL");
}

const adminEmail = value("ADMIN_EMAIL").toLowerCase();
if (!adminEmail || !adminEmail.includes("@")) {
  fail("ADMIN_EMAIL must be a valid email address");
} else if (strict && adminEmail === "admin@example.com") {
  fail("ADMIN_EMAIL must not use the example address in production");
} else {
  pass("ADMIN_EMAIL is configured");
}

const adminPassword = value("ADMIN_PASSWORD");
if (adminPassword.length < 16) {
  fail("ADMIN_PASSWORD must be at least 16 characters");
} else if (/^(change-this-password|password|admin123)$/i.test(adminPassword)) {
  fail("ADMIN_PASSWORD is still an unsafe placeholder");
} else {
  pass("ADMIN_PASSWORD passes the minimum safety check");
}

const appUrl = validateUrl("APP_BASE_URL", { https: strict });
if (strict && appUrl && ["localhost", "127.0.0.1", "::1"].includes(appUrl.hostname)) {
  fail("APP_BASE_URL must not point to localhost in production");
}

requireValue("RESEND_API_KEY");
const emailFrom = value("EMAIL_FROM");
if (!emailFrom) {
  fail("EMAIL_FROM is required");
} else if (strict && /onboarding@resend\.dev/i.test(emailFrom)) {
  fail("EMAIL_FROM must use a verified production sending domain");
} else {
  pass("EMAIL_FROM is configured");
}

const emailVerificationRequired = parseBoolean("EMAIL_REQUIRE_VERIFICATION");
if (strict && !emailVerificationRequired) {
  fail("EMAIL_REQUIRE_VERIFICATION must be true before public production launch");
} else if (emailVerificationRequired) {
  pass("Email verification enforcement is enabled");
} else {
  warn("Email verification enforcement is disabled");
}

validatePositiveInteger("EMAIL_VERIFICATION_TTL_MINUTES", 5, 10_080);
validatePositiveInteger("PASSWORD_RESET_TTL_MINUTES", 5, 1_440);
validatePositiveInteger("AUTH_EMAIL_RESEND_COOLDOWN_SECONDS", 10, 3_600);
validatePositiveInteger("URGENT_RESERVATION_TTL_MINUTES", 1, 120);

const kycProvider = value("KYC_PROVIDER").toLowerCase() || "manual";
if (!["manual", "persona"].includes(kycProvider)) {
  fail("KYC_PROVIDER must be manual or persona");
} else if (kycProvider === "persona") {
  requireValue("PERSONA_API_KEY");
  requireValue("PERSONA_INQUIRY_TEMPLATE_ID");
  requireValue("PERSONA_WEBHOOK_SECRET");
  validateUrl("PERSONA_API_BASE_URL", { https: strict });
  pass("Persona KYC mode is selected");
} else {
  warn("KYC_PROVIDER=manual: production approval depends on admin review capacity");
}

const paymentProvider = value("PAYMENT_PROVIDER").toLowerCase() || "sandbox";
if (!["sandbox", "omise"].includes(paymentProvider)) {
  fail("PAYMENT_PROVIDER must be sandbox or omise");
} else if (paymentProvider === "omise") {
  requireValue("OMISE_SECRET_KEY");
  validateUrl("OMISE_API_BASE_URL", { https: strict });
  pass("Omise payment mode is selected");
} else if (strict) {
  fail("PAYMENT_PROVIDER must be omise for the real-payment MVP launch");
} else {
  warn("PAYMENT_PROVIDER=sandbox: no real customer payment will be collected");
}

if (strict && parseBoolean("SANDBOX_PAYMENT_ENABLED")) {
  fail("SANDBOX_PAYMENT_ENABLED must be false in production");
} else {
  pass("Sandbox payment bypass is disabled or not enabled");
}

if (parseBoolean("OMISE_ENABLE_LIVE_PAYOUTS")) {
  fail("OMISE_ENABLE_LIVE_PAYOUTS must remain false until lender payout operations are approved");
} else {
  pass("Automatic live payouts remain disabled");
}

validateUrl("OBJECT_STORAGE_ENDPOINT", { https: strict });
requireValue("OBJECT_STORAGE_ACCESS_KEY_ID");
requireValue("OBJECT_STORAGE_SECRET_ACCESS_KEY");
requireValue("OBJECT_STORAGE_BUCKET");

validatePositiveInteger("RESEND_REQUEST_TIMEOUT_MS", 1_000, 60_000);
validatePositiveInteger("PERSONA_REQUEST_TIMEOUT_MS", 1_000, 60_000);
validatePositiveInteger("OMISE_REQUEST_TIMEOUT_MS", 1_000, 60_000);
validatePositiveInteger("OBJECT_STORAGE_REQUEST_TIMEOUT_MS", 1_000, 120_000);

console.log(`\nBorow Borow production preflight${strict ? " (strict)" : ""}`);
for (const message of passes) console.log(`  PASS  ${message}`);
for (const message of warnings) console.log(`  WARN  ${message}`);
for (const message of failures) console.log(`  FAIL  ${message}`);
console.log(`\nSummary: ${passes.length} pass, ${warnings.length} warning, ${failures.length} fail.`);

if (failures.length > 0) process.exit(1);
