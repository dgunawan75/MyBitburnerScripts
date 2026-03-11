/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // =============== KONFIGURASI ===============
    const T_DELAY = 50; // Jeda milidetik antar peluru agar tidak tabrakan (50ms sangat aman)

    // Default Target Otomatis jika argumen kosong
    const TARGET = ns.args[0] || getBestTarget(ns);

    // RAM Cost dari Script Payload
    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    ns.print(`=========================================`);
    ns.print(` 🌐 DISTRIBUTED H.W.G.W ENGINE BEKERJA   `);
    ns.print(` 🎯 TARGET AKTIF: ${TARGET.toUpperCase()}`);
    ns.print(`=========================================`);

    // Helper: Pindah payload ke semua worker
    for (let s of getWorkers(ns)) {
        if (s !== "home") {
            await ns.scp([
                "/pro-v3/payload/hack.js",
                "/pro-v3/payload/grow.js",
                "/pro-v3/payload/weaken1.js",
                "/pro-v3/payload/weaken2.js"
            ], s, "home");
        }
    }

    // Main Engine Loop
    while (true) {
        // 1. FASE PREP: Pastikan server target dalam keadaan sempurna 100% uang dan 0% security
        await prepServer(ns, TARGET);

        // 2. FASE KALKULASI DISTRIBUTED
        ns.print(`\n📊 Menghitung batas maksimal Jaringan Terdistribusi...`);
        let percentToSteal = 0.50; // Mulai dari 50%
        let batchData = null;
        let ramPerBatch = 0;

        let totalNetworkRam = 0;
        for (let w of getWorkers(ns)) {
            let max = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
            if (w === "home") max -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
            if (max > 0) totalNetworkRam += max;
        }

        let weakTime = ns.getWeakenTime(TARGET);
        let maxBatches = Math.floor(weakTime / (T_DELAY * 4));

        while (percentToSteal > 0.001) {
            batchData = calculateBatch(ns, TARGET, percentToSteal);
            if (batchData) {
                ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);
                let totalRamNeeded = ramPerBatch * maxBatches;

                if (totalRamNeeded <= totalNetworkRam) {
                    break; // Ukuran Peluru x Max Batch muat di total seluruh jaringan kita
                }
            }
            percentToSteal -= 0.01;
        }

        // Jika curian paling kecil sekalipun (0.1%) butuh RAM total yang melebihi kapasitas jaringan,
        // kita terpaksa potong jumlah Batch di udara agar tetap bisa jalan!
        if (!batchData || ramPerBatch * maxBatches > totalNetworkRam) {
            batchData = calculateBatch(ns, TARGET, 0.001); // Paksa 0.1% steal
            ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);
            maxBatches = Math.max(1, Math.floor(totalNetworkRam / ramPerBatch));
            percentToSteal = 0.001;
        }

        ns.print(`💰 Target Curian: ${(percentToSteal * 100).toFixed(1)}%`);
        ns.print(`🚀 Max Udara    : ${maxBatches} Cycle Batches`);
        ns.print(`⚙️ RAM 1 Batch  : ${ns.formatRam(ramPerBatch)}`);
        ns.print(`🧵 Total Network: ${ns.formatRam(totalNetworkRam)} Tersedia`);

        // 3. FASE PENEMBAKAN (DISPATCHER)
        let batchNumber = 1;
        while (batchNumber <= maxBatches) {
            // Hitung ulang delay presisi setiap siklus karena Hacking Level pengguna bisa saja naik di tengah jalan!
            let tHack = ns.getHackTime(TARGET);
            let tGrow = ns.getGrowTime(TARGET);
            let tWeaken = ns.getWeakenTime(TARGET);

            // Waktu Mendarat (Sync Sempurna)
            let timeW2 = tWeaken;
            let timeG = timeW2 - T_DELAY;
            let timeW1 = timeG - T_DELAY;
            let timeH = timeW1 - T_DELAY;

            // Waktu Lepas Landas
            let dW2 = timeW2 - tWeaken;
            let dG = timeG - tGrow;
            let dW1 = timeW1 - tWeaken;
            let dH = timeH - tHack;

            // Tembakkan Thread terdistribusi ke seluruh jaringan, tidak peduli server mana yang mengeksekusi
            runDistributed(ns, "/pro-v3/payload/hack.js", TARGET, batchData.tHack, dH, batchNumber);
            runDistributed(ns, "/pro-v3/payload/weaken1.js", TARGET, batchData.tWeak1, dW1, batchNumber);
            runDistributed(ns, "/pro-v3/payload/grow.js", TARGET, batchData.tGrow, dG, batchNumber);
            runDistributed(ns, "/pro-v3/payload/weaken2.js", TARGET, batchData.tWeak2, dW2, batchNumber);

            batchNumber++;
            await ns.sleep(T_DELAY * 4); // Tidur per cycle tembakan
        }

        ns.print(`⏰ Total ${maxBatches} udara terisi penuh. Menunggu ${ns.tFormat(weakTime)} hingga mendarat...`);
        await ns.sleep(weakTime + 500); // Tunggu sampai H,W,G,W mendarat sempurna.
    }
}

