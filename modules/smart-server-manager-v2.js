/** @param {NS} ns **/

const CONFIG = {
    LIMIT_SERVERS: 25,
    MAX_RAM_CAP: 1048576,        // 1 PB Batasan RAM
    MIN_BUY_RAM: 8,              // Pembelian minimal (Gb)
    UTILIZATION_TRIGGER: 0.75,   // Beli/Upgrade hanya jika 75% RAM jaringan saat ini terpakai
    RESERVE_PERCENT: 0.10,       // Selalu sisakan 10% cash di home
    BUDGET_PERCENT: 0.25,        // Max 25% dari total uang tunai boleh dibakar sekali jalan
    COMPARE_TO_HOME: 0.10,       // Upgrade dilarang jika server baru < 10% RAM Home (agar upgrade berarti)
    BOOTSTRAP_THRESHOLD: 6,      // Di bawah N server, abaikan COMPARE_TO_HOME & MIN_BUY_RAM (Early-Game Mode!)
};

export async function manageServers(ns) {
    // 1. Baca Konfigurasi Eksternal (Orchestrator V1 API)
    let extConfig = { enableServerBuy: true, enableServerUpgrade: true };
    if (ns.fileExists("/pro-v1/config.txt")) {
        try {
            let parsed = JSON.parse(ns.read("/pro-v1/config.txt"));
            extConfig.enableServerBuy = parsed.enableServerBuy !== undefined ? parsed.enableServerBuy : true;
            extConfig.enableServerUpgrade = parsed.enableServerUpgrade !== undefined ? parsed.enableServerUpgrade : true;
        } catch (e) { }
    }

    if (!extConfig.enableServerBuy && !extConfig.enableServerUpgrade) return;

    let servers = ns.getPurchasedServers();

    // ===============================================
    // FASE 1: SENSOR UTILITAS (Apakah kita benar-benar butuh RAM?)
    // ===============================================
    let allRooted = scanAllRooted(ns);
    let totalMaxRam = 0;
    let totalUsedRam = 0;

    for (let s of allRooted) {
        // Jangan hitung Hacknet Node yang tidak dipakai untuk script
        if (s.startsWith("hacknet-") && ns.getServerUsedRam(s) === 0) continue;

        totalMaxRam += ns.getServerMaxRam(s);
        totalUsedRam += ns.getServerUsedRam(s);
    }

    let utilizationRate = totalMaxRam > 0 ? (totalUsedRam / totalMaxRam) : 0;

    // Jika RAM jaringan masih longgar (di bawah trigger), simpan uangnya!
    if (utilizationRate < CONFIG.UTILIZATION_TRIGGER) {
        ns.print(`⏳ Menunda: Beban RAM ${(utilizationRate * 100).toFixed(1)}% (Batas: ${(CONFIG.UTILIZATION_TRIGGER * 100).toFixed(1)}%)`);
        return;
    }

    // ===============================================
    // FASE 2: KALKULASI UANG & BATAS BELI
    // ===============================================
    let money = ns.getServerMoneyAvailable("home");
    let reserve = money * CONFIG.RESERVE_PERCENT;
    let budget = money * CONFIG.BUDGET_PERCENT;
    let spendable = Math.min(budget, money - reserve);

    if (spendable <= 0) {
        ns.print(`⏳ Menunda: Dana tidak cukup. Uang saat ini (Budget ${CONFIG.BUDGET_PERCENT * 100}%): $${ns.formatNumber(spendable)}`);
        return;
    }

    // Cari RAM Max yang masuk akal dibeli dengan uang 'Spendable'
    let maxAffordableRam = getBestRam(ns, spendable);

    // Mode Bootstrap: jika server masih sedikit, abaikan batas COMPARE_TO_HOME & MIN_BUY_RAM
    // Ini mengatasi masalah pasca-reset saat Home sudah besar tapi kantong masih kosong!
    let isBootstrap = servers.length < CONFIG.BOOTSTRAP_THRESHOLD;

    if (!isBootstrap) {
        // Pengaman ukuran RAM wajar (hanya berlaku di luar mode bootstrap)
        if (maxAffordableRam > CONFIG.MAX_RAM_CAP) maxAffordableRam = CONFIG.MAX_RAM_CAP;
        if (maxAffordableRam < CONFIG.MIN_BUY_RAM) {
            ns.print(`⏳ Menunda: Uang $${ns.formatNumber(spendable)} tidak cukup beli server min ${ns.formatRam(CONFIG.MIN_BUY_RAM)}.`);
            return;
        }

        // Pengaman agar tidak membeli barang receh saat kita sudah punya Home canggih
        let homeRam = ns.getServerMaxRam("home");
        if (maxAffordableRam < homeRam * CONFIG.COMPARE_TO_HOME) {
            ns.print(`⏳ Menunda: Max beli (${ns.formatRam(maxAffordableRam)}) < 10% Home (${ns.formatRam(homeRam)}). Beli ini sia-sia!`);
            return;
        }
    } else {
        // Mode Bootstrap: beli apa pun yang sanggup dibeli >= 8 GB
        if (maxAffordableRam < 8) {
            ns.print(`⏳ Bootstrap: Uang belum cukup beli server 8 GB. Waiting...`);
            return;
        }
        ns.print(`🌱 Mode BOOTSTRAP aktif (${servers.length}/${CONFIG.BOOTSTRAP_THRESHOLD} server). Beli apa pun yang sanggup!`);
    }

    let cost = ns.getPurchasedServerCost(maxAffordableRam);

    // ===============================================
    // FASE 3: BELI SERVER BARU (Bila Kuota Belum Penuh)
    // ===============================================
    if (servers.length < CONFIG.LIMIT_SERVERS) {
        if (!extConfig.enableServerBuy) return;

        let name = "pserv-" + servers.length;
        let pserv = ns.purchaseServer(name, maxAffordableRam);
        if (pserv) {
            ns.tprint(`🟢 [Smart-Host] Membeli server ${name} (${ns.formatRam(maxAffordableRam)}) | Pakai: ${(utilizationRate * 100).toFixed(1)}% | Harga: $${ns.formatNumber(cost)}`);
        }
        return;
    }

    // ===============================================
    // FASE 4: UPGRADE SERVER LAMA (Tanpa Kill Script)
    // ===============================================
    if (!extConfig.enableServerUpgrade) return;

    let worstServer = null;
    let worstRam = Infinity;

    for (let s of servers) {
        let r = ns.getServerMaxRam(s);
        if (r < worstRam) {
            worstRam = r;
            worstServer = s;
        }
    }

    // Jika server paling jelek kita sudah mentok batas, tamat.
    if (worstRam >= CONFIG.MAX_RAM_CAP) return;

    // Pastikan kita tidak "Upgrade" (membayar uang) untuk mendapatkan kapasitas yang SAMA ATAU LEBIH KECIL
    if (maxAffordableRam <= worstRam) return;

    // Kalkulasi Biaya Upgrade
    // ns.getPurchasedServerUpgradeCost(hostname, ram) ada di patch terbaru
    let upgradeCost = ns.getPurchasedServerUpgradeCost(worstServer, maxAffordableRam);

    if (spendable >= upgradeCost) {
        if (ns.upgradePurchasedServer(worstServer, maxAffordableRam)) {
            ns.tprint(`🚀 [Smart-Host] Upgrade MULUS: ${worstServer} (${ns.formatRam(worstRam)} -> ${ns.formatRam(maxAffordableRam)}) | Pakai: ${(utilizationRate * 100).toFixed(1)}% | Biaya: $${ns.formatNumber(upgradeCost)}`);
        }
    }
}

/** Utility: Mengembalikan RAM Terbesar (Eksponen Pangkat 2) yang Sanggup Dibeli */
function getBestRam(ns, money) {
    let ram = 2; // Mulai dari 2GB
    let max = ns.getPurchasedServerMaxRam();

    while (ram * 2 <= max) {
        if (ns.getPurchasedServerCost(ram * 2) > money) break;
        ram *= 2;
    }

    if (ns.getPurchasedServerCost(ram) > money) return 0;
    return ram;
}

/** Utility: Dapatkan SEMUA server yang sudah ada rute Root Access nya */
function scanAllRooted(ns) {
    let visited = new Set(["home"]);
    let queue = ["home"];

    while (queue.length > 0) {
        let current = queue.shift();
        let neighbors = ns.scan(current);

        for (let next of neighbors) {
            if (!visited.has(next)) {
                visited.add(next);
                queue.push(next);
            }
        }
    }

    let rooted = [];
    for (let s of visited) {
        if (ns.hasRootAccess(s)) rooted.push(s);
    }
    return rooted;
}
