/** @param {NS} ns **/

const LIMIT = 25;
const LEAP_FACTOR = 8;       // Syarat lompatan: RAM baru minimal 8x lipat lebih besar dari server lama (untuk menghindari pemborosan siklus x2)
const MIN_BUY_RAM = 8;       // Minimal eksekusi server awal

// 1048576 GB = 1 Petabyte (PB). Batas waras sebelum semua uang disuntik ke pasar saham.
const MAX_RAM_CAP = 1048576;

export async function manageServers(ns) {

    // 1. Membaca sabda dari Orchestrator (Aturan Budgeting Fase)
    let config = { serverBudget: 0.25, enableServerBuy: true, enableServerUpgrade: true };
    if (ns.fileExists("/pro-v1/config.txt")) {
        try {
            let parsed = JSON.parse(ns.read("/pro-v1/config.txt"));
            config.serverBudget = parsed.serverBudget !== undefined ? parsed.serverBudget : 0.25;
            config.enableServerBuy = parsed.enableServerBuy !== undefined ? parsed.enableServerBuy : true;
            config.enableServerUpgrade = parsed.enableServerUpgrade !== undefined ? parsed.enableServerUpgrade : true;
        } catch (e) { }
    }

    let money = ns.getServerMoneyAvailable("home");
    // "Uang Panas" yang diizinkan untuk dibakar membeli server
    let usableMoney = money * config.serverBudget;

    let servers = ns.getPurchasedServers();

    // ===============================================
    // CARI KEMAMPUAN DANA MAXIMUM KITA SEKARANG
    // ===============================================
    let maxAffordableRam = getBestRam(ns, usableMoney);

    // Paksa patuhi Plafon Atas (Pecah limit max ke 1PB)
    if (maxAffordableRam > MAX_RAM_CAP) maxAffordableRam = MAX_RAM_CAP;

    if (maxAffordableRam < MIN_BUY_RAM) return; // Terlalu miskin untuk beli apa-apa
    let cost = ns.getPurchasedServerCost(maxAffordableRam);


    // ===============================================
    // FASE 1: BELI SERVER BARU (Jika kuota 25 slot belum penuh)
    // ===============================================
    if (servers.length < LIMIT) {
        if (!config.enableServerBuy) return;

        // Jangan membeli recehan jika sudah mid-game (misal kita sudah sanggup beli Terabyte)
        let name = "pserv-" + servers.length;

        ns.purchaseServer(name, maxAffordableRam);
        ns.tprint(`🟢 [Leapfrog] Membeli server baru: ${name} dengan Kapasitas ${ns.formatRam(maxAffordableRam)} (Bakar: $${ns.formatNumber(cost)})`);
        return;
    }


    // ===============================================
    // FASE 2: LEAPFROGGING UPGRADE
    // ===============================================
    if (!config.enableServerUpgrade) return;

    let smallest = null;
    let smallestRam = Infinity;

    // Cari target server paling cupu (paling kecil) di jaringan
    for (let s of servers) {
        let ram = ns.getServerMaxRam(s);
        if (ram < smallestRam) {
            smallestRam = ram;
            smallest = s;
        }
    }

    // Jika server paling cupu kita saja kapasitasnya sudah mencapai plafon MAX (Misal 1 PB), ngapain capek-capek cari ganti? Tamat.
    if (smallestRam >= MAX_RAM_CAP) return;

    // LEAPFROG LOGIC INTI:
    // Apakah "Kemampuan Beli Tertinggi" kita saat ini jauh lebih kuat dari server paling lemah?
    // Kita menuntut minimal lompat LEAP_FACTOR (misal: 8x lipat). 
    // Kecuali jika uang kita mencium batas MAX_RAM_CAP (mentok plafon) dan RAM itu lebih besar dari server lama, hajar saja sisa *gap*-nya!
    let targetLompatanMinimum = smallestRam * LEAP_FACTOR;

    if (maxAffordableRam >= targetLompatanMinimum || (maxAffordableRam === MAX_RAM_CAP && maxAffordableRam > smallestRam)) {

        // Peringatan Eksekusi Mati (cabut nyawa semua script di server tumbal)
        ns.killall(smallest);
        ns.deleteServer(smallest);

        // Lahirkan kembali ia di raga yang lebih epik
        ns.purchaseServer(smallest, maxAffordableRam);

        let oldFormat = ns.formatRam(smallestRam);
        let newFormat = ns.formatRam(maxAffordableRam);
        ns.tprint(`� [MEGA LOMPATAN] 🪦 Menumbalkan ${smallest} (${oldFormat}) -> 💫 Reinkarnasi wujud baru: ${newFormat} (Bakar Anggaran: $${ns.formatNumber(cost)})`);
    }
}


/** Mengembalikan Ukuran RAM Terbesar yang Sanggup Dibeli Dompet Kita */
function getBestRam(ns, money) {
    let ram = 8;
    let max = ns.getPurchasedServerMaxRam();

    // Uji terus dikali 2 hingga mentok dompet atau mentok standar dewa game
    while (ram * 2 <= max) {
        let cost = ns.getPurchasedServerCost(ram * 2);
        if (cost > money) break;
        ram *= 2;
    }

    // Pengaman pelit (kalau beli 8GB aja belum sanggup)
    if (ns.getPurchasedServerCost(ram) > money) return 0;

    return ram;
}