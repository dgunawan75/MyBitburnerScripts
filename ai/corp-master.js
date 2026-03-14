/** @param {NS} ns **/
// ============================================================
// CORP MASTER - Auto Corporation Manager (BN3 Corporatocracy)
// Fase 1: Setup Agriculture (semua 6 kota)
// Fase 2: Beli material produksi + naikkan level employee
// Fase 3: Accept Investment Round 1 & 2
// Fase 4: Ekspansi ke Tobacco (mesin uang utama)
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const C = ns.corporation; // shorthand

    const CORP_NAME = "NativeStar Corp";
    const AG_DIV = "Agro";     // Nama divisi Agriculture
    const TOB_DIV = "Smokeware"; // Nama divisi Tobacco
    const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

    // Target material yang harus ada di setiap kota (mengikuti panduan komunitas BN3)
    const MAT_PHASE1 = { Hardware: 125, Robots: 75, "AI Cores": 75, "Real Estate": 27000 };
    const MAT_PHASE2 = { Hardware: 2800, Robots: 96, "AI Cores": 2520, "Real Estate": 146400 };

    // Round Investment:
    const INVEST_R1_MIN = 210e9;   // $210 Miliar
    const INVEST_R2_MIN = 5e12;    // $5 Triliun

    ns.print("=============================================");
    ns.print("  🏢 CORP MASTER - BN3 AGRICULTURE ENGINE  ");
    ns.print("=============================================");

    // ============================================================
    // LANGKAH 1: Buat Corporation jika belum ada
    // ============================================================
    if (!C.hasCorporation()) {
        ns.print("📋 Membuat Corporation baru...");
        // selfFund = true (gratis di BN3!)
        const ok = C.createCorporation(CORP_NAME, true);
        if (!ok) {
            // Jika tidak bisa selfFund (BN lain), coba tanpa
            ns.print("⚠️ Self-fund gagal, coba tanpa self-fund...");
            C.createCorporation(CORP_NAME, false);
        }
        ns.print(`✅ Corporation "${CORP_NAME}" berhasil dibuat!`);
        await ns.sleep(1000);
    }

    // ============================================================
    // LANGKAH 2: Buka Divisi Agriculture
    // ============================================================
    let corpData = C.getCorporation();
    if (!corpData.divisions.includes(AG_DIV)) {
        ns.print(`🌾 Membuka divisi Agriculture: "${AG_DIV}"...`);
        C.expandIndustry("Agriculture", AG_DIV);
        await ns.sleep(500);
    }

    // ============================================================
    // LANGKAH 3: Ekspansi ke semua 6 kota
    // ============================================================
    let div = C.getDivision(AG_DIV);
    for (let city of CITIES) {
        if (!div.cities.includes(city)) {
            ns.print(`🗺️ Ekspansi ke ${city}...`);
            C.expandCity(AG_DIV, city);
            await ns.sleep(200);
        }
    }

    // ============================================================
    // LANGKAH 4: Beli Warehouse di semua kota
    // ============================================================
    for (let city of CITIES) {
        try {
            let wh = C.getWarehouse(AG_DIV, city);
            if (!wh) {
                ns.print(`📦 Beli Warehouse di ${city}...`);
                C.purchaseWarehouse(AG_DIV, city);
            }
        } catch {
            ns.print(`📦 Beli Warehouse di ${city}...`);
            C.purchaseWarehouse(AG_DIV, city);
        }
        await ns.sleep(100);
    }

    // ============================================================
    // LANGKAH 5: Unlock Smart Supply (prioritas!)
    // ============================================================
    try {
        const smartSupplyCost = C.getUnlockCost("Smart Supply");
        if (C.getCorporation().funds >= smartSupplyCost) {
            C.purchaseUnlock("Smart Supply");
            ns.print("🤖 Smart Supply UNLOCKED!");
        }
    } catch { /* Already unlocked */ }

    // ============================================================
    // LOOP UTAMA
    // ============================================================
    let phase = 1;
    let tobaccoStarted = false;

    while (true) {
        await ns.sleep(10000); // 1 tick Corp = ~10 detik

        ns.clearLog();
        let corp = C.getCorporation();
        let revenue = corp.revenue;
        let funds = corp.funds;

        ns.print("=============================================");
        ns.print("  🏢 CORP MASTER - FASE " + phase);
        ns.print("=============================================");
        ns.print(`💰 Dana      : $${ns.formatNumber(funds)}`);
        ns.print(`📈 Revenue   : $${ns.formatNumber(revenue)}/s`);
        ns.print(`🏭 Divisi    : ${corp.divisions.join(", ")}`);

        // --- Smart Supply per kota ---
        for (let city of CITIES) {
            try {
                C.setSmartSupply(AG_DIV, city, true);
            } catch { /* Belum unlock atau sudah aktif */ }
        }

        // --- Set Sell Price otomatis ---
        setSellPrices(ns, C, AG_DIV, CITIES);

        // --- Hire & assign karyawan ---
        manageEmployees(ns, C, AG_DIV, CITIES, phase);

        // --- Upgrade Warehouse ---
        upgradeWarehouses(ns, C, AG_DIV, CITIES, funds, phase);

        // --- Beli Upgrade Corp ---
        buyCorporateUpgrades(ns, C, funds);

        // --- Beli Material Produksi ---
        let matTarget = phase >= 2 ? MAT_PHASE2 : MAT_PHASE1;
        await buyProductionMaterials(ns, C, AG_DIV, CITIES, matTarget);

        // --- Cek Investment ---
        let offer = C.getInvestmentOffer();
        if (phase === 1 && offer.funds >= INVEST_R1_MIN) {
            ns.print(`\n🤝 ACCEPT INVESTMENT ROUND 1! ($${ns.formatNumber(offer.funds)})`);
            C.acceptInvestmentOffer();
            phase = 2;
            ns.print("🚀 MASUK FASE 2! Mulai skalakan Agriculture lebih besar.");
        } else if (phase === 2 && offer.funds >= INVEST_R2_MIN) {
            ns.print(`\n🤝 ACCEPT INVESTMENT ROUND 2! ($${ns.formatNumber(offer.funds)})`);
            C.acceptInvestmentOffer();
            phase = 3;
        }

        // --- Buka Tobacco di Fase 3 ---
        if (phase >= 3 && !tobaccoStarted) {
            tobaccoStarted = startTobaccoDivision(ns, C, TOB_DIV, CITIES);
        }

        // Info investment target
        if (phase < 3) {
            let target = phase === 1 ? INVEST_R1_MIN : INVEST_R2_MIN;
            ns.print(`\n⏳ Menunggu Offer ≥ $${ns.formatNumber(target)}`);
            ns.print(`   Offer saat ini: $${ns.formatNumber(offer.funds)} (Round ${offer.round})`);
        }
    }
}

