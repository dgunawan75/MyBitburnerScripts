/** @param {NS} ns */
// ============================================================
// GANG MASTER WAR — Territory Warfare Engine
// Extends gang-master-med.js dengan AI Territory Warfare
// Otomatis: serang musuh lemah, hindari yang kuat, retreat
// jika terancam. Maksimalkan territory % untuk income multiplier.
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    if (!ns.gang.inGang()) {
        ns.print("❌ Anda belum bergabung / membuat Gang!");
        return;
    }

    // ============================================================
    // KONFIGURASI
    // ============================================================
    const EQUIPMENT_LIMIT_PERCENT = 0.20;  // Maks 20% cash untuk beli equip
    const ASCENSION_THRESHOLD = 1.15;  // Ascend jika gain multiplier >= 15%
    const WANTED_PENALTY_LIMIT = 0.98;  // Vigilante jika penalty < 2%
    const MIN_TRAINING_STAT = 400;   // Stats minimal sebelum ke lapangan

    // Warfare
    const WAR_WIN_CHANCE_MIN = 0.55;  // Serang hanya jika win chance > 55%
    const WAR_RETREAT_CHANCE = 0.45;  // Aktifkan retreat jika ada musuh > 55% menang lawan kita
    const MIN_MEMBERS_FOR_WAR = 8;     // Minimal 8 anggota sebelum berani perang
    const WARFARE_RATIO = 0.40;  // Maks 40% anggota terkuat dikirim ke "Turf War"

    while (true) {
        ns.clearLog();

        let gangInfo = ns.gang.getGangInformation();
        let members = ns.gang.getMemberNames();
        let others = ns.gang.getOtherGangInformation();

        // ============================================================
        // DISPLAY HEADER
        // ============================================================
        let myTerritory = (gangInfo.territory * 100).toFixed(1);
        let warStatus = gangInfo.territoryWarfareEngaged ? "⚔️ AKTIF" : "🕊️ DAMAI";

        ns.print("=====================================================");
        ns.print(" ⚔️  GANG MASTER WAR — TERRITORY ENGINE             ");
        ns.print("=====================================================");
        ns.print(`💰 Pendapatan  : $${ns.formatNumber(gangInfo.moneyGainRate * 5)}/dtk`);
        ns.print(`👑 Respect     : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`🗺️  Territory   : ${myTerritory}%`);
        ns.print(`🏴 Warfare     : ${warStatus}`);
        ns.print(`🚨 Wanted Lvl  : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${(100 - gangInfo.wantedPenalty * 100).toFixed(2)}%)`);
        ns.print(`👥 Anggota     : ${members.length}`);

        // ============================================================
        // REKRUT ANGGOTA BARU
        // ============================================================
        recruitMembers(ns, members);

        // ============================================================
        // ASCENSION (upgrade multiplier stat)
        // ============================================================
        manageAscension(ns, members, ASCENSION_THRESHOLD);

        // ============================================================
        // BELI EQUIPMENT
        // ============================================================
        buyEquipment(ns, members, EQUIPMENT_LIMIT_PERCENT);

        // ============================================================
        // ANALISA MUSUH & WARFARE DECISION
        // ============================================================
        let warDecision = analyzeWarfare(ns, others, members.length, WAR_WIN_CHANCE_MIN, WAR_RETREAT_CHANCE, MIN_MEMBERS_FOR_WAR);
        ns.gang.setTerritoryWarfare(warDecision.engage);

        if (warDecision.engage) {
            ns.print(`\n⚔️  WARFARE AKTIF:`);
            if (warDecision.targetGang) {
                ns.print(`   🎯 Target: ${warDecision.targetGang} (Win: ${(warDecision.bestWinChance * 100).toFixed(1)}%)`);
            }
            ns.print(`   🚫 Hindari: ${warDecision.avoidGangs.join(", ") || "Tidak ada"}`);
        }

        // ============================================================
        // PEMBAGIAN TUGAS (gabungan combat + warfare)
        // ============================================================
        assignWarTasks(ns, gangInfo, members, warDecision.engage, WANTED_PENALTY_LIMIT, MIN_TRAINING_STAT, WARFARE_RATIO);

        // ============================================================
        // STATUS GANG LAIN
        // ============================================================
        ns.print("\n📊 Status Gang Lain:");
        let sortedGangs = Object.entries(others).sort((a, b) => b[1].territory - a[1].territory);
        for (let [name, info] of sortedGangs) {
            if (info.territory <= 0) continue;
            let winChance = ns.gang.getChanceToWinClash(name);
            let icon = winChance >= WAR_WIN_CHANCE_MIN ? "✅" : "⚠️";
            ns.print(`   ${icon} ${name}: Terr ${(info.territory * 100).toFixed(1)}% | Win: ${(winChance * 100).toFixed(1)}%`);
        }

        await ns.sleep(5000);
    }
}

// ============================================================
// HELPER: Analisa kondisi perang dan keputusan engage/retreat
// ============================================================
function analyzeWarfare(ns, others, memberCount, winMin, retreatThreshold, minMembers) {
    // Belum cukup anggota untuk perang
    if (memberCount < minMembers) {
        return { engage: false, targetGang: null, bestWinChance: 0, avoidGangs: [] };
    }

    let bestWinChance = 0;
    let targetGang = null;
    let avoidGangs = [];
    let shouldRetreat = false;

    for (let [name, info] of Object.entries(others)) {
        if (info.territory <= 0) continue; // Gang sudah tidak punya wilayah

        let winChance = ns.gang.getChanceToWinClash(name);
        let loseChance = 1 - winChance;

        // Musuh berbahaya: bisa menang lawan kita
        if (loseChance > retreatThreshold) {
            avoidGangs.push(name);
            // Jika wilayah mereka > 5%, ini ancaman serius → pertimbangkan retreat
            if (info.territory > 0.05) shouldRetreat = true;
        }

        // Target terbaik: gang yang bisa kita kalahkan
        if (winChance > bestWinChance && winChance >= winMin) {
            bestWinChance = winChance;
            targetGang = name;
        }
    }

    // Retreat jika ada musuh bahaya DAN kita tidak punya target yang aman
    let engage = !shouldRetreat && targetGang !== null;

    return { engage, targetGang, bestWinChance, avoidGangs };
}

// ============================================================
// HELPER: Pembagian tugas gabungan Warfare + Combat
// ============================================================
function assignWarTasks(ns, gangInfo, members, warActive, wantedLimit, minStat, warfareRatio) {
    let wantedPenalty = gangInfo.wantedPenalty;
    let needVigilante = wantedPenalty < wantedLimit && gangInfo.wantedLevel > 10;
    let maxVigilantes = Math.max(1, Math.floor(members.length * 0.2));
    let vigilanteCount = 0;

    // Sortir anggota dari yang terkuat ke terlemah (untuk alokasi tugas war)
    let ranked = members.map(m => {
        let info = ns.gang.getMemberInformation(m);
        let avg = (info.str + info.def + info.dex + info.agi) / 4;
        return { name: m, avg, task: info.task };
    }).sort((a, b) => b.avg - a.avg); // Terkuat duluan

    // Berapa anggota yang dikirim ke Territory Warfare?
    let warSlots = warActive ? Math.floor(members.length * warfareRatio) : 0;
    let warAssigned = 0;

    for (let { name, avg } of ranked) {
        let nTask = "";
        let pTask = ns.gang.getMemberInformation(name).task;

        // Prioritas: 1. Training jika masih lemah
        if (avg < minStat) {
            nTask = "Train Combat";
        }
        // 2. Vigilante jika wanted terlalu tinggi
        else if (needVigilante && vigilanteCount < maxVigilantes && avg > minStat) {
            nTask = "Vigilante Justice";
            vigilanteCount++;
        }
        // 3. Territory Warfare (anggota terkuat) — jika warfare aktif
        else if (warActive && warAssigned < warSlots && avg > minStat * 2) {
            nTask = "Territory Warfare";
            warAssigned++;
        }
        // 4. Tugas income normal berdasarkan stat
        else if (members.length < 6) {
            nTask = avg < 250 ? "Mug People" : "Terrorism";
        }
        else if (avg < 500) { nTask = "Mug People"; }
        else if (avg < 1200) { nTask = Math.random() > 0.6 ? "Terrorism" : "Strongarm Assassinations"; }
        else { nTask = "Human Trafficking"; }

        if (nTask !== "" && pTask !== nTask) {
            ns.gang.setMemberTask(name, nTask);
            ns.print(`🔄 ${name} (${Math.floor(avg)}) → ${nTask}`);
        }
    }
}

// ============================================================
// HELPER: Rekrut Anggota Baru
// ============================================================
function recruitMembers(ns, members) {
    while (ns.gang.canRecruitMember()) {
        let newName = "Preman-" + (members.length + 1);
        if (ns.gang.recruitMember(newName)) {
            ns.print(`🎉 Rekrut: ${newName}`);
            members.push(newName);
        } else break;
    }
}

// ============================================================
// HELPER: Sistem Ascension
// ============================================================
function manageAscension(ns, members, threshold) {
    for (let m of members) {
        let result = ns.gang.getAscensionResult(m);
        if (!result) continue;
        let gain = (result.str + result.def + result.dex + result.agi) / 4;
        if (gain >= threshold) {
            ns.gang.ascendMember(m);
            ns.print(`✨ ASCENSION: ${m} (${gain.toFixed(2)}×)`);
        }
    }
}

// ============================================================
// HELPER: Beli Equipment
// ============================================================
function buyEquipment(ns, members, budgetPct) {
    let equips = ns.gang.getEquipmentNames()
        .sort((a, b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

    for (let m of members) {
        let info = ns.gang.getMemberInformation(m);
        for (let eq of equips) {
            if (info.upgrades.includes(eq) || info.augmentations.includes(eq)) continue;
            let cost = ns.gang.getEquipmentCost(eq);
            let budget = ns.getServerMoneyAvailable("home") * budgetPct;
            let stats = ns.gang.getEquipmentStats(eq);
            if (stats.hack && !stats.str && !stats.def) continue; // Skip pure-hack equip
            if (cost <= budget) {
                if (ns.gang.purchaseEquipment(m, eq)) {
                    ns.print(`🛍️ ${eq} → ${m} ($${ns.formatNumber(cost)})`);
                }
            }
        }
    }
}
