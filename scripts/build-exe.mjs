import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postject from "postject";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const workDir = path.join(root, ".nxcloudflare-exe-build");
const bundlePath = path.join(workDir, "nxcloudflare.cjs");
const blobPath = path.join(workDir, "nxcloudflare.blob");
const seaConfigPath = path.join(workDir, "sea-config.json");
const exePath = path.join(distDir, "nxcloudflare.exe");
const sentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: root,
            stdio: "inherit",
            windowsHide: true,
        });
        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} selesai dengan exit code ${code}`));
        });
    });
}

async function stripWindowsSignature(filename) {
    let executable = await fs.readFile(filename);
    const peOffset = executable.readUInt32LE(0x3c);
    const optionalHeader = peOffset + 24;
    const magic = executable.readUInt16LE(optionalHeader);
    const dataDirectories = optionalHeader + (magic === 0x20b ? 112 : 96);
    const securityDirectory = dataDirectories + 4 * 8;
    const certificateOffset = executable.readUInt32LE(securityDirectory);
    const certificateSize = executable.readUInt32LE(securityDirectory + 4);

    if (!certificateOffset || !certificateSize) return;
    executable.writeUInt32LE(0, securityDirectory);
    executable.writeUInt32LE(0, securityDirectory + 4);
    if (certificateOffset + certificateSize === executable.length) {
        executable = executable.subarray(0, certificateOffset);
    }
    await fs.writeFile(filename, executable);
}

if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("build:exe harus dijalankan pada Windows x64");
}
if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error(
        `build:exe memerlukan Node 20+ untuk SEA (aktif: ${process.version})`
    );
}

await fs.rm(distDir, { recursive: true, force: true });
await fs.rm(workDir, { recursive: true, force: true });
await fs.mkdir(distDir, { recursive: true });
await fs.mkdir(workDir, { recursive: true });

try {
    await build({
        entryPoints: [path.join(root, "bin", "nxcloudflare.js")],
        outfile: bundlePath,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node20",
        define: {
            // ROOT_DIR (src/utils/paths.js) tidak dipakai saat isSea()===true,
            // tapi tetap dievaluasi saat modul di-load — beri string statis
            // yang aman (bukan file: nyata) supaya tidak ikut membaca blob.
            "import.meta.url": JSON.stringify(
                "file:///__nxcloudflare_sea__/src/utils/paths.js"
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
    await stripWindowsSignature(exePath);
    await postject.inject(exePath, "NODE_SEA_BLOB", await fs.readFile(blobPath), {
        sentinelFuse,
    });

    const executable = await fs.readFile(exePath);
    const checksum = createHash("sha256").update(executable).digest("hex");
    await fs.writeFile(path.join(distDir, "SHA256SUMS.txt"), `${checksum}  nxcloudflare.exe\n`);

    console.log(`\nSelesai: ${exePath}`);
    console.log(`SHA-256: ${checksum}`);
    console.log(
        `\nCatatan: taruh .tools/cloudflared.exe di sebelah nxcloudflare.exe ` +
        `(dist/.tools/cloudflared.exe) sebelum distribusi — binary itu tidak ` +
        `ikut ter-bundle, tetap dijalankan sebagai proses terpisah.`
    );
} finally {
    await fs.rm(workDir, { recursive: true, force: true });
}