// ============================================================
// HELPER: Set harga jual otomatis (MP = Market Price dinamis)
// ============================================================
function setSellPrices(ns, C, divName, cities) {
    const mats = ["Food", "Plants"];
    for (let city of cities) {
        for (let mat of mats) {
            try {
                C.sellMaterial(divName, city, mat, "MAX", "MP");
            } catch { /* Material belum diproduksi */ }
        }
    }
}

// ============================================================
// HELPER: Manajemen Karyawan per Fase
// ============================================================
function manageEmployees(ns, C, divName, cities, phase) {
    // Target komposisi karyawan per fase
    const COMP_PHASE1 = { "Operations": 1, "Engineer": 1, "Business": 1 };
    const COMP_PHASE2 = { "Operations": 2, "Engineer": 2, "Business": 2, "Management": 1, "Research & Development": 2 };

    let target = phase >= 2 ? COMP_PHASE2 : COMP_PHASE1;
    let totalNeeded = Object.values(target).reduce((a, b) => a + b, 0);

    for (let city of cities) {
        try {
            let office = C.getOffice(divName, city);

            // Expand office jika perlu
            if (office.size < totalNeeded) {
                let expand = totalNeeded - office.size;
                try {
                    C.upgradeOfficeSize(divName, city, expand);
                } catch { /* Dana tidak cukup */ }
            }

            // Hire sampai penuh
            let hired = office.employees.length;
            while (hired < office.size) {
                try {
                    C.hireEmployee(divName, city, "Unassigned");
                    hired++;
                } catch { break; }
            }

            // Auto-assign karyawan (pakai API baru jika ada)
            try {
                C.setAutoJobAssignment(divName, city, "Operations", target["Operations"] || 0);
                C.setAutoJobAssignment(divName, city, "Engineer", target["Engineer"] || 0);
                C.setAutoJobAssignment(divName, city, "Business", target["Business"] || 0);
                C.setAutoJobAssignment(divName, city, "Management", target["Management"] || 0);
                C.setAutoJobAssignment(divName, city, "Research & Development", target["Research & Development"] || 0);
            } catch {
                /* API lama — skip auto assignment */
            }
        } catch { /* Skip kota yang belum siap */ }
    }
}

