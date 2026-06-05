/** @param {NS} ns **/
// ============================================================
// corp-next.js v2 — Manajer Korporasi Otomatis (BN3 v3.0.1)
// [DIKALIBRASI dari data nyata getConstants() + diagnostik]
//
// KONSTANTA GAME TERVERIFIKASI:
//   warehouseInitialCost    : $5B (beli warehouse pertama di kota)
//   officeInitialCost       : $4B (expand ke kota baru = beli office)
//   officeSizeUpgradeCostBase: $1B/slot
//   warehouseSizeUpgradeCostBase: $1B base × 1.07^level per upgrade
//   Ukuran warehouse per level: level × 110 (empiris dari data)
//   Smart Supply cost       : $25B (1 kali, berlaku semua divisi)
//   Wilson Analytics base   : ~$4B (harga × 2 tiap level!)
//   Upgrade lain base       : ~$1-5B (harga × 1.06 tiap level)
//   teaCostPerEmployee      : $500K (boost energy karyawan)
//
// UKURAN MATERIAL (verified via getMaterialData):
//   Water 0.05 | Food 0.03 | Plants 0.05 | Metal 0.1
//   Hardware 0.06 | Chemicals 0.05 | Drugs 0.02
//   Robots 0.5 | AI Cores 0.1 | Real Estate 0.005 | Minerals 0.04
//
// STRATEGI:
//  • Fase 1 — 1 kota HQ, agresif beli upgrade (Wilson, SalesBots dulu)
//  • Fase 2 — Ekspansi 1 kota/siklus setelah Round 1 ($210B)
//  • Fase 3 — Buka Tobacco setelah Round 2 ($5T)
//
// ANTI-GRIDLOCK:
//  • Harga jual dinamis 4 level berdasar % kepenuhan gudang
//  • Beli Tea otomatis tiap 5 siklus (boost employee energy/morale murah)
//  • Hard cap: 97% gudang = jual paksa MP×0.5 → Smart Supply tidak mati
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const C = ns.corporation;

    // ============================================================
    // ⚙️  KONFIGURASI UTAMA (dikalibrasi dari data nyata)
    // ============================================================
    const CFG = {
        corpName : "Aurolive",
        agDiv    : "Agro",
        tobDiv   : "Smokeware",

        // Urutan ekspansi kota (HQ pertama, 5 lainnya diexpand bertahap)
        allCities: ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"],

        // ── Rasio Material Optimal (TERVERIFIKASI dari data nyata) ──
        //
        // Rumus Produksi Agriculture:
        //   prodMult ∝ 0.002×HW^0.998 + 0.002×Rob^0.998
        //            + 0.002×AIC^0.998 + 0.002×RE^0.72
        //
        // PENTING: Rasio RE tinggi sangat efisien (harga murah, size 0.005/unit)
        //
        // Fase 1 — Target untuk warehouse Level 5 (size 550):
        //   HW 125  × 0.06  = 7.5
        //   Rob 75  × 0.5   = 37.5
        //   AIC 75  × 0.1   = 7.5
        //   RE 30k  × 0.005 = 150
        //   TOTAL booster   ≈ 202.5 space dari 550
        //   Sisa untuk output Food+Plants: ~347.5 → sangat nyaman!
        matPhase1: { Hardware: 125, Robots: 75, "AI Cores": 75, "Real Estate": 30000 },

        // Fase 2 — Target untuk warehouse Level 9 (size 990):
        //   HW 300  × 0.06  = 18
        //   Rob 90  × 0.5   = 45
        //   AIC 300 × 0.1   = 30
        //   RE 70k  × 0.005 = 350
        //   TOTAL booster   ≈ 443 space dari 990
        //   Sisa untuk output Food+Plants: ~547 → nyaman untuk produksi tinggi
        matPhase2: { Hardware: 300, Robots: 90, "AI Cores": 300, "Real Estate": 70000 },

        // ── Level Warehouse Target ────────────────────────────────────
        // ⚠️  FORMULA TERKOREKSI:
        //   size = level × 100 × (1 + 0.1 × smartStorageLevel)
        //
        //   BASE (Smart Storage L0): level × 100
        //   Smart Storage L1 (+10%): level × 110   ← ini yg kita lihat di data diagnostik
        //   Smart Storage L3 (+30%): level × 130
        //   Smart Storage L5 (+50%): level × 150
        //
        //   IMPLIKASI: Smart Storage mengalikan SEMUA warehouse di SEMUA kota!
        //   → Beli Smart Storage awal = ROI sangat tinggi di Fase 2 (6 kota × banyak level)
        //
        // Target level Phase 1 (dengan Smart Storage L3 → 130/lvl):
        //   Level 5 = 650 size (cukup untuk 1 kota + buffer output)
        // Target level Phase 2 (dengan Smart Storage L5 → 150/lvl):
        //   Level 8 = 1200 size (cukup untuk material Phase 2 + output)
        whLvlPhase1: 5,  // Cukup aman untuk 1 kota dengan produksi awal
        whLvlPhase2: 8,  // Smart Storage L5 di Phase 2 → 8 × 150 = 1200 size

        // ── Threshold Kepenuhan Gudang (anti-gridlock) ───────────────
        whWarnPct : 0.75,   // 75%: mulai turunkan harga (jual lebih cepat)
        whCritPct : 0.90,   // 90%: diskon besar (paksa habis)
        whMaxPct  : 0.97,   // 97%: DANGER — Smart Supply bisa mati!

        // ── Komposisi Karyawan per Fase ──────────────────────────────
        // officeInitialSize = 3 (dari getConstants) → Phase 1 langsung fit
        empPhase1: { "Operations": 1, "Engineer": 1, "Business": 1 }, // total=3
        // Phase 2: expand office +6 slots (biaya ~$6B per kota, terjangkau)
        empPhase2: {
            "Operations": 2, "Engineer": 2, "Business": 1,
            "Management": 2, "Research & Development": 2           // total=9
        },

        // ── Upgrade Korporasi — Urutan Prioritas (DIREVISI) ──────────
        //
        // LOGIKA:
        //   1. Wilson Analytics → sales mult, anti-gridlock #1 (cost: $4B, ×2 tiap lvl!)
        //   2. ABC SalesBots    → sales mult #2 (cost: ~$1B × 1.06^lvl, murah)
        //   3. Smart Storage    → MULTIPLIER semua warehouse (100×(1+0.1×lvl) per level)
        //                         ⬆️ naik prioritas karena mengalikan SEMUA 6 kota!
        //   4. Employee implants → naikan stats → lebih banyak output
        //   5. Smart Factories  → production multiplier langsung
        //   6. Project Insight  → speed riset
        //
        upgradeList: {
            phase1: [
                // [1] Anti-gridlock: sales multiplier (prioritas tertinggi)
                { name: "Wilson Analytics",                       max: 2  },
                // L0→1=$4B, L1→2=$8B (total $12B) — cost doubles!
                { name: "ABC SalesBots",                          max: 5  },

                // [2] Smart Storage AWAL: ROI besar saat Phase 2 (6 kota × banyak level)
                // L1=$2B (+10% semua WH), L2=$2.12B, L3=$2.25B — total ≈$6.4B
                { name: "Smart Storage",                          max: 3  },

                // [3] Employee implants (produksi naik)
                { name: "FocusWires",                             max: 3  },
                { name: "Neural Accelerators",                    max: 3  },
                { name: "Speech Processor Implants",              max: 3  },
                { name: "Nuoptimal Nootropic Injector Implants",  max: 3  },

                // [4] Production multiplier
                { name: "Smart Factories",                        max: 3  },

                // [5] Research
                { name: "Project Insight",                        max: 1  },
            ],
            phase2: [
                // Wilson Analytics: HATI-HATI biayanya 2× tiap level!
                //   L5=sudah beli ($64B), L6=$128B, L7=$256B, L8=$512B...
                //   Post Round 1 modal ~$200B → JANGAN beli di atas L5!
                //   Biarkan L6+ untuk Phase 3 (setelah Round 2 = $5T+)
                { name: "Wilson Analytics",                       max: 5  },
                { name: "ABC SalesBots",                          max: 12 },
                // Smart Storage: dengan 6 kota, tiap level = banyak sekali space
                { name: "Smart Storage",                          max: 10 },
                { name: "Smart Factories",                        max: 10 },
                { name: "FocusWires",                             max: 10 },
                { name: "Neural Accelerators",                    max: 10 },
                { name: "Speech Processor Implants",              max: 10 },
                { name: "Nuoptimal Nootropic Injector Implants",  max: 10 },
                { name: "Project Insight",                        max: 5  },
            ],
            phase3: [
                // Phase 3 (post Round 2 $5T+): sekarang bisa beli Wilson L6-L8+
                { name: "Wilson Analytics",                       max: 8  },
                { name: "ABC SalesBots",                          max: 20 },
                { name: "Smart Storage",                          max: 20 },
                { name: "Smart Factories",                        max: 20 },
                { name: "FocusWires",                             max: 20 },
                { name: "Neural Accelerators",                    max: 20 },
                { name: "Speech Processor Implants",              max: 20 },
                { name: "Nuoptimal Nootropic Injector Implants",  max: 20 },
                { name: "Project Insight",                        max: 10 },
            ],
        },

        // ── Unlock Satu Kali (dibeli di inisialisasi) ─────────────────
        // Diverifikasi dari getUnlockCost():
        //   Smart Supply                 : $25B
        //   Market Research - Demand     : $5B  (tahu demand pasar)
        //   Market Data - Competition    : $5B  (tahu kompetisi)
        unlocksToBuy: ["Smart Supply", "Market Research - Demand", "Market Data - Competition"],

        // ── Target Investasi ───────────────────────────────────────────
        // Round 1: Uang dari investor masuk ke CORP FUNDS (bukan player!)
        //   Dipakai untuk: expand 6 kota ($45B) + WH upgrades ($30B+)
        //                  + boost materials + corp upgrades
        // Estimasi minimum Phase 2 butuh: ~$120B corp funds
        // Dengan corp funds $42B saat ini: butuh investasi min ~$80B
        // $180B = target konservatif, cukup jauh di atas minimum
        //
        // JANGAN tunggu terlalu tinggi: offer naik-turun berdasar profit
        // kalau ada gridlock → profit turun → offer turun!
        investR1Min: 180e9,  // $180 Miliar — lebih realistis, tidak perlu nunggu $210B
        // Round 2: Untuk buka Tobacco + set up semua infrastruktur
        investR2Min: 5e12,   // $5 Triliun  (Round 2)

        // ── Safety Finansial ───────────────────────────────────────────
        // Upgrade: beli jika sisa dana setelah beli masih >= cost × safety
        upgradeSafety  : 0.15,  // 15% buffer — agresif tapi aman (modal $150B besar)
        whUpgSafety    : 1.0,   // 100% buffer untuk WH upgrade (butuh 2× cost)
        // Ekspansi kota: konservatif karena biaya besar ($9B)
        cityExpandSafety: 3,    // Perlu punya 3× biaya = $27B sebelum expand 1 kota
        cityExpandCost : 9e9,   // $4B office + $5B warehouse = $9B per kota baru

        // Cadangan minimum kas yang TIDAK BOLEH disentuh
        // ⚠️ $10B terlalu kecil! Wilson L4→5 ($64B) bisa drain habis.
        // $30B = cukup untuk 3 kota ekspansi darurat + buffer operasional
        minReserve: 30e9,   // $30B

        // Tea untuk karyawan: $500K/orang (dari teaCostPerEmployee di getConstants)
        teaEnabled     : true,
        teaIntervalTick: 5,    // Beli tea setiap N tick (tidak perlu setiap tick)

        // Cooldown antara ekspansi kota
        cityExpandCooldown: 20000, // 20 detik
    };

    // ============================================================
    // 🚀  INISIALISASI
    // ============================================================
    ns.print("⏳ Inisialisasi Corp Manager...");

    // 1. Buat Corporation
    if (!C.hasCorporation()) {
        ns.print(`📋 Membuat Corporation "${CFG.corpName}"...`);
        if (!C.createCorporation(CFG.corpName, true)) {
            ns.print("⚠️ selfFund gagal. Pastikan di BN3 atau ada $150B...");
            C.createCorporation(CFG.corpName, false);
        }
        ns.print("✅ Corporation siap! Modal awal BN3 = $150B");
        await ns.sleep(1000);
    }

    // 2. Buka Divisi Agriculture
    if (!C.getCorporation().divisions.includes(CFG.agDiv)) {
        ns.print(`🌾 Membuka divisi "${CFG.agDiv}" (Agriculture)...`);
        C.expandIndustry("Agriculture", CFG.agDiv);
        await ns.sleep(600);
    }

    // 3. Tentukan Kota HQ
    const startCity = C.getDivision(CFG.agDiv).cities[0];
    ns.print(`🏙️ Kota HQ: ${startCity}`);

    // 4. Beli Warehouse di Kota HQ
    try { C.getWarehouse(CFG.agDiv, startCity); }
    catch {
        ns.print(`📦 Beli Warehouse di ${startCity} ($5B)...`);
        C.purchaseWarehouse(CFG.agDiv, startCity);
        await ns.sleep(300);
    }

    // 5. Beli Unlocks penting (Smart Supply $25B, Demand $5B, Competition $5B)
    for (let unlockName of CFG.unlocksToBuy) {
        try {
            const cost = C.getUnlockCost(unlockName);
            const funds = C.getCorporation().funds;
            if (funds >= cost + CFG.minReserve) {
                C.purchaseUnlock(unlockName);
                ns.print(`🔓 "${unlockName}" UNLOCKED! (-$${ns.format.number(cost)})`);
            } else {
                ns.print(`⏳ Dana belum cukup untuk "${unlockName}" ($${ns.format.number(cost)})`);
            }
        } catch { /* Sudah unlock */ }
    }

    await ns.sleep(300);
    ns.print("✅ Inisialisasi selesai. Mulai loop otomatis...\n");

    // ============================================================
    // 🔄  LOOP UTAMA
    // ============================================================
    let phase = 1;
    let tobaccoStarted = false;
    let lastCityExpandAt = 0;
    let tickCount = 0;

    while (true) {
        await ns.sleep(10000); // 1 corp-tick = 10 detik (dari secondsPerMarketCycle)
        tickCount++;

        try {
            ns.clearLog();

            const corp   = C.getCorporation();
            const offer  = C.getInvestmentOffer();
            let   funds  = corp.funds;
            const rev    = corp.revenue;
            const exp    = corp.expenses;
            const profit = rev - exp;

            // ── Auto-detect fase ─────────────────────────────────
            if      (offer.round >= 3) phase = 3;
            else if (offer.round === 2 && phase < 2) phase = 2;

            let activeCities = C.getDivision(CFG.agDiv).cities;

            // ────────────────────────────────────────────────────
            // STATUS HEADER
            // ────────────────────────────────────────────────────
            ns.print("═══════════════════════════════════════════════════");
            ns.print(`  🏢 ${CFG.corpName} | FASE ${phase} | Inv.Round ${offer.round} | Tick #${tickCount}`);
            ns.print("═══════════════════════════════════════════════════");
            ns.print(`💰 Dana    : $${ns.format.number(funds)}`);
            ns.print(`📈 Revenue : $${ns.format.number(rev)}/s`);
            ns.print(`💸 Expenses: $${ns.format.number(exp)}/s`);
            ns.print(`✨ Profit  : $${ns.format.number(profit)}/s`);
            ns.print(`🏙️ Kota    : [${activeCities.length}/6] ${activeCities.join(", ")}`);

            // ────────────────────────────────────────────────────
            // UNLOCK: Cek & beli unlock yang belum terbeli di init
            // (fallback jika dana belum cukup saat init)
            // ────────────────────────────────────────────────────
            for (let unlockName of CFG.unlocksToBuy) {
                try {
                    const cost = C.getUnlockCost(unlockName);
                    if (funds >= cost + CFG.minReserve) {
                        C.purchaseUnlock(unlockName);
                        funds -= cost;
                        ns.print(`🔓 "${unlockName}" UNLOCKED! (-$${ns.format.number(cost)})`);
                    }
                } catch { /* Sudah unlock atau tidak tersedia */ }
            }

            // ────────────────────────────────────────────────────
            // FASE 2+: EKSPANSI KOTA SATU PER SATU
            // Biaya per kota: $4B (office) + $5B (warehouse) = $9B
            // Safety: punya 3× biaya = $27B sebelum expand
            // ────────────────────────────────────────────────────
            if (phase >= 2) {
                const now = Date.now();
                if (now - lastCityExpandAt > CFG.cityExpandCooldown) {
                    for (let city of CFG.allCities) {
                        if (!activeCities.includes(city)) {
                            const budgetNeeded = CFG.cityExpandCost * CFG.cityExpandSafety;
                            const fundsAfter   = funds - CFG.cityExpandCost;

                            if (funds >= budgetNeeded && fundsAfter >= CFG.minReserve) {
                                ns.print(`\n🗺️ Ekspansi ke ${city} (-$${ns.format.number(CFG.cityExpandCost)})...`);
                                try {
                                    C.expandCity(CFG.agDiv, city);
                                    C.purchaseWarehouse(CFG.agDiv, city);
                                    funds -= CFG.cityExpandCost;
                                    lastCityExpandAt = now;
                                    ns.print(`✅ Berhasil expand ${city}!`);
                                } catch (e) {
                                    ns.print(`⚠️ Expand ${city} gagal: ${e}`);
                                }
                            } else {
                                ns.print(`⏳ Expand ${city}: perlu $${ns.format.number(budgetNeeded)}, ada $${ns.format.number(funds)}`);
                            }
                            break; // Hanya 1 kota per evaluasi
                        }
                    }
                    activeCities = C.getDivision(CFG.agDiv).cities;
                }
            }

            // ────────────────────────────────────────────────────
            // SMART SUPPLY
            // ────────────────────────────────────────────────────
            for (let city of activeCities) {
                try { C.setSmartSupply(CFG.agDiv, city, true); } catch {}
            }

            // ────────────────────────────────────────────────────
            // KARYAWAN: Rekrut + Assign + Tea
            // ────────────────────────────────────────────────────
            manageEmployees(ns, C, CFG, activeCities, phase);

            // Tea setiap N tick: $500K/orang (boost energy → produksi lebih tinggi)
            if (CFG.teaEnabled && tickCount % CFG.teaIntervalTick === 0) {
                for (let city of activeCities) {
                    try { C.buyTea(CFG.agDiv, city); } catch {}
                }
            }

            // ────────────────────────────────────────────────────
            // WAREHOUSE: Upgrade sesuai target level
            // Ukuran per level: level × 110 (terverifikasi dari data)
            // ────────────────────────────────────────────────────
            funds = manageWarehouses(ns, C, CFG, activeCities, funds, phase);

            // ────────────────────────────────────────────────────
            // UPGRADE KORPORASI (multiple pass, prioritas urut)
            // ────────────────────────────────────────────────────
            funds = buyCorporateUpgrades(ns, C, CFG, funds, phase);

            // ────────────────────────────────────────────────────
            // MATERIAL + HARGA JUAL
            // ────────────────────────────────────────────────────
            const matTarget = phase >= 2 ? CFG.matPhase2 : CFG.matPhase1;
            manageSellPrices(ns, C, CFG, activeCities);
            buyProductionMaterials(ns, C, CFG, activeCities, matTarget);

            // ────────────────────────────────────────────────────
            // STATUS GUDANG
            // Formula: size = level × 100 × (1 + 0.1 × smartStorageLvl)
            // ────────────────────────────────────────────────────
            const ssLvl    = (() => { try { return C.getUpgradeLevel("Smart Storage"); } catch { return 0; } })();
            const whSzMult = 1 + 0.1 * ssLvl;
            ns.print(`\n📦 GUDANG (Smart Storage L${ssLvl} → ${whSzMult.toFixed(1)}× → ${(100*whSzMult).toFixed(0)}/level):`)
            for (let city of activeCities) {
                try {
                    const wh   = C.getWarehouse(CFG.agDiv, city);
                    const pct  = wh.sizeUsed / wh.size;
                    const icon = pct >= CFG.whMaxPct  ? "🔴 DANGER" :
                                 pct >= CFG.whCritPct ? "🟠 KRITIS" :
                                 pct >= CFG.whWarnPct ? "🟡 WARN  " : "🟢 OK    ";
                    ns.print(`  ${icon} ${city.padEnd(12)} ${(pct*100).toFixed(1)}% ` +
                             `Lvl.${wh.level} [${ns.format.number(wh.sizeUsed)}/${ns.format.number(wh.size)}]`);
                } catch {}
            }

            // ────────────────────────────────────────────────────
            // STATUS PRODUKSI
            // ────────────────────────────────────────────────────
            ns.print("\n🌾 PRODUKSI (Food | Plants):");
            for (let city of activeCities) {
                try {
                    const food  = C.getMaterial(CFG.agDiv, city, "Food");
                    const plant = C.getMaterial(CFG.agDiv, city, "Plants");
                    // Net = prod - sold (positif = menumpuk, negatif = stok berkurang)
                    const fNet  = ((food.productionAmount  ?? 0) - (food.actualSellAmount  ?? 0)).toFixed(1);
                    const pNet  = ((plant.productionAmount ?? 0) - (plant.actualSellAmount ?? 0)).toFixed(1);
                    ns.print(`  📍 ${city.padEnd(12)} ` +
                             `Food: ${ns.format.number(food.stored)} (net ${fNet}/s) | ` +
                             `Plants: ${ns.format.number(plant.stored)} (net ${pNet}/s)`);
                } catch {}
            }

            // ────────────────────────────────────────────────────
            // CEK & TERIMA PENAWARAN INVESTASI
            // ────────────────────────────────────────────────────
            if (phase === 1 && offer.funds >= CFG.investR1Min) {
                ns.print(`\n🤝 ACCEPT ROUND 1! $${ns.format.number(offer.funds)}`);
                C.acceptInvestmentOffer();
                phase = 2;
                ns.print("🚀 MASUK FASE 2! Ekspansi ke 5 kota lainnya segera dimulai...");
            } else if (phase === 2 && offer.funds >= CFG.investR2Min) {
                ns.print(`\n🤝 ACCEPT ROUND 2! $${ns.format.number(offer.funds)}`);
                C.acceptInvestmentOffer();
                phase = 3;
                ns.print("🎯 MASUK FASE 3! Siap buka Tobacco...");
            }

            // ────────────────────────────────────────────────────
            // FASE 3: Buka Tobacco + Aktifkan Dividen
            // Dividen = cara mengkonversi profit corp → uang player
            // Player uang → bisa beli Augments, RAM, dll!
            // ────────────────────────────────────────────────────
            if (phase >= 3 && !tobaccoStarted) {
                tobaccoStarted = startTobaccoDivision(ns, C, CFG);
                // Aktifkan dividen 5% dari profit → uang player
                // (Hanya efektif jika corp sudah profit besar)
                try { C.issueDividends(0.05); ns.print("💵 Dividen 5% aktif → uang mengalir ke player!"); } catch {}
            }

            // ────────────────────────────────────────────────────
            // INFO INVESTASI
            // ────────────────────────────────────────────────────
            if (phase < 3) {
                const target = phase === 1 ? CFG.investR1Min : CFG.investR2Min;
                const pct    = Math.min(100, offer.funds / target * 100).toFixed(1);
                ns.print(`\n⏳ Target Round ${offer.round}: $${ns.format.number(target)}`);
                ns.print(`   Offer saat ini: $${ns.format.number(offer.funds)} (${pct}%)`);
            }

        } catch (err) {
            ns.print(`\n❌ ERROR: ${err}`);
            ns.print("   Akan retry di tick berikutnya...");
        }
    }
}

