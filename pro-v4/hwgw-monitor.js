/** @param {NS} ns
 *  HWGW PERFORMANCE MONITOR
 *  Jalankan paralel dengan dist-hwgw-v5.js:
 *    run pro-v4/hwgw-monitor.js
 *
 *  Output: /pro-v4/hwgw-stats.txt (bisa dibaca kapan saja)
 *  Dashboard: tail window dengan refresh setiap 5 detik
 *
 *  Data yang dikumpulkan:
 *  - $/detik (rolling 30s, 5 menit, sejak start)
 *  - Per-target: money%, security drift, status
 *  - RAM utilization per worker
 *  - Prep vs hack time ratio
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const STATS_FILE  = "/pro-v4/hwgw-stats.txt";
    const INTERVAL_MS = 5000;   // snapshot tiap 5 detik
    const HISTORY_MAX = 360;    // simpan 30 menit data (360 × 5s)

    const PAYLOAD_WEAKEN = "/pro-v3/payload/weaken1.js";
    const PAYLOAD_GROW   = "/pro-v3/payload/grow.js";
    const PAYLOAD_HACK   = "/pro-v3/payload/hack.js";

    // ── State ──────────────────────────────────────────────────────────────────
    let moneyHistory = [];   // [{ ts, money }]
    let snapshots    = [];   // [{ ts, targets, ram, income }]
    let startMoney   = ns.getPlayer().money;
    let startTime    = Date.now();

    ns.print("═══════════════════════════════════════════");
    ns.print("  📡 HWGW PERFORMANCE MONITOR              ");
    ns.print("  Interval: 5s | History: 30 menit         ");
    ns.print("═══════════════════════════════════════════");

    while (true) {
        const now     = Date.now();
        const player  = ns.getPlayer();
        const elapsed = (now - startTime) / 1000;

        // ── Snapshot uang ──────────────────────────────────────────────────────
        moneyHistory.push({ ts: now, money: player.money });
        if (moneyHistory.length > HISTORY_MAX) moneyHistory.shift();

        // ── Hitung income rate ─────────────────────────────────────────────────
        const rate30s  = calcRate(moneyHistory, now, 30_000);
        const rate5m   = calcRate(moneyHistory, now, 300_000);
        const rateAll  = (player.money - startMoney) / Math.max(1, elapsed);

        // ── Scan semua worker dan target ───────────────────────────────────────
        const workers  = getAllWorkers(ns);
        const targets  = getHackableTargets(ns);

        // ── RAM stats ──────────────────────────────────────────────────────────
        let totalMax = 0, totalUsed = 0;
        let workerData = [];
        for (let w of workers) {
            let max  = ns.getServerMaxRam(w);
            let used = ns.getServerUsedRam(w);
            totalMax  += max;
            totalUsed += used;
            workerData.push({ host: w, max, used, pct: max > 0 ? used / max * 100 : 0 });
        }
        let ramPct = totalMax > 0 ? totalUsed / totalMax * 100 : 0;

        // ── Per-target state ───────────────────────────────────────────────────
        let targetData = [];
        for (let t of targets) {
            let maxMoney = ns.getServerMaxMoney(t);
            if (maxMoney <= 0) continue;
            let curMoney = ns.getServerMoneyAvailable(t);
            let minSec   = ns.getServerMinSecurityLevel(t);
            let curSec   = ns.getServerSecurityLevel(t);
            let moneyPct = curMoney / maxMoney * 100;
            let secDrift = curSec - minSec;

            // Tentukan status dari proses yang berjalan
            let status   = "idle";
            let weakRunning = 0, growRunning = 0, hackRunning = 0;
            for (let w of workers) {
                try {
                    for (let p of ns.ps(w)) {
                        if (!p.args.includes(t)) continue;
                        if (p.filename.includes("weaken")) weakRunning += p.threads;
                        else if (p.filename.includes("grow")) growRunning += p.threads;
                        else if (p.filename.includes("hack")) hackRunning += p.threads;
                    }
                } catch { }
            }
            if (hackRunning > 0 && weakRunning > 0) status = "⚡batch";
            else if (weakRunning > 0 || growRunning > 0) status = "🛠️ prep";
            else if (moneyPct < 80 || secDrift > 1) status = "⏳wait";

            targetData.push({
                host: t, moneyPct, curMoney, maxMoney,
                secDrift, curSec, minSec, status,
                weakRunning, growRunning, hackRunning
            });
        }
        // Sort by money% ascending (server paling bermasalah di atas)
        targetData.sort((a, b) => a.moneyPct - b.moneyPct);

        // ── Prep vs Hack ratio ─────────────────────────────────────────────────
        let totalThreads = 0, prepThreads = 0, hackThreads = 0;
        for (let td of targetData) {
            totalThreads += td.weakRunning + td.growRunning + td.hackRunning;
            prepThreads  += td.weakRunning + td.growRunning;
            hackThreads  += td.hackRunning;
        }
        let hackRatio = totalThreads > 0 ? hackThreads / totalThreads * 100 : 0;

        // ── Print dashboard ────────────────────────────────────────────────────
        ns.clearLog();
        ns.print(`═══ 📡 HWGW MONITOR  ${new Date().toLocaleTimeString()} ═══`);

        // Income section
        ns.print(`\n💰 INCOME`);
        ns.print(`   30s  : ${fmt$(ns, rate30s)}/s  →  ${fmt$(ns, rate30s * 3600)}/hr`);
        ns.print(`   5min : ${fmt$(ns, rate5m)}/s  →  ${fmt$(ns, rate5m * 3600)}/hr`);
        ns.print(`   Total: ${fmt$(ns, player.money - startMoney)} dalam ${fmtTime(elapsed)}`);

        // RAM section
        ns.print(`\n🖥️  RAM  ${ns.format.ram(totalUsed)} / ${ns.format.ram(totalMax)}  (${ramPct.toFixed(1)}% used)`);
        ns.print(`   Idle : ${ns.format.ram(totalMax - totalUsed)}  |  Hack:${hackRatio.toFixed(0)}%  Prep:${(100 - hackRatio).toFixed(0)}% threads`);

        // Workers yang paling idle (top 3)
        let idleWorkers = [...workerData].sort((a, b) => a.pct - b.pct).slice(0, 3);
        for (let w of idleWorkers) {
            if (w.pct < 90) ns.print(`   ⚠️  ${w.host.padEnd(18)} idle: ${ns.format.ram(w.max - w.used)} (${(100-w.pct).toFixed(0)}%)`);
        }

        // Per-target section
        ns.print(`\n🎯 TARGETS (${targetData.length})`);
        ns.print(`   ${"HOST".padEnd(20)} ${"MONEY%".padStart(7)} ${"SEC+".padStart(5)} ${"STATUS".padEnd(10)} THREADS(W/G/H)`);
        ns.print(`   ${"─".repeat(65)}`);
        for (let td of targetData) {
            let moneyBar = makeBar(td.moneyPct, 10);
            let secWarn  = td.secDrift > 5 ? "🔴" : td.secDrift > 1 ? "🟡" : "🟢";
            ns.print(
                `   ${td.host.padEnd(20)} ` +
                `${moneyBar} ${td.moneyPct.toFixed(1).padStart(5)}% ` +
                `${secWarn}${td.secDrift.toFixed(1).padStart(4)} ` +
                `${td.status.padEnd(10)} ` +
                `${td.weakRunning}/${td.growRunning}/${td.hackRunning}`
            );
        }

        // Ringkasan masalah
        let depleted = targetData.filter(t => t.moneyPct < 10);
        let highSec  = targetData.filter(t => t.secDrift > 5);
        if (depleted.length > 0 || highSec.length > 0) {
            ns.print(`\n⚠️  PERINGATAN:`);
            for (let t of depleted) ns.print(`   💸 ${t.host}: depleted ${t.moneyPct.toFixed(2)}% (${fmt$(ns, t.curMoney)}/${fmt$(ns, t.maxMoney)})`);
            for (let t of highSec)  ns.print(`   🔒 ${t.host}: security +${t.secDrift.toFixed(1)} di atas min`);
        }

        // ── Simpan snapshot ke file ────────────────────────────────────────────
        snapshots.push({
            ts: now, elapsed: elapsed.toFixed(0),
            rate30s: rate30s.toFixed(0), rate5m: rate5m.toFixed(0),
            ramPct: ramPct.toFixed(1), hackRatio: hackRatio.toFixed(0),
            targets: targetData.map(t => ({
                host: t.host, moneyPct: t.moneyPct.toFixed(1),
                secDrift: t.secDrift.toFixed(2), status: t.status
            }))
        });
        if (snapshots.length > HISTORY_MAX) snapshots.shift();

        // Tulis summary terbaru ke file
        let fileContent = [
            `# HWGW Stats — ${new Date().toLocaleString()}`,
            `income_30s=${rate30s.toFixed(0)}`,
            `income_5m=${rate5m.toFixed(0)}`,
            `income_all=${rateAll.toFixed(0)}`,
            `ram_pct=${ramPct.toFixed(1)}`,
            `hack_ratio=${hackRatio.toFixed(0)}`,
            `depleted_count=${depleted.length}`,
            `high_sec_count=${highSec.length}`,
            `targets=${targetData.map(t => `${t.host}:${t.moneyPct.toFixed(0)}%:${t.status}`).join(",")}`,
        ].join("\n");
        ns.write(STATS_FILE, fileContent, "w");

        await ns.sleep(INTERVAL_MS);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcRate(history, now, windowMs) {
    let cutoff = now - windowMs;
    let inWindow = history.filter(h => h.ts >= cutoff);
    if (inWindow.length < 2) return 0;
    let first = inWindow[0], last = inWindow[inWindow.length - 1];
    let dt = (last.ts - first.ts) / 1000;
    return dt > 0 ? (last.money - first.money) / dt : 0;
}

function getAllWorkers(ns) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (!visited.has(s)) { visited.add(s); ns.scan(s).forEach(n => stack.push(n)); }
    }
    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}

function getHackableTargets(ns) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (!visited.has(s)) { visited.add(s); ns.scan(s).forEach(n => stack.push(n)); }
    }
    return [...visited].filter(s =>
        ns.hasRootAccess(s) &&
        ns.getServerMaxMoney(s) > 0 &&
        ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
    );
}

function fmt$(ns, val) {
    if (!isFinite(val) || val <= 0) return "$0";
    return "$" + ns.format.number(val);
}

function fmtTime(seconds) {
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);
    if (h > 0) return `${h}j${m}m`;
    if (m > 0) return `${m}m${s}s`;
    return `${s}s`;
}

function makeBar(pct, width = 10) {
    let filled = Math.round(pct / 100 * width);
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

export function autocomplete() { return []; }