// ============================================================
// HELPER: Upgrade Warehouse Level
// ============================================================
function upgradeWarehouses(ns, C, divName, cities, funds, phase) {
    let targetLevel = phase >= 2 ? 10 : 3;
    for (let city of cities) {
        try {
            let wh = C.getWarehouse(divName, city);
            if (wh.level < targetLevel) {
                let cost = C.getUpgradeWarehouseCost(divName, city, 1);
                if (funds > cost * 3) { // Pastikan tidak habiskan semua dana
                    C.upgradeWarehouse(divName, city, 1);
                    funds -= cost;
                }
            }
        } catch { }
    }
}

// ============================================================
// HELPER: Beli Upgrade Corp dalam Prioritas
// ============================================================
function buyCorporateUpgrades(ns, C, funds) {
    const PRIORITY_UPGRADES = [
        "FocusWires",
        "Neural Accelerators",
        "Speech Processor Implants",
        "Nuoptimal Nootropic Injector Implants",
        "Smart Factories",
        "Smart Storage",
        "Wilson Analytics",
        "ABC SalesBots",
        "Project Insight",
    ];

    for (let upg of PRIORITY_UPGRADES) {
        try {
            let cost = C.getUpgradeLevelCost(upg);
            if (funds >= cost * 2) { // Beli jika punya 2× lipat biaya (safety)
                C.buyUpgrade(upg);
                funds -= cost;
            }
        } catch { }
    }
}

// ============================================================
// HELPER: Beli Material Produksi (Pulse Buy per tick)
// ============================================================
async function buyProductionMaterials(ns, C, divName, cities, targets) {
    for (let city of cities) {
        for (let [mat, targetQty] of Object.entries(targets)) {
            try {
                let current = C.getMaterial(divName, city, mat).qty;
                if (current < targetQty * 0.95) {
                    let needed = targetQty - current;
                    let buyPerSec = needed / 10; // 1 tick = 10 detik
                    C.buyMaterial(divName, city, mat, buyPerSec);
                } else {
                    C.buyMaterial(divName, city, mat, 0); // Stop beli jika sudah cukup
                }
            } catch { }
        }
    }

    // Tunggu 1 tick agar pembelian terealisasi
    await ns.sleep(10000);

    // Stop semua pembelian
    for (let city of cities) {
        for (let mat of Object.keys(targets)) {
            try { C.buyMaterial(divName, city, mat, 0); } catch { }
        }
    }
}

// ============================================================
// HELPER: Mulai Divisi Tobacco
// ============================================================
function startTobaccoDivision(ns, C, tobDiv, cities) {
    try {
        let corp = C.getCorporation();
        if (corp.divisions.includes(tobDiv)) return true;

        // Cek dana cukup? Tobacco butuh ~$20B untuk ekspansi
        if (corp.funds < 20e9) {
            ns.print("⏳ Menunggu dana untuk buka Tobacco ($20B)...");
            return false;
        }

        ns.print("🚬 Membuka divisi Tobacco...");
        C.expandIndustry("Tobacco", tobDiv);

        for (let city of cities) {
            try { C.expandCity(tobDiv, city); } catch { }
        }

        ns.print("✅ Divisi Tobacco dibuka! Sekarang buat Produk pertama.");
        return true;
    } catch (e) {
        ns.print(`⚠️ Tobacco error: ${e}`);
        return false;
    }
}
