import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    health_smoke: {
      executor: "constant-vus",
      vus: 2,
      duration: "20s",
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

  sleep(0.5);
}