// ============================================================
// 👥  HELPER: Manajemen Karyawan
// ============================================================
function manageEmployees(ns, C, cfg, cities, phase) {
    const target      = phase >= 2 ? cfg.empPhase2 : cfg.empPhase1;
    const totalNeeded = Object.values(target).reduce((a, b) => a + b, 0);
    const ALL_JOBS    = [
        "Operations", "Engineer", "Business",
        "Management", "Research & Development", "Intern"
    ];

    for (let city of cities) {
        try {
            let office = C.getOffice(cfg.agDiv, city);

            // Expand office jika kurang besar (cek cost dulu jika bisa)
            if (office.size < totalNeeded) {
                const slotsNeeded = totalNeeded - office.size;
                try {
                    C.upgradeOfficeSize(cfg.agDiv, city, slotsNeeded);
                    office = C.getOffice(cfg.agDiv, city);
                } catch { /* Dana tidak cukup */ }
            }

            // Rekrut hingga penuh
            let empCount = office.employees.length;
            while (empCount < office.size) {
                try { C.hireEmployee(cfg.agDiv, city, "Unassigned"); empCount++; }
                catch { break; }
            }

            // Reset semua ke 0 dulu (hindari konflik saat re-assign)
            for (let job of ALL_JOBS) {
                try { C.setJobAssignment(cfg.agDiv, city, job, 0); } catch {}
            }
            // Assign sesuai target komposisi
            for (let [job, count] of Object.entries(target)) {
                try { C.setJobAssignment(cfg.agDiv, city, job, count); } catch {}
            }
        } catch {}
    }
}

