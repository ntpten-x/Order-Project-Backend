"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
// In this sandboxed Windows environment, Vite's network-drive detection can try to run
// `net use` via child_process which fails with EPERM. Preserving symlinks avoids the
// realpath optimization path that triggers it.
exports.default = (0, config_1.defineConfig)({
    resolve: {
        preserveSymlinks: true,
    },
    test: {
        environment: "node",
    },
});