// =====================================
// HELPER: Mendapatkan semua Server yang di root
// =====================================
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

// =====================================
// HELPER: Eksekutor Terdistribusi (Pecah Thread!)
// =====================================
function runDistributed(ns, script, target, threadsLeft, delay, batchNumber) {
    if (threadsLeft <= 0) return;

    for (let server of getWorkers(ns)) {
        let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        if (server === "home") {
            let reserve = Math.min(128, ns.getServerMaxRam("home") * 0.1);
            free -= reserve;
        }

        let stepRam = ns.getScriptRam(script);
        let possible = Math.floor(free / stepRam);

        if (possible <= 0) continue;

        let use = Math.min(possible, threadsLeft);
        if (use > 0) {
            ns.exec(script, server, use, target, delay, batchNumber, Math.random()); // Math.random bypasses duplicate args limitation
            threadsLeft -= use;
        }

        if (threadsLeft <= 0) return;
    }

    if (threadsLeft > 0) {
        ns.print(`⚠️ Peringatan: Kekurangan RAM! Gagal menembakkan ${threadsLeft} threads ${script}.`);
    }
}

// =====================================
// HELPER: SUPER PREP SERVER
// =====================================
async function prepServer(ns, target) {
    let minSec = ns.getServerMinSecurityLevel(target);
    let maxMoney = ns.getServerMaxMoney(target);

    while (true) {
        let sec = ns.getServerSecurityLevel(target);
        let money = ns.getServerMoneyAvailable(target);

        if (sec <= minSec + 0.1 && money >= maxMoney * 0.99) break;

        ns.clearLog();
        ns.print(`--- FASE PERSIAPAN (${target}) ---`);
        ns.print(`Security: ${ns.formatNumber(sec)} / ${ns.formatNumber(minSec)}`);
        ns.print(`Money   : $${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)}`);

        let isWeaken = sec > minSec + 0.1;
        let script = isWeaken ? "/pro-v3/payload/weaken1.js" : "/pro-v3/payload/grow.js";
        let waitTime = isWeaken ? ns.getWeakenTime(target) : ns.getGrowTime(target);

        let totalSended = 0;
        for (let server of getWorkers(ns)) {
            let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            if (server === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);

            let threads = Math.floor(free / ns.getScriptRam(script));
            if (threads > 0) {
                ns.exec(script, server, threads, target, 0, "PREP", Math.random());
                totalSended += threads;
            }
        }

        if (totalSended > 0) {
            ns.print(`🚀 PREP MASSAL ${isWeaken ? "Weaken" : "Grow"} -> ${totalSended} threads.`);
            ns.print(`⏳ Mode Tidur selama ${ns.tFormat(waitTime)}...`);
            await ns.sleep(waitTime + 1000);
        } else {
            ns.print("💤 Seluruh RAM penuh. Menunggu 60 dtk...");
            await ns.sleep(60000);
        }
    }
}

// =====================================
// HELPER: MENGHITUNG THREAD FORMULAS MATEMATIKA
// =====================================
function calculateBatch(ns, target, steal) {
    let server = ns.getServer(target);
    let player = ns.getPlayer();

    server.hackDifficulty = server.minDifficulty;
    let maxMoney = server.moneyMax;
    server.moneyAvailable = maxMoney;

    let hackAmtPerThread = 0;
    try {
        hackAmtPerThread = ns.formulas.hacking.hackPercent(server, player);
    } catch {
        hackAmtPerThread = ns.hackAnalyze(target);
    }
    if (hackAmtPerThread <= 0) return null;

    let tHack = Math.floor(steal / hackAmtPerThread);
    if (tHack === 0) {
        tHack = 1;
        steal = hackAmtPerThread;
    }

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);

    server.moneyAvailable = maxMoney * (1 - steal);

    let tGrow = 0;
    try {
        tGrow = ns.formulas.hacking.growThreads(server, player, maxMoney);
    } catch {
        let growMult = 1 / (1 - steal);
        tGrow = ns.growthAnalyze(target, growMult);
    }

    // Safety Padding Grow: Kalau hack level kecil, grow sering fluktuatif, kita bengkakkan 5%
    tGrow = Math.ceil(tGrow * 1.05);
    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tWeak1, tGrow, tWeak2 };
}

// =====================================
// HELPER: MENCARI OTOMATIS TARGET TERBAIK (RATIO MONEY/TIME)
// =====================================
function getBestTarget(ns) {
    let best = "n00dles";
    let bestScore = 0;

    for (let s of getWorkers(ns)) {
        if (!ns.hasRootAccess(s)) continue;

        let maxMoney = ns.getServerMaxMoney(s);
        if (maxMoney <= 0) continue;

        // Jangan menargetkan server militer endgame jika Hacking Level kita masih terlalu rendah
        // Karena waktu tempuhnya akan menjadi puluhan menit dan merusak siklus udara HWGW
        let requiredHack = ns.getServerRequiredHackingLevel(s);
        if (requiredHack > ns.getHackingLevel() / 2) continue; // Hanya target server yang bisa kita kuasai dengan cepat

        let weakenTime = ns.getWeakenTime(s);
        let score = maxMoney / weakenTime;

        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }

    return best;
}
