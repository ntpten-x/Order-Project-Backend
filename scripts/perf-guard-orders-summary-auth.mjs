import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const REQUESTS = Number(process.env.PERF_SUMMARY_REQUESTS || 50);
const CONCURRENCY = Number(process.env.PERF_SUMMARY_CONCURRENCY || 5);
const WARMUP_REQUESTS = Number(process.env.PERF_SUMMARY_WARMUP_REQUESTS || 10);
const P95_MAX_MS = Number(process.env.PERF_SUMMARY_P95_MS || 800);
const TTFB_P95_MAX_MS = Number(process.env.PERF_SUMMARY_TTFB_P95_MS || 500);
const MAX_ERROR_RATE = Number(process.env.PERF_SUMMARY_MAX_ERROR_RATE || 0.02);
const ENDPOINT = process.env.PERF_SUMMARY_ENDPOINT || "/pos/orders/summary?page=1&limit=50";
const STARTUP_TIMEOUT_MS = Number(process.env.PERF_SUMMARY_STARTUP_TIMEOUT_MS || 60000);
const LOGIN_PATH = process.env.PERF_SUMMARY_LOGIN_PATH || "/auth/login";
const LOGIN_USERNAME = process.env.E2E_USERNAME || "e2e_pos_admin";
const LOGIN_PASSWORD = process.env.E2E_PASSWORD || "E2E_Pos_123!";
const ENSURE_USER_SCRIPT = process.env.PERF_SUMMARY_ENSURE_USER_SCRIPT || "scripts/ensure-e2e-user.js";

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Unable to allocate dynamic port")));
        return;
      }
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(addr.port);
      });
    });
  });
}

function killProcessTree(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        shell: false,
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 3000);
  });
}

