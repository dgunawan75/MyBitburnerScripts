/*
 * SHARE MASTER (Gap Filler Edition)
 * Strategi: Kill share lama → hitung RAM bebas → launch share baru
 * Dengan cara ini HWGW selalu dapat RAM kembali di siklus berikutnya.
 *
 * Args:
 *   --pserv  → home + pserv-* saja
 *   --all    → semua server termasuk home (default: nuked server saja)
 */
/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const useAll = ns.args.includes("--all");
    const usePserv = ns.args.includes("--pserv") || useAll;

    const SHARE_SCRIPT = "/workers/share.js";
    const SHARE_RAM = ns.getScriptRam(SHARE_SCRIPT);
    const HOME_RESERVE = 128; // GB dicadangkan di home untuk script lain
    const CYCLE_MS = 10000; // 10 detik per siklus (= durasi 1 ns.share())

    const modeLabel = useAll ? "🌐 ALL (+ HOME)"
        : usePserv ? "🖥️ PSERV + NPC"
            : "🔓 NPC Only";

    ns.print("=========================================");
    ns.print(" 🔗 SHARE MASTER — GAP FILLER EDITION   ");
    ns.print(`    Mode: ${modeLabel}`);
    ns.print("=========================================");

    while (true) {
        let servers = scanRooted(ns);
        let totalLaunched = 0;

        // LANGKAH 1: Kill semua share lama di semua server
        // Sehingga RAM kembali bebas dan bisa dihitung ulang dengan akurat
        for (let server of servers) {
            if (server === "home" && !useAll) continue;
            if (server.startsWith("pserv-") && !usePserv) continue;
            killShareScripts(ns, server, SHARE_SCRIPT);
        }

        // Tunggu sebentar agar proses kill terealisasi
        await ns.sleep(200);

        // LANGKAH 2-4: Hitung RAM bebas SETELAH kill, lalu launch share baru
        for (let server of servers) {
            if (server === "home" && !useAll) continue;
            if (server.startsWith("pserv-") && !usePserv) continue;

            let maxRam = ns.getServerMaxRam(server);
            let usedRam = ns.getServerUsedRam(server);
            let freeRam = maxRam - usedRam;

            // Cadangkan RAM agar HWGW tetap bisa kerja
            if (server === "home") freeRam -= HOME_RESERVE;
            if (freeRam <= 0) continue;

            let threads = Math.floor(freeRam / SHARE_RAM);
            if (threads <= 0) continue;

            // Copy script ke server jika perlu
            if (server !== "home" && !ns.fileExists(SHARE_SCRIPT, server)) {
                await ns.scp(SHARE_SCRIPT, server, "home");
            }

            // Launch share threads baru pada RAM yang benar-benar bebas
            let pid = ns.exec(SHARE_SCRIPT, server, threads);
            if (pid > 0) totalLaunched += threads;
        }

        // Display status
        let sharePower = ns.getSharePower();
        let bonusPercent = ((sharePower - 1) * 100).toFixed(2);

        ns.clearLog();
        ns.print("=========================================");
        ns.print(" 🔗 SHARE MASTER — GAP FILLER EDITION   ");
        ns.print(`    Mode: ${modeLabel}`);
        ns.print("=========================================");
        ns.print(`🧵 Threads Aktif : ${ns.formatNumber(totalLaunched)}`);
        ns.print(`💾 RAM Dipakai   : ${ns.formatRam(totalLaunched * SHARE_RAM)}`);
        ns.print(`🌟 Booster Rep   : +${bonusPercent}%`);
        ns.print(`\n⏳ Refresh dalam ${CYCLE_MS / 1000}s — otomatis lepas RAM untuk HWGW`);

        // Tunggu satu siklus penuh (= durasi ns.share())
        // Setelah ini share lama otomatis selesai, siap dengan distribusi RAM terbaru
        await ns.sleep(CYCLE_MS);
    }
}

// Kill semua instance share script di satu server
function killShareScripts(ns, server, scriptName) {
    let procs = ns.ps(server);
    for (let proc of procs) {
        if (proc.filename === scriptName) {
            ns.kill(proc.pid);
        }
    }
}

// BFS scan semua server yang sudah di-root
function scanRooted(ns) {
    let visited = new Set();
    let stack = ["home"];
    while (stack.length) {
        let current = stack.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        for (let n of ns.scan(current)) stack.push(n);
    }
    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}
