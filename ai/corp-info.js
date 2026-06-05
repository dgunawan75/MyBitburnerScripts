/** @param {NS} ns **/
// ============================================================
// corp-info.js — Diagnostik & Kalibrasi Corp (BN3 v3.0.1)
// Jalankan sekali setelah game reset / sebelum corp-next.js
// Output ke terminal untuk analisis oleh AI assistant
// ============================================================
export async function main(ns) {
    const C = ns.corporation;

    ns.tprint("\n");
    ns.tprint("╔══════════════════════════════════════════════════════╗");
    ns.tprint("║       CORP DIAGNOSTICS — BN3 CALIBRATION TOOL       ║");
    ns.tprint("╚══════════════════════════════════════════════════════╝");

    // ──────────────────────────────────────────────────────────
    // SECTION 1: KONSTANTA GAME
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 1] KONSTANTA & BIAYA KORPORASI");
    ns.tprint("─────────────────────────────────────────────────────");

    // Coba ambil konstanta via getConstants() jika tersedia
    try {
        const K = C.getConstants();
        ns.tprint("✅ getConstants() tersedia:");
        ns.tprint(JSON.stringify(K, null, 2));
    } catch {
        ns.tprint("⚠️ getConstants() tidak tersedia — menggunakan metode alternatif");
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 2: BIAYA UNLOCK
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 2] BIAYA UNLOCK (one-time purchases)");
    ns.tprint("─────────────────────────────────────────────────────");

    const UNLOCKS = [
        "Smart Supply", "Market Research - Demand",
        "Market Data - Competition", "VeChain",
        "Shady Accounting", "Government Partnership",
        "Warehouse API", "Office API",
    ];
    for (let u of UNLOCKS) {
        try {
            const cost = C.getUnlockCost(u);
            ns.tprint(`  ${u.padEnd(35)} : $${ns.format.number(cost)}`);
        } catch {
            ns.tprint(`  ${u.padEnd(35)} : (tidak tersedia / sudah unlock)`);
        }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 3: BIAYA UPGRADE LEVEL 0 → 1
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 3] BIAYA UPGRADE KORPORASI (Level 0 → 1)");
    ns.tprint("─────────────────────────────────────────────────────");

    const UPGRADES = [
        "FocusWires", "Neural Accelerators",
        "Speech Processor Implants", "Nuoptimal Nootropic Injector Implants",
        "Smart Factories", "Smart Storage",
        "Wilson Analytics", "ABC SalesBots", "Project Insight",
    ];
    for (let u of UPGRADES) {
        try {
            const lvl  = C.getUpgradeLevel(u);
            const cost = C.getUpgradeLevelCost(u);
            ns.tprint(`  ${u.padEnd(42)} Lvl.${lvl} | Next: $${ns.format.number(cost)}`);
        } catch {
            ns.tprint(`  ${u.padEnd(42)} : ERROR`);
        }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 4: INFO MATERIAL (ukuran per unit)
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 4] UKURAN MATERIAL PER UNIT (warehouse space)");
    ns.tprint("─────────────────────────────────────────────────────");

    const MATERIALS = [
        "Water", "Food", "Plants", "Metal", "Hardware",
        "Chemicals", "Drugs", "Robots", "AI Cores",
        "Real Estate", "Minerals",
    ];

    // Coba getMaterialData() jika tersedia (v3+)
    let matDataAvail = false;
    for (let mat of MATERIALS) {
        try {
            const data = C.getMaterialData(mat);
            if (!matDataAvail) {
                ns.tprint("✅ getMaterialData() tersedia:");
                matDataAvail = true;
            }
            ns.tprint(`  ${mat.padEnd(18)} : size=${data.size ?? "?"} | tradeVolume=${data.tradeVolume ?? "?"}`);
        } catch {
            if (!matDataAvail) {
                ns.tprint("⚠️ getMaterialData() tidak tersedia");
                break;
            }
        }
    }

    if (!matDataAvail) {
        ns.tprint("   (Ukuran material tidak bisa diambil via API di versi ini)");
        ns.tprint("   Nilai default yang dipakai corp-next.js:");
        ns.tprint("   Water=0.05 Food=0.03 Plants=0.05 Hardware=0.06");
        ns.tprint("   Robots=0.5 AICores=0.1 RealEstate=0.005 Metal=0.1");
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 5: INFO KORPORASI (jika sudah ada)
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 5] STATUS KORPORASI SAAT INI");
    ns.tprint("─────────────────────────────────────────────────────");

    if (!C.hasCorporation()) {
        ns.tprint("  ❌ Korporasi belum dibuat.");
        ns.tprint("  ℹ️ Buat dulu dengan: C.createCorporation(name, true)");
        ns.tprint("     lalu jalankan ulang script ini untuk info lebih lengkap.");
        return;
    }

    const corp = C.getCorporation();
    ns.tprint(`  Nama       : ${corp.name}`);
    ns.tprint(`  Dana       : $${ns.format.number(corp.funds)}`);
    ns.tprint(`  Revenue    : $${ns.format.number(corp.revenue)}/s`);
    ns.tprint(`  Expenses   : $${ns.format.number(corp.expenses)}/s`);
    ns.tprint(`  Divisi     : ${corp.divisions.join(", ") || "(belum ada)"}`);
    ns.tprint(`  Total Saham: ${ns.format.number(corp.totalShares)}`);

    // Cek investment offer
    try {
        const offer = C.getInvestmentOffer();
        ns.tprint(`\n  💰 Inv.Offer: $${ns.format.number(offer.funds)} (Round ${offer.round})`);
        ns.tprint(`     Shares   : ${ns.format.number(offer.shares)}`);
    } catch {
        ns.tprint("  ⚠️ Tidak bisa mengambil investment offer");
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 6: INFO DIVISI & WAREHOUSE (jika sudah ada divisi)
    // ──────────────────────────────────────────────────────────
    for (let divName of corp.divisions) {
        ns.tprint(`\n📌 [SECTION 6] DIVISI: "${divName}"`);
        ns.tprint("─────────────────────────────────────────────────────");

        const div = C.getDivision(divName);
        ns.tprint(`  Tipe    : ${div.type}`);
        ns.tprint(`  Kota    : ${div.cities.join(", ")}`);

        for (let city of div.cities) {
            ns.tprint(`\n  🏙️ ${city}:`);

            // Warehouse info
            try {
                const wh = C.getWarehouse(divName, city);
                ns.tprint(`    Warehouse : Level ${wh.level} | Size ${ns.format.number(wh.size)} | Used ${ns.format.number(wh.sizeUsed)}`);

                // Cek biaya upgrade warehouse berikutnya
                try {
                    const upgCost = C.getUpgradeWarehouseCost(divName, city, 1);
                    ns.tprint(`    WH Upg+1  : $${ns.format.number(upgCost)}`);
                } catch {}
            } catch {
                ns.tprint("    Warehouse : Belum dibeli");
            }

            // Office info
            try {
                const off = C.getOffice(divName, city);
                ns.tprint(`    Office    : Size ${off.size} | Karyawan ${off.employees.length}`);
                ns.tprint(`    Salary    : $${ns.format.number(off.totalSalary || 0)}/s`);

                // Office upgrade cost
                try {
                    const offUpgCost = C.getOfficeSizeUpgradeCost(divName, city, 3);
                    ns.tprint(`    OffUpg+3  : $${ns.format.number(offUpgCost)}`);
                } catch {}
            } catch {}

            // Material info
            const PROD_MATS = ["Hardware", "Robots", "AI Cores", "Real Estate"];
            const OUT_MATS  = ["Food", "Plants"];
            const IN_MATS   = ["Water", "Chemicals"];

            ns.tprint("    Material (output):");
            for (let mat of OUT_MATS) {
                try {
                    const m = C.getMaterial(divName, city, mat);
                    ns.tprint(`      ${mat.padEnd(14)}: stored=${ns.format.number(m.stored)} prod=${m.productionAmount?.toFixed(3)}/s sell=${m.actualSellAmount?.toFixed(3)}/s MP=$${ns.format.number(m.marketPrice)}`);
                } catch {}
            }
            ns.tprint("    Material (input/Smart Supply):");
            for (let mat of IN_MATS) {
                try {
                    const m = C.getMaterial(divName, city, mat);
                    ns.tprint(`      ${mat.padEnd(14)}: stored=${ns.format.number(m.stored)} prod=${m.productionAmount?.toFixed(3)}/s`);
                } catch {}
            }
            ns.tprint("    Material (production booster):");
            for (let mat of PROD_MATS) {
                try {
                    const m = C.getMaterial(divName, city, mat);
                    ns.tprint(`      ${mat.padEnd(14)}: stored=${ns.format.number(m.stored)} MP=$${ns.format.number(m.marketPrice)}`);
                } catch {}
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 7: RINGKASAN KALIBRASI UNTUK AI
    // ──────────────────────────────────────────────────────────
    ns.tprint("\n📌 [SECTION 7] RINGKASAN KALIBRASI (copy-paste ke AI)");
    ns.tprint("─────────────────────────────────────────────────────");

    const calData = {
        gameVersion   : "v3.0.1",
        bitNode       : "BN3 Level 1",
        timestamp     : new Date().toISOString(),
        corpFunds     : corp.funds,
        corpRevenue   : corp.revenue,
        divisions     : corp.divisions,
        upgradeStatus : {},
        unlockCosts   : {},
        warehouseInfo : {},
    };

    for (let u of UPGRADES) {
        try {
            calData.upgradeStatus[u] = {
                level    : C.getUpgradeLevel(u),
                nextCost : C.getUpgradeLevelCost(u),
            };
        } catch {}
    }

    for (let u of UNLOCKS) {
        try { calData.unlockCosts[u] = C.getUnlockCost(u); } catch {}
    }

    for (let divName of corp.divisions) {
        calData.warehouseInfo[divName] = {};
        const div = C.getDivision(divName);
        for (let city of div.cities) {
            try {
                const wh = C.getWarehouse(divName, city);
                calData.warehouseInfo[divName][city] = {
                    level    : wh.level,
                    size     : wh.size,
                    sizeUsed : wh.sizeUsed,
                    upgCost  : (() => { try { return C.getUpgradeWarehouseCost(divName, city, 1); } catch { return null; } })(),
                };
            } catch {}
        }
    }

    ns.tprint(JSON.stringify(calData, null, 2));

    ns.tprint("\n═══════════════════════════════════════════════════════");
    ns.tprint("  SELESAI! Copy output di atas dan share ke AI assistant");
    ns.tprint("═══════════════════════════════════════════════════════\n");
}