// ============================================================
// 📦  HELPER: Upgrade Warehouse (size empiris: level × 110)
// ============================================================
function manageWarehouses(ns, C, cfg, cities, funds, phase) {
    const targetLvl = phase >= 2 ? cfg.whLvlPhase2 : cfg.whLvlPhase1;

    for (let city of cities) {
        try {
            let wh = C.getWarehouse(cfg.agDiv, city);
            while (wh.level < targetLvl) {
                const cost      = C.getUpgradeWarehouseCost(cfg.agDiv, city, 1);
                const threshold = cost * (1 + cfg.whUpgSafety); // butuh 2× cost
                const afterBuy  = funds - cost;
                if (funds >= threshold && afterBuy >= cfg.minReserve) {
                    C.upgradeWarehouse(cfg.agDiv, city, 1);
                    funds -= cost;
                    try { wh = C.getWarehouse(cfg.agDiv, city); } catch { break; }
                } else {
                    break;
                }
            }
        } catch {}
    }
    return funds;
}

// ============================================================
// 💲  HELPER: Harga Jual Dinamis (per-material, anti-gridlock)
//
// Dua layer pricing:
//  Layer 1 (Warehouse %): berlaku untuk semua output material
//    < 75%  → MP      (harga penuh)
//    75-90% → MP*0.92 (diskon 8%)
//    90-97% → MP*0.75 (diskon 25%)
//    > 97%  → MP*0.5  (dump darurat)
//
//  Layer 2 (Stock individual): Plants sering menumpuk karena
//  market saturation (6 kota sekaligus produksi)
//  → Jika Plants stored > threshold, turunkan harga Plants lebih agresif
//    independen dari warehouse % (Food biarkan normal)
// ============================================================
function manageSellPrices(ns, C, cfg, cities) {
    // Threshold stok Plants: jika di atas ini, agresif jual walaupun WH tidak penuh
    const PLANTS_DUMP_THRESHOLD = 1000;  // unit Plants tersimpan
    const PLANTS_WARN_THRESHOLD = 500;   // unit Plants mulai discount

    for (let city of cities) {
        try {
            const wh   = C.getWarehouse(cfg.agDiv, city);
            const pct  = wh.sizeUsed / wh.size;

            // Harga berdasar warehouse % (berlaku untuk Food)
            let basePrice;
            if      (pct >= cfg.whMaxPct)  basePrice = "MP*0.5";
            else if (pct >= cfg.whCritPct) basePrice = "MP*0.75";
            else if (pct >= cfg.whWarnPct) basePrice = "MP*0.92";
            else                           basePrice = "MP";

            // Food: ikuti base price dari warehouse %
            try { C.sellMaterial(cfg.agDiv, city, "Food", "MAX", basePrice); } catch {}

            // Plants: harga LEBIH AGRESIF jika stok tinggi
            // karena Plants sering saturasi pasar (6 kota berproduksi sekaligus)
            let plantsPrice;
            try {
                const plantsStored = C.getMaterial(cfg.agDiv, city, "Plants").stored;
                if      (plantsStored > PLANTS_DUMP_THRESHOLD) plantsPrice = "MP*0.5";
                else if (plantsStored > PLANTS_WARN_THRESHOLD) plantsPrice = "MP*0.75";
                else                                           plantsPrice = basePrice;
            } catch { plantsPrice = basePrice; }
            try { C.sellMaterial(cfg.agDiv, city, "Plants", "MAX", plantsPrice); } catch {}

        } catch {}
    }
}

