/** @param {NS} ns
 *  DARKNET STATUS DASHBOARD
 *  Jalankan: run ai/darknet-status.js [--watch]
 *
 *  Menampilkan semua server yang sudah di-hack, model-nya,
 *  script yang berjalan, dan status sesi saat ini.
 *  --watch : auto-refresh setiap 10 detik
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME    = "home";
    const PASS_DB = "/darknet-passwords.txt";
    const FULL    = "ai/darknet-worker-v4.js";
    const LITE    = "ai/darknet-worker-lite.js";
    const WATCH   = ns.args.includes("--watch");

    if (WATCH) ns.ui.openTail();

    do {
        ns.clearLog();
        await printDashboard(ns, HOME, PASS_DB, FULL, LITE, WATCH);
        if (WATCH) await ns.sleep(10000);
    } while (WATCH);
}

async function printDashboard(ns, home, passDb, fullScript, liteScript, watchMode = false) {
    const now = new Date().toLocaleTimeString();

    // ── Load password DB ──────────────────────────────────────────────────────
    let saved = {};
    try {
        if (ns.fileExists(passDb, home)) saved = JSON.parse(ns.read(passDb));
    } catch { }

    const allKeys    = Object.keys(saved);
    // Filter: hostname valid = string non-numerik, panjang > 1
    const hackedHosts = allKeys.filter(h =>
        h && typeof h === "string" && h.length > 0 && isNaN(Number(h))
    );
    // Laporan jika ada key tidak valid di DB
    const invalidKeys = allKeys.filter(h => !hackedHosts.includes(h));
    if (invalidKeys.length > 0) {
        ns.print(`   ⚠️ DB memiliki ${invalidKeys.length} key tidak valid: ${invalidKeys.join(", ")} (abaikan)`);
    }

    // ── Scan seluruh jaringan darknet dari home ───────────────────────────────
    let allNeighbors = [];
    try { allNeighbors = ns.dnet.probe(); } catch { }

    // ── Header ────────────────────────────────────────────────────────────────
    ns.print(`╔══════════════════════════════════════════════════════════════╗`);
    ns.print(`║  🌑 DARKNET STATUS DASHBOARD  •  ${now.padEnd(29)}║`);
    ns.print(`╠══════════════════════════════════════════════════════════════╣`);
    ns.print(`║  Total di DB: ${String(hackedHosts.length).padEnd(4)}  │  Tetangga terlihat: ${String(allNeighbors.length).padEnd(17)}║`);
    ns.print(`╚══════════════════════════════════════════════════════════════╝`);
    ns.print(``);

    // ── Tabel server yang sudah di-hack (ada di DB) ───────────────────────────
    ns.print(`── ✅ SERVER TERHACK (Password DB) ────────────────────────────`);

    let runFull = 0, runLite = 0, runNone = 0;
    let totalRam = 0, usedRam = 0;

    for (const host of hackedHosts) {
        const pw = saved[host];

        // Cek detail server
        let det = null;
        try { det = ns.dnet.getServerAuthDetails(host); } catch { }

        const hasSession = det?.hasSession ?? false;
        const isOnline   = det?.isOnline   ?? false;
        const model      = det?.modelId    ?? "?";

        // RAM info
        let maxRam  = 0, usedR = 0;
        try {
            maxRam = ns.getServerMaxRam(host);
            usedR  = ns.getServerUsedRam(host);
            totalRam += maxRam;
            usedRam  += usedR;
        } catch { }

        // Script yang berjalan
        let scriptStatus = "   –";
        let scriptIcon   = "⬜";
        try {
            if (ns.isRunning(fullScript, host)) {
                scriptStatus = "FULL";
                scriptIcon   = "🟢";
                runFull++;
            } else if (ns.isRunning(liteScript, host)) {
                scriptStatus = "LITE";
                scriptIcon   = "🟡";
                runLite++;
            } else {
                scriptStatus = "none";
                scriptIcon   = "🔴";
                runNone++;
            }
        } catch { scriptStatus = "err"; }

        // Session indicator
        const sessIcon = hasSession ? "🔓" : (isOnline ? "🔒" : "📴");

        // Password display (sensor jika panjang)
        let pwDisplay = pw === "__manual__" ? "(manual)" : `"${String(pw).substring(0, 12)}"`;

        // Format baris
        const ramStr  = maxRam > 0 ? `${usedR.toFixed(0)}/${maxRam.toFixed(0)}GB` : "–";
        ns.print(
            `  ${scriptIcon}${sessIcon} ${host.padEnd(22)} ${model.padEnd(16)} ${scriptStatus.padEnd(4)}  ${ramStr.padEnd(10)} pw:${pwDisplay}`
        );
    }

    if (hackedHosts.length === 0) {
        ns.print(`  (belum ada server di password DB)`);
    }

    // ── Summary script ────────────────────────────────────────────────────────
    ns.print(``);
    ns.print(`── 📊 RINGKASAN SCRIPT ─────────────────────────────────────────`);
    ns.print(`   🟢 FULL berjalan : ${runFull}`);
    ns.print(`   🟡 LITE berjalan : ${runLite}`);
    ns.print(`   🔴 Tidak ada     : ${runNone}`);
    ns.print(`   💾 RAM total     : ${usedRam.toFixed(0)} / ${totalRam.toFixed(0)} GB`);

    // ── Server tetangga yang BELUM di-hack ────────────────────────────────────
    const unhacked = allNeighbors.filter(h => h !== "home" && !(h in saved));
    if (unhacked.length > 0) {
        ns.print(``);
        ns.print(`── ⏳ BELUM DI-HACK (terlihat dari home) ───────────────────────`);
        for (const host of unhacked) {
            let det = null;
            try { det = ns.dnet.getServerAuthDetails(host); } catch { }
            const online  = det?.isOnline   ?? false;
            const model   = det?.modelId    ?? "?";
            const hasSess = det?.hasSession ?? false;
            const icon    = hasSess ? "🖱️ (manual ok)" : (online ? "🔒" : "📴");
            ns.print(`   ${icon} ${host.padEnd(22)} model: ${model}`);
        }
    }

    ns.print(``);
    ns.print(`── 🔑 STATUS SCRIPT WORKER ─────────────────────────────────────`);
    // Cek apakah worker v4 berjalan di home
    const v4Running = ns.isRunning("ai/darknet-worker-v4.js", "home");
    const v3Running = ns.isRunning("ai/darknet-worker-v3.js", "home");
    ns.print(`   Worker v4 @ home : ${v4Running ? "🟢 RUNNING" : "🔴 TIDAK JALAN"}`);
    ns.print(`   Worker v3 @ home : ${v3Running ? "⚠️ MASIH JALAN (kill dulu!)" : "✅ tidak ada"}`);

    if (watchMode) {
        ns.print(``);
        ns.print(`   [Auto-refresh tiap 10 detik... Ctrl+C untuk stop]`);
    }
}

// Re-export untuk autocomplete
export function autocomplete() { return ["--watch"]; }
