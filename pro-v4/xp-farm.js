/** @param {NS} ns **/
// =====================================================================
// XP FARM - Mode Latihan Hacking (Bukan Cari Uang!)
// Cara kerja: Server dikosongkan uangnya, lalu di-spam HACK terus
// untuk dapat XP sebanyak mungkin per detik. Weaken menjaga security
// tetap rendah agar waktu hack tetap singkat.
// Rasio ideal: 25 Hack : 1 Weaken (berdasarkan mekanika security game)
// =====================================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");

    // Target bisa diisi manual, atau auto-pilih server XP terbaik
    let TARGET = ns.args[0] || getBestXpTarget(ns, HAS_FORMULAS);

    const HACK_SCRIPT = "/pro-v3/payload/hack.js";
    const WEAK_SCRIPT = "/pro-v3/payload/weaken1.js";
    const HACK_RAM = ns.getScriptRam(HACK_SCRIPT);
    const WEAK_RAM = ns.getScriptRam(WEAK_SCRIPT);

    // Rasio thread: 25 hack per 1 weaken
    // Mekanik: 1 hack thread +0.002 security, 1 weaken thread -0.05 security
    // 25 × 0.002 = 0.05 = tepat satu weaken bisa netralkan 25 hack
    const HACK_PER_WEAKEN = 25;

    ns.print("=========================================");
    ns.print(" 🎓 XP FARM - HACKING LEVEL TRAINER     ");
    ns.print(`    Mode: ${HAS_FORMULAS ? "✅ Formulas (Presisi)" : "⚡ Estimasi"}`);
    ns.print("=========================================");

    // Copy payload ke semua worker
    let workers = getWorkers(ns);
    for (let s of workers) {
        if (s !== "home") {
            await ns.scp([HACK_SCRIPT, WEAK_SCRIPT], s, "home");
        }
    }

    // FASE PREP: Kosongkan uang server target ke $0
    // Setelah $0, hack tidak perlu grow — terus loop hack untuk XP
    await drainServer(ns, TARGET, workers, HACK_SCRIPT, WEAK_SCRIPT);

    ns.print(`\n🎯 Target: ${TARGET} | Uang = $0 | Mulai mode XP Farm!`);
    ns.print(`📐 Rasio Thread: ${HACK_PER_WEAKEN} Hack : 1 Weaken`);

    while (true) {
        workers = getWorkers(ns);

        // Cek ulang target terbaik setiap siklus (level hack naik, target bisa berganti!)
        if (!ns.args[0]) {
            let newTarget = getBestXpTarget(ns, HAS_FORMULAS);
            if (newTarget !== TARGET) {
                ns.print(`\n🔀 TARGET XP BERGANTI: ${TARGET} → ${newTarget}`);
                TARGET = newTarget;
                for (let s of workers) {
                    if (s !== "home") await ns.scp([HACK_SCRIPT, WEAK_SCRIPT], s, "home");
                }
                await drainServer(ns, TARGET, workers, HACK_SCRIPT, WEAK_SCRIPT);
            }
        }

        let sec = ns.getServerSecurityLevel(TARGET);
        let minSec = ns.getServerMinSecurityLevel(TARGET);
        let hackLvl = ns.getHackingLevel();
        let hackTime = ns.getHackTime(TARGET);

        let xpPerSec = HAS_FORMULAS
            ? estimateXpPerSec(ns, TARGET, hackTime)
            : (ns.getServerBaseSecurityLevel(TARGET) / (hackTime / 1000)).toFixed(4);

        ns.clearLog();
        ns.print("=========================================");
        ns.print(" 🎓 XP FARM - HACKING LEVEL TRAINER     ");
        ns.print("=========================================");
        ns.print(`🎯 Target    : ${TARGET}`);
        ns.print(`📊 Hack Level: ${hackLvl}`);
        ns.print(`⏱️ Hack Time  : ${ns.tFormat(hackTime)}`);
        ns.print(`🔒 Security  : ${sec.toFixed(2)} / ${minSec.toFixed(2)}`);
        ns.print(`✨ XP/detik  : ~${xpPerSec}`);

        // Hitung total RAM tersedia
        let totalRam = 0;
        for (let w of workers) {
            let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
            if (w === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
            if (free > 0) totalRam += free;
        }

        // Hitung max thread dengan rasio 25:1 (Hack:Weaken)
        // 1 unit = 25 hack + 1 weaken
        let ramPerUnit = (HACK_PER_WEAKEN * HACK_RAM) + WEAK_RAM;
        let units = Math.floor(totalRam / ramPerUnit);

        if (units <= 0) {
            ns.print("⚠️ RAM tidak cukup. Menunggu...");
            await ns.sleep(5000);
            continue;
        }

        let tHack = units * HACK_PER_WEAKEN;
        let tWeak = units;

        ns.print(`\n🧵 Tembak: ${tHack} Hack + ${tWeak} Weaken (${units} unit)`);

        // Tembak hack dan weaken secara terdistribusi
        // Hack selalu tembak duluan, weaken bertugas "clean up" security
        let hackDelay = 0;
        let weakDelay = ns.getWeakenTime(TARGET) - hackTime - 50; // Weaken mendarat setelah hack selesai
        if (weakDelay < 0) weakDelay = 0;

        runDistributed(ns, HACK_SCRIPT, TARGET, tHack, hackDelay, workers);
        runDistributed(ns, WEAK_SCRIPT, TARGET, tWeak, weakDelay, workers);

        // Tunggu satu siklus hack selesai sebelum tembak lagi
        await ns.sleep(hackTime + 200);
    }
}

