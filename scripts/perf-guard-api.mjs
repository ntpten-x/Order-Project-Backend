import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const REQUESTS = Number(process.env.PERF_GUARD_REQUESTS || 60);
const CONCURRENCY = Number(process.env.PERF_GUARD_CONCURRENCY || 6);
const WARMUP_REQUESTS = Number(process.env.PERF_GUARD_WARMUP_REQUESTS || 10);
const P95_MAX_MS = Number(process.env.PERF_GUARD_P95_MS || 250);
const TTFB_P95_MAX_MS = Number(process.env.PERF_GUARD_TTFB_P95_MS || 120);
const MAX_ERROR_RATE = Number(process.env.PERF_GUARD_MAX_ERROR_RATE || 0.02);
const ENDPOINT = process.env.PERF_GUARD_ENDPOINT || "/health";
const STARTUP_TIMEOUT_MS = Number(process.env.PERF_GUARD_STARTUP_TIMEOUT_MS || 60000);

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

function requestTiming(baseUrl, endpoint) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let ttfb = null;
    let statusCode = 0;

    const req = http.get(`${baseUrl}${endpoint}`, { timeout: 5000 }, (res) => {
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
    });

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

async function runLoad(baseUrl) {
  const total = REQUESTS;
  const running = new Set();
  const results = [];
  let nextIndex = 0;

  const launch = async () => {
    if (nextIndex >= total) return;
    nextIndex += 1;
    const p = requestTiming(baseUrl, ENDPOINT).then((res) => {
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
  const port = Number(process.env.PERF_GUARD_PORT || (await getFreePort()));
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

  console.log(`[perf-api] starting backend on ${baseUrl}`);
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

    for (let i = 0; i < WARMUP_REQUESTS; i += 1) {
      await requestTiming(baseUrl, ENDPOINT);
    }

    const results = await runLoad(baseUrl);
    const totalMs = results.map((r) => r.totalMs);
    const ttfbMs = results.map((r) => r.ttfbMs);
    const failures = results.filter((r) => !r.ok).length;
    const errorRate = failures / Math.max(1, results.length);
    const p95Total = percentile(totalMs, 95);
    const p95Ttfb = percentile(ttfbMs, 95);

    console.log(
      `[perf-api] endpoint=${ENDPOINT} req=${results.length} p95_total=${p95Total.toFixed(2)}ms p95_ttfb=${p95Ttfb.toFixed(2)}ms error_rate=${(errorRate * 100).toFixed(2)}%`
    );
    console.log(
      `[perf-api] thresholds p95_total<=${P95_MAX_MS}ms p95_ttfb<=${TTFB_P95_MAX_MS}ms error_rate<=${(MAX_ERROR_RATE * 100).toFixed(2)}%`
    );

    let failed = false;
    if (p95Total > P95_MAX_MS) {
      console.error(`[perf-api] FAIL p95 total ${p95Total.toFixed(2)}ms > ${P95_MAX_MS}ms`);
      failed = true;
    }
    if (p95Ttfb > TTFB_P95_MAX_MS) {
      console.error(`[perf-api] FAIL p95 ttfb ${p95Ttfb.toFixed(2)}ms > ${TTFB_P95_MAX_MS}ms`);
      failed = true;
    }
    if (errorRate > MAX_ERROR_RATE) {
      console.error(
        `[perf-api] FAIL error rate ${(errorRate * 100).toFixed(2)}% > ${(MAX_ERROR_RATE * 100).toFixed(2)}%`
      );
      failed = true;
    }

    if (failed) {
      process.exit(1);
    }
    console.log("[perf-api] PASS all thresholds.");
  } finally {
    await killProcessTree(backend);
  }
}

main().catch((error) => {
  console.error(`[perf-api] failed: ${error.message}`);
  process.exit(1);
});
