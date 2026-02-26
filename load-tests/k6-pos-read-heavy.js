import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const USERNAME = __ENV.USERNAME || "";
const PASSWORD = __ENV.PASSWORD || "";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
const VUS = Number(__ENV.VUS || "20");
const STAGE_UP = __ENV.STAGE_UP || "45s";
const STAGE_STEADY = __ENV.STAGE_STEADY || "90s";
const STAGE_DOWN = __ENV.STAGE_DOWN || "30s";
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || "0.5");

const resolvedVus = Number.isFinite(VUS) && VUS > 0 ? Math.trunc(VUS) : 20;
const resolvedThink = Number.isFinite(THINK_TIME_SECONDS) && THINK_TIME_SECONDS >= 0
  ? THINK_TIME_SECONDS
  : 0.5;

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    pos_read_heavy: {
      executor: "ramping-vus",
      startVUs: Math.max(1, Math.floor(resolvedVus / 4)),
      stages: [
        { duration: STAGE_UP, target: resolvedVus },
        { duration: STAGE_STEADY, target: resolvedVus },
        { duration: STAGE_DOWN, target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2000", "p(99)<3500"],
  },
};

function parseToken(payload) {
  if (!payload || typeof payload !== "object") return "";
  return String(
    payload?.token ||
      payload?.data?.token ||
      payload?.data?.accessToken ||
      ""
  );
}

let sessionReady = false;
let authToken = "";

function loginIfNeeded() {
  if (sessionReady) return;

  if (AUTH_TOKEN) {
    authToken = AUTH_TOKEN;
    sessionReady = true;
    return;
  }

  if (!USERNAME || !PASSWORD) {
    fail("Missing credentials: provide AUTH_TOKEN or USERNAME/PASSWORD");
  }

  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "15s",
    }
  );

  const ok = check(login, {
    "login status is 200": (res) => res.status === 200,
  });
  if (!ok) {
    fail(`Login failed with status ${login.status}`);
  }

  // Some environments return token in body, some rely on httpOnly cookie only.
  // Keep bearer when available, otherwise rely on cookie session set by login.
  authToken = parseToken(login.json());
  sessionReady = true;
}

export default function () {
  loginIfNeeded();
  const headers = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const responses = http.batch([
    ["GET", `${BASE_URL}/health`, null, { headers, timeout: "8s" }],
    [
      "GET",
      `${BASE_URL}/pos/orders?page=1&limit=20&status=Pending,WaitingForPayment&sortCreated=old`,
      null,
      { headers, timeout: "12s" },
    ],
    [
      "GET",
      `${BASE_URL}/pos/orders/summary?page=1&limit=20&status=Pending,WaitingForPayment`,
      null,
      { headers, timeout: "12s" },
    ],
    [
      "GET",
      `${BASE_URL}/pos/orders/stats?statuses=Pending,WaitingForPayment`,
      null,
      { headers, timeout: "10s" },
    ],
  ]);

  check(responses[0], { "health status 200": (res) => res.status === 200 });
  check(responses[1], { "orders status 200": (res) => res.status === 200 });
  check(responses[2], { "orders summary status 200": (res) => res.status === 200 });
  check(responses[3], { "orders stats status 200": (res) => res.status === 200 });

  sleep(resolvedThink);
}