function waitForHealth(baseUrl, timeoutMs) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`${baseUrl}/health`, { timeout: 3000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });

      req.on("timeout", () => {
        req.destroy();
        retry();
      });
      req.on("error", retry);
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Backend did not become healthy within ${timeoutMs}ms`));
        return;
      }
      setTimeout(probe, 800);
    };

    probe();
  });
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if ((code ?? 1) === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

function extractCookieHeader(setCookieHeaders) {
  const entries = Array.isArray(setCookieHeaders) ? setCookieHeaders : [];
  if (!entries.length) return "";
  return entries
    .map((entry) => String(entry).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function loginAndGetCookie(baseUrl) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      username: LOGIN_USERNAME,
      password: LOGIN_PASSWORD,
    });

    const req = http.request(
      `${baseUrl}${LOGIN_PATH}`,
      {
        method: "POST",
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
            reject(new Error(`Login failed status=${res.statusCode} body=${body}`));
            return;
          }

          const cookieHeader = extractCookieHeader(res.headers["set-cookie"]);
          if (!cookieHeader.includes("token=")) {
            reject(new Error("Login succeeded but token cookie was not set"));
            return;
          }

          resolve(cookieHeader);
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("login timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function requestTiming(baseUrl, endpoint, cookieHeader) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let ttfb = null;
    let statusCode = 0;

    const req = http.get(
      `${baseUrl}${endpoint}`,
      {
        timeout: 5000,
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
      (res) => {
        statusCode = res.statusCode || 0;
        const now = process.hrtime.bigint();
        ttfb = Number(now - start) / 1_000_000;
        res.on("data", () => {});
        res.on("end", () => {
          const end = process.hrtime.bigint();
          const total = Number(end - start) / 1_000_000;
          resolve({
            ok: statusCode >= 200 && statusCode < 400,
            statusCode,
            ttfbMs: ttfb ?? total,
            totalMs: total,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", () => {
      const end = process.hrtime.bigint();
      const total = Number(end - start) / 1_000_000;
      resolve({
        ok: false,
        statusCode: 0,
        ttfbMs: total,
        totalMs: total,
      });
    });
  });
}

async function runLoad(baseUrl, cookieHeader) {
  const total = REQUESTS;
  const running = new Set();
  const results = [];
  let nextIndex = 0;

  const launch = async () => {
    if (nextIndex >= total) return;
    nextIndex += 1;
    const p = requestTiming(baseUrl, ENDPOINT, cookieHeader).then((res) => {
      results.push(res);
      running.delete(p);
    });
    running.add(p);
  };

  const initial = Math.min(CONCURRENCY, total);
  for (let i = 0; i < initial; i += 1) {
    await launch();
  }

  while (running.size > 0) {
    await Promise.race(running);
    while (running.size < CONCURRENCY && nextIndex < total) {
      await launch();
    }
  }

  return results;
}

async function main() {
  const port = Number(process.env.PERF_SUMMARY_PORT || (await getFreePort()));
  const baseUrl = `http://127.0.0.1:${port}`;
  const noProxy = "127.0.0.1,localhost";

  const env = {
    ...process.env,
    PORT: String(port),
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  };

  console.log(`[perf-summary] starting backend on ${baseUrl}`);
  const backend =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npx ts-node app.ts"], {
          env,
          stdio: "inherit",
          shell: false,
        })
      : spawn("npx", ["ts-node", "app.ts"], {
          env,
          stdio: "inherit",
          shell: false,
        });

  try {
    await waitForHealth(baseUrl, STARTUP_TIMEOUT_MS);
    await runCommand("node", [ENSURE_USER_SCRIPT], env);
    const cookieHeader = await loginAndGetCookie(baseUrl);

    for (let i = 0; i < WARMUP_REQUESTS; i += 1) {
      await requestTiming(baseUrl, ENDPOINT, cookieHeader);
    }

    const results = await runLoad(baseUrl, cookieHeader);
    const totalMs = results.map((r) => r.totalMs);
    const ttfbMs = results.map((r) => r.ttfbMs);
    const failures = results.filter((r) => !r.ok).length;
    const statusCounts = results.reduce((acc, row) => {
      const key = String(row.statusCode);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const errorRate = failures / Math.max(1, results.length);
    const p95Total = percentile(totalMs, 95);
    const p95Ttfb = percentile(ttfbMs, 95);

    console.log(
      `[perf-summary] endpoint=${ENDPOINT} req=${results.length} p95_total=${p95Total.toFixed(2)}ms p95_ttfb=${p95Ttfb.toFixed(2)}ms error_rate=${(errorRate * 100).toFixed(2)}%`
    );
    console.log(`[perf-summary] statuses=${JSON.stringify(statusCounts)}`);
    console.log(
      `[perf-summary] thresholds p95_total<=${P95_MAX_MS}ms p95_ttfb<=${TTFB_P95_MAX_MS}ms error_rate<=${(MAX_ERROR_RATE * 100).toFixed(2)}%`
    );

    let failed = false;
    if (p95Total > P95_MAX_MS) {
      console.error(`[perf-summary] FAIL p95 total ${p95Total.toFixed(2)}ms > ${P95_MAX_MS}ms`);
      failed = true;
    }
    if (p95Ttfb > TTFB_P95_MAX_MS) {
      console.error(`[perf-summary] FAIL p95 ttfb ${p95Ttfb.toFixed(2)}ms > ${TTFB_P95_MAX_MS}ms`);
      failed = true;
    }
    if (errorRate > MAX_ERROR_RATE) {
      console.error(
        `[perf-summary] FAIL error rate ${(errorRate * 100).toFixed(2)}% > ${(MAX_ERROR_RATE * 100).toFixed(2)}%`
      );
      failed = true;
    }

    if (failed) process.exit(1);
    console.log("[perf-summary] PASS all thresholds.");
  } finally {
    await killProcessTree(backend);
  }
}

main().catch((error) => {
  console.error(`[perf-summary] failed: ${error.message}`);
  process.exit(1);
});