// ============================================================
// 🏭  HELPER: Beli Material Produksi (pulse buy per tick)
//
//   < 95% target : beli (needed / 10) per detik selama 1 tick
//   > 105% target: jual kelebihan (excess / 10) per detik
//   ≈ target     : stop beli, harga jual diatur manageSellPrices
// ============================================================
function buyProductionMaterials(ns, C, cfg, cities, targets) {
    for (let city of cities) {
        for (let [mat, targetQty] of Object.entries(targets)) {
            try {
                const cur = C.getMaterial(cfg.agDiv, city, mat).stored;

                if (cur < targetQty * 0.95) {
                    const buyPerSec = (targetQty - cur) / 10;
                    C.buyMaterial(cfg.agDiv, city, mat, buyPerSec);
                    C.sellMaterial(cfg.agDiv, city, mat, 0, "MP"); // stop jual
                } else if (cur > targetQty * 1.05) {
                    const sellPerSec = (cur - targetQty) / 10;
                    C.buyMaterial(cfg.agDiv, city, mat, 0);
                    C.sellMaterial(cfg.agDiv, city, mat, sellPerSec, "MP");
                } else {
                    C.buyMaterial(cfg.agDiv, city, mat, 0); // stop beli, harga OK
                }
            } catch (e) {
                ns.print(`⚠️ Mat (${city}/${mat}): ${e}`);
            }
        }
    }
}

