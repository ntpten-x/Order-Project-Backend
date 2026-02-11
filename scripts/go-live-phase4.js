const net = require("net");
const { spawn } = require("child_process");
const http = require("http");

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
  const noProxy = "127.0.0.1,localhost";

  const backendEnv = {
    ...process.env,
    PORT: String(port),
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  };

  const k6Env = {
    ...process.env,
    BASE_URL: baseUrl,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  };

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
    await waitForHealth(baseUrl, 60000);
    console.log("[phase4] health ready, starting k6");
    const k6Code = await new Promise((resolve, reject) => {
      const k6 =
        process.platform === "win32"
          ? spawn("cmd.exe", ["/d", "/s", "/c", "k6 run load-tests/k6-go-live-smoke.js"], {
              env: k6Env,
              stdio: "inherit",
              shell: false,
            })
          : spawn("k6", ["run", "load-tests/k6-go-live-smoke.js"], {
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
