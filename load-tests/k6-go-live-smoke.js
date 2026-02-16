import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const VUS = Number(__ENV.VUS || "2");
const DURATION = __ENV.DURATION || "20s";
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || "0.5");

const resolvedVus = Number.isFinite(VUS) && VUS > 0 ? Math.trunc(VUS) : 2;
const resolvedThinkTime = Number.isFinite(THINK_TIME_SECONDS) && THINK_TIME_SECONDS >= 0 ? THINK_TIME_SECONDS : 0.5;

export const options = {
  scenarios: {
    health_smoke: {
      executor: "constant-vus",
      vus: resolvedVus,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "max<5000"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`, {
    timeout: "5s",
  });

  check(health, {
    "health status 200": (res) => res.status === 200,
    "health has body": (res) => !!res.body && res.body.length > 0,
  });

  sleep(resolvedThinkTime);
}
