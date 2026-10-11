import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postject from "postject";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const workDir = path.join(root, ".nxcloud-exe-build");
const bundlePath = path.join(workDir, "nxcloud.cjs");
const blobPath = path.join(workDir, "nxcloud.blob");
const seaConfigPath = path.join(workDir, "sea-config.json");
const exePath = path.join(distDir, "nxcloud");
const sentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: root, stdio: "inherit" });
        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} selesai dengan exit code ${code}`));
        });
    });
}

if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("build:exe:linux harus dijalankan pada Linux x64 (mis. di dalam WSL2)");
}
if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error(
        `build:exe:linux memerlukan Node 20+ untuk SEA (aktif: ${process.version})`
    );
}

await fs.rm(distDir, { recursive: true, force: true });
await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(distDir, { recursive: true });
await fs.mkdir(workDir, { recursive: true });

try {
    await build({
        entryPoints: [path.join(root, "bin", "nxcloud.js")],
        outfile: bundlePath,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node20",
        define: {
            "import.meta.url": JSON.stringify(
                "file:///__nxcloud_sea__/src/utils/paths.js"
            ),
        },
        logLevel: "info",
    });

    await fs.writeFile(
        seaConfigPath,
        JSON.stringify(
            {
                main: bundlePath,
                output: blobPath,
                disableExperimentalSEAWarning: true,
                useSnapshot: false,
                useCodeCache: false,
            },
            null,
            2
        )
    );

    await run(process.execPath, ["--experimental-sea-config", seaConfigPath]);
    await fs.copyFile(process.execPath, exePath);
    await fs.chmod(exePath, 0o755);
    await postject.inject(exePath, "NODE_SEA_BLOB", await fs.readFile(blobPath), {
        sentinelFuse,
    });
    await fs.chmod(exePath, 0o755);

    const executable = await fs.readFile(exePath);
    const checksum = createHash("sha256").update(executable).digest("hex");
    await fs.writeFile(path.join(distDir, "SHA256SUMS.txt"), `${checksum}  nxcloud\n`);

    console.log(`\nSelesai: ${exePath}`);
    console.log(`SHA-256: ${checksum}`);
    console.log(
        `\nCatatan: taruh .tools/cloudflared (tanpa ekstensi, chmod +x) di ` +
        `sebelah nxcloud (dist/.tools/cloudflared) sebelum distribusi.`
    );
} finally {
    await fs.rm(workDir, { recursive: true, force: true });
}