// ============================================================
// ⬆️  HELPER: Beli Upgrade Korporasi (multiple pass)
//
//   Loop sampai tidak ada upgrade lagi yang bisa dibeli di satu siklus.
//   Ini memastikan semua dana "spare" terpakai secara maksimal per tick.
// ============================================================
function buyCorporateUpgrades(ns, C, cfg, funds, phase) {
    // Pilih target berdasarkan fase
    const targets = phase >= 3 ? cfg.upgradeList.phase3 :
                    phase >= 2 ? cfg.upgradeList.phase2 :
                                 cfg.upgradeList.phase1;

    let anyBought;
    let passCount = 0;
    do {
        anyBought = false;
        for (let { name, max } of targets) {
            try {
                const lvl = C.getUpgradeLevel(name);
                if (lvl >= max) continue;

                const cost     = C.getUpgradeLevelCost(name);
                const afterBuy = funds - cost;
                // Cukup jika sisa dana setelah beli masih > cost × safety + minReserve
                if (afterBuy >= cost * cfg.upgradeSafety && afterBuy >= cfg.minReserve) {
                    C.levelUpgrade(name);
                    funds -= cost;
                    anyBought = true;
                    ns.print(`✅ ${name}: Lvl ${lvl}→${lvl+1} (-$${ns.format.number(cost)})`);
                }
            } catch (e) {
                ns.print(`⚠️ Upgrade "${name}": ${e}`);
            }
        }
        passCount++;
    } while (anyBought && passCount < 30);

    // Status upgrade ringkas
    ns.print("\n📊 UPGRADE:");
    for (let { name, max } of targets) {
        try {
            const lvl  = C.getUpgradeLevel(name);
            const done = lvl >= max;
            const cost = done ? "MAX" : `$${ns.format.number(C.getUpgradeLevelCost(name))}`;
            const fill = Math.round(lvl / max * 8);
            const bar  = "█".repeat(fill) + "░".repeat(8 - fill);
            const tick = done ? "✅" : "  ";
            ns.print(`  ${tick} ${name.padEnd(38)} L${String(lvl).padStart(2)}/${max} [${bar}] ${cost}`);
        } catch {}
    }

    return funds;
}

// ============================================================
// 🚬  HELPER: Buka Divisi Tobacco (Fase 3)
// ============================================================
function startTobaccoDivision(ns, C, cfg) {
    try {
        if (C.getCorporation().divisions.includes(cfg.tobDiv)) return true;

        const MIN = 20e9;
        const funds = C.getCorporation().funds;
        if (funds < MIN) {
            ns.print(`⏳ Tobacco butuh $${ns.format.number(MIN)} (ada: $${ns.format.number(funds)})`);
            return false;
        }

        ns.print(`🚬 Membuka "${cfg.tobDiv}" (Tobacco)...`);
        C.expandIndustry("Tobacco", cfg.tobDiv);
        // Fase 3: dana besar, langsung expand semua kota
        for (let city of cfg.allCities) {
            try { C.expandCity(cfg.tobDiv, city); }       catch {}
            try { C.purchaseWarehouse(cfg.tobDiv, city); } catch {}
        }
        ns.print(`✅ "${cfg.tobDiv}" dibuka di semua kota!`);
        ns.print("   → Buat Produk pertama MANUAL di UI: Corp → Smokeware → buat produk");
        return true;
    } catch (e) {
        ns.print(`⚠️ Tobacco: ${e}`);
        return false;
    }
}