// =====================================================================
// FASE DRAIN: Kosongkan server ke $0 menggunakan hack spam
// =====================================================================
async function drainServer(ns, target, workers, hackScript, weakScript) {
    let money = ns.getServerMoneyAvailable(target);
    if (money <= 0) return;

    ns.print(`\n🔵 Draining ${target} ke $0 (uang saat ini: $${ns.formatNumber(money)})...`);

    // Weaken dulu jika security tinggi supaya drain cepat
    let sec = ns.getServerSecurityLevel(target);
    let minSec = ns.getServerMinSecurityLevel(target);
    if (sec > minSec + 1) {
        let tWeak = Math.ceil((sec - minSec) / 0.05);
        runDistributed(ns, weakScript, target, tWeak, 0, workers);
        await ns.sleep(ns.getWeakenTime(target) + 1000);
    }

    // Spam hack sampai uang habis
    while (ns.getServerMoneyAvailable(target) > 0) {
        let free = 0;
        for (let w of workers) {
            let f = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
            if (w === "home") f -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
            if (f > 0) free += f;
        }
        let threads = Math.max(1, Math.floor(free / ns.getScriptRam(hackScript)));
        runDistributed(ns, hackScript, target, threads, 0, workers);
        await ns.sleep(ns.getHackTime(target) + 500);
    }

    ns.print(`✅ Drain selesai. ${target} = $0. Siap mode XP!`);
}

// =====================================================================
// HELPER: Pilih target server dengan XP/detik terbaik
// =====================================================================
function getBestXpTarget(ns, hasFormulas) {
    let best = "n00dles";
    let bestScore = 0;
    let player = hasFormulas ? ns.getPlayer() : null;

    for (let s of getWorkers(ns)) {
        if (!ns.hasRootAccess(s)) continue;
        let reqHack = ns.getServerRequiredHackingLevel(s);
        if (reqHack > ns.getHackingLevel()) continue; // Tidak bisa hack sama sekali

        let score = 0;
        if (hasFormulas) {
            let server = ns.getServer(s);
            server.hackDifficulty = server.minDifficulty;
            // XP per tick = hackExp / hackTime
            let xpPerHack = ns.formulas.hacking.hackExp(server, player);
            let hackTime = ns.formulas.hacking.hackTime(server, player);
            score = xpPerHack / hackTime;
        } else {
            // Fallback: baseSecurity / hackTime (server lebih keras = XP lebih banyak, tapi lebih lambat)
            let baseSec = ns.getServerBaseSecurityLevel(s);
            let hackTime = ns.getHackTime(s);
            score = baseSec / hackTime;
        }

        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }
    return best;
}

// =====================================================================
// HELPER: Estimasi XP per detik (jika ada Formulas.exe)
// =====================================================================
function estimateXpPerSec(ns, target, hackTime) {
    try {
        let server = ns.getServer(target);
        let player = ns.getPlayer();
        server.hackDifficulty = server.minDifficulty;
        let xpPerHack = ns.formulas.hacking.hackExp(server, player);
        return (xpPerHack / (hackTime / 1000)).toFixed(3);
    } catch {
        return "N/A";
    }
}

// =====================================================================
// HELPER: Eksekutor terdistribusi
// =====================================================================
function runDistributed(ns, script, target, threadsLeft, delay, workers) {
    if (threadsLeft <= 0) return;
    for (let server of workers) {
        let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        if (server === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
        let possible = Math.floor(free / ns.getScriptRam(script));
        if (possible <= 0) continue;
        let use = Math.min(possible, threadsLeft);
        if (use > 0) {
            ns.exec(script, server, use, target, delay, Math.random());
            threadsLeft -= use;
        }
        if (threadsLeft <= 0) return;
    }
    if (threadsLeft > 0) ns.print(`⚠️ Kurang RAM: sisa ${threadsLeft} threads gagal tembak.`);
}

// =====================================================================
// HELPER: Dapatkan semua server yang sudah di-root
// =====================================================================
function getWorkers(ns) {
    let visited = new Set();
    let stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (visited.has(s)) continue;
        visited.add(s);
        for (let n of ns.scan(s)) stack.push(n);
    }
    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}
