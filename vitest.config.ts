import { defineConfig } from "vitest/config";

// In this sandboxed Windows environment, Vite's network-drive detection can try to run
// `net use` via child_process which fails with EPERM. Preserving symlinks avoids the
// realpath optimization path that triggers it.
export default defineConfig({
    resolve: {
        preserveSymlinks: true,
    },
    test: {
        environment: "node",
    },
});

