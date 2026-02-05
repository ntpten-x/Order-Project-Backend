import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const USERNAME = __ENV.USERNAME || "";
const PASSWORD = __ENV.PASSWORD || "";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export const options = {
  scenarios: {
    stock_orders_read: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "60s", target: 10 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

let sessionReady = false;
let csrfToken = "";
let authToken = "";

function loginIfNeeded() {
  if (sessionReady) return;
  if (AUTH_TOKEN) {
    authToken = AUTH_TOKEN;
    sessionReady = true;
    return;
  }
  if (!USERNAME || !PASSWORD) return;

  const csrfRes = http.get(`${BASE_URL}/csrf-token`);
  if (csrfRes.status === 200) {
    const body = csrfRes.json();
    csrfToken = body?.csrfToken || "";
  }

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(loginRes, {
    "login ok": (res) => res.status === 200,
  });

  if (loginRes.status === 200) {
    const body = loginRes.json();
    authToken = body?.data?.token || body?.token || "";
    sessionReady = true;
  }
}

export default function () {
  loginIfNeeded();

  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const responses = http.batch([
    ["GET", `${BASE_URL}/health`, null, { headers }],
    ["GET", `${BASE_URL}/stock/orders?status=pending&limit=20`, null, { headers }],
    ["GET", `${BASE_URL}/stock/orders?status=completed,cancelled&limit=20`, null, { headers }],
  ]);

  check(responses[0], { "health ok": (res) => res.status === 200 });
  check(responses[1], { "pending ok": (res) => res.status === 200 });
  check(responses[2], { "history ok": (res) => res.status === 200 });

  sleep(1);
}
