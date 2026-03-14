/** @param {NS} ns **/
// ============================================================
// CORP STARTER - Versi Ringan untuk Early Game (RAM ~50-80 GB)
// Hanya fungsi Corp esensial untuk setup awal Agriculture.
// Setelah Corp berkembang & RAM cukup, beralih ke corp-master.js
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const C = ns.corporation;

    const AG_DIV = ns.args[0] || "Agro"; // Sesuaikan nama divisi Anda!
    const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

    ns.print("=============================================");
    ns.print("  🏢 CORP STARTER (Lightweight) ");
    ns.print(`  Divisi: ${AG_DIV}`);
    ns.print("=============================================");

    // === SETUP SEKALI JALAN ===

    // 1. Buat Corp jika belum ada
    if (!C.hasCorporation()) {
        C.createCorporation("NativeStar Corp", true);
        ns.print("✅ Corporation dibuat!");
        await ns.sleep(500);
    }

    // 2. Buka Agriculture jika belum ada
    let corp = C.getCorporation();
    if (!corp.divisions.includes(AG_DIV)) {
        C.expandIndustry("Agriculture", AG_DIV);
        ns.print(`✅ Divisi ${AG_DIV} dibuka!`);
        await ns.sleep(500);
    }

    // 3. Ekspansi & setup semua kota (sekali)
    corp = C.getCorporation();
    for (let city of CITIES) {
        // Expand kota
        try { C.expandCity(AG_DIV, city); } catch { }
        // Beli warehouse
        try { C.purchaseWarehouse(AG_DIV, city); } catch { }
        await ns.sleep(100);
    }

    // 4. Unlock Smart Supply (coba saja, jika dana cukup)
    try { C.purchaseUnlock("Smart Supply"); ns.print("🤖 Smart Supply unlocked!"); } catch { }

    ns.print("\n✅ Setup selesai! Masuk loop manajemen...\n");

    // === LOOP UTAMA ===
    while (true) {
        await ns.sleep(10000); // 1 tick = 10 detik

        corp = C.getCorporation();
        ns.clearLog();
        ns.print("=============================================");
        ns.print("  🏢 CORP STARTER (Lightweight)");
        ns.print("=============================================");
        ns.print(`💰 Dana    : $${ns.formatNumber(corp.funds)}`);
        ns.print(`📈 Revenue : $${ns.formatNumber(corp.revenue)}/s`);

        // Hire karyawan baru jika ada slot kosong
        hireBasicEmployees(ns, C, AG_DIV, CITIES);

        // Set harga jual otomatis
        setSellingPrices(ns, C, AG_DIV, CITIES);

        // Beli material produksi dasar
        buyBasicMaterials(ns, C, AG_DIV, CITIES, corp.funds);

        // Info manual
        let offer = C.getInvestmentOffer();
        ns.print(`\n💼 Investment Offer: $${ns.formatNumber(offer.funds)} (Round ${offer.round})`);
        if (offer.funds >= 210e9) {
            ns.print("🚨 OFFER >= $210B! Pertimbangkan ACCEPT di game secara manual!");
            ns.print("   Lalu matikan script ini dan jalankan corp-master.js");
        }
    }
}

function hireBasicEmployees(ns, C, divName, cities) {
    for (let city of cities) {
        // Cukup hire saja, tanpa cek atau resize office
        // (lebih hemat RAM dibanding getOffice + upgradeOfficeSize)
        for (let i = 0; i < 3; i++) {
            try { C.hireEmployee(divName, city, "Unassigned"); } catch { break; }
        }
    }
}

function setSellingPrices(ns, C, divName, cities) {
    for (let city of cities) {
        try { C.sellMaterial(divName, city, "Food", "MAX", "MP"); } catch { }
        try { C.sellMaterial(divName, city, "Plants", "MAX", "MP"); } catch { }
    }
}

function buyBasicMaterials(ns, C, divName, cities, funds) {
    // Beli material produksi dasar hanya jika dana mencukupi
    if (funds < 1e9) return; // Skip jika dana < $1M (terlalu miskin)

    // Target minimal Phase 1
    const targets = { "Hardware": 125, "Robots": 75, "AI Cores": 75, "Real Estate": 27000 };
    let buyPerSec = 10; // Beli 10 unit/detik (konservatif)

    for (let city of cities) {
        for (let [mat, _] of Object.entries(targets)) {
            try { C.buyMaterial(divName, city, mat, buyPerSec); } catch { }
        }
    }
}
