const net = require("net");
const { spawn } = require("child_process");
const http = require("http");

function setDefaultEnv(target, key, value) {
  if (target[key] === undefined || target[key] === null || target[key] === "") {
    target[key] = String(value);
  }
}

function applyGoLiveProfile(baseEnv, profileName) {
  if (!profileName) return baseEnv;

  const profile = profileName.trim().toLowerCase();
  const env = { ...baseEnv };

  if (profile === "pos-performance" || profile === "pos-production") {
    // Read-heavy POS tuning profile for realistic production-like load tests.
    setDefaultEnv(env, "TYPEORM_LOGGING", "false");
    setDefaultEnv(env, "DATABASE_POOL_MAX", "80");
    setDefaultEnv(env, "DATABASE_POOL_MIN", "20");
    setDefaultEnv(env, "DATABASE_CONNECTION_TIMEOUT_MS", "30000");
    setDefaultEnv(env, "DATABASE_IDLE_TIMEOUT_MS", "30000");
    setDefaultEnv(env, "STATEMENT_TIMEOUT_MS", "30000");

    // Avoid false negatives in load tests where many POS clients share one NAT/public IP.
    setDefaultEnv(env, "RATE_LIMIT_MAX", "100000");
  }

  return env;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate dynamic port")));
        return;
      }
      const { port } = address;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForHealth(baseUrl, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`${baseUrl}/health`, { timeout: 3000 }, (res) => {
        const ok = res.statusCode === 200;
        res.resume();
        if (ok) {
          resolve();
          return;
        }
        retry();
      });

      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Backend did not become healthy within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 800);
    };

    check();
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
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 3000);
  });
}

async function run() {
  const port = Number(process.env.GO_LIVE_PORT || (await getFreePort()));
  const baseUrl = `http://127.0.0.1:${port}`;
  const goLiveProfile = process.env.GO_LIVE_PROFILE || "";
  const k6Script = process.env.GO_LIVE_K6_SCRIPT || "load-tests/k6-go-live-smoke.js";
  const k6SummaryExport = process.env.GO_LIVE_K6_SUMMARY || "";
  const startupTimeoutMs = Number(process.env.GO_LIVE_STARTUP_TIMEOUT_MS || 180000);
  const noProxy = "127.0.0.1,localhost";

  const backendEnvBase = {
    ...process.env,
    PORT: String(port),
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  };
  const backendEnv = applyGoLiveProfile(backendEnvBase, goLiveProfile);

  const k6Env = {
    ...process.env,
    BASE_URL: baseUrl,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  };

  if (goLiveProfile) {
    console.log(`[phase4] profile: ${goLiveProfile}`);
    console.log(
      `[phase4] effective tuning: pool_max=${backendEnv.DATABASE_POOL_MAX || "-"} pool_min=${backendEnv.DATABASE_POOL_MIN || "-"} rate_limit_max=${backendEnv.RATE_LIMIT_MAX || "-"} logging=${backendEnv.TYPEORM_LOGGING || "-"}`
    );
  }

  console.log(`[phase4] starting backend on ${baseUrl}`);
  const backend =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npx ts-node app.ts"], {
          env: backendEnv,
          stdio: "inherit",
          shell: false,
        })
      : spawn("npx", ["ts-node", "app.ts"], {
          env: backendEnv,
          stdio: "inherit",
          shell: false,
        });

  let exitCode = 1;

  try {
    console.log("[phase4] waiting for /health");
    await waitForHealth(baseUrl, startupTimeoutMs);
    console.log(`[phase4] health ready, starting k6 (${k6Script})`);
    const k6Code = await new Promise((resolve, reject) => {
      const args = ["run"];
      if (k6SummaryExport) {
        args.push("--summary-export", k6SummaryExport);
      }
      args.push(k6Script);

      const k6 = spawn("k6", args, {
        env: k6Env,
        stdio: "inherit",
        shell: false,
      });

      k6.on("error", reject);
      k6.on("exit", (code) => resolve(code ?? 1));
    });

    exitCode = k6Code;
  } finally {
    await killProcessTree(backend);
  }

  process.exit(exitCode);
}

run().catch((error) => {
  console.error("[phase4] failed:", error.message);
  process.exit(1);
});
