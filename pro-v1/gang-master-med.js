/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("====================================");
    ns.print(" ⚔️ PRO V1: GANG SYNDICATE MASTER (MED) ");
    ns.print("====================================");

    if (!ns.gang.inGang()) {
        ns.print("❌ Anda belum membuat Gang!");
        ns.print("👉 Silakan bergabung ke faksi (misal: Slum Snakes) lalu klik tab Faction -> Create Gang (Pilih Combat).");
        return;
    }

    const EQUIPMENT_LIMIT_PERCENT = 0.20; // Max 20% uang tunai untuk beli equip per siklus
    const ASCENSION_THRESHOLD = 1.15; // Set 1.15 untuk mid-game, lebih sering ascend
    const WANTED_PENALTY_LIMIT = 0.98; // Mulai lakukan vigilante jika penalty menyentuh 2%
    const MIN_TRAINING_STAT = 400;    // Standar minimal stats untuk lulus dari pelatihan
    const POWER_BUILD_RATIO = 0.20;   // 20% anggota terkuat di-assign "Territory Warfare" untuk build Power
    // Warfare TIDAK diaktifkan — hanya akumulasi Power pasif!

    while (true) {
        ns.clearLog();
        ns.print("====================================");
        ns.print(" ⚔️ PRO V1: GANG SYNDICATE MASTER (MED) ");
        ns.print("====================================");

        let gangInfo = ns.gang.getGangInformation();
        ns.print(`💰 Pendapatan : $${ns.formatNumber(gangInfo.moneyGainRate * 5)} / detik`);
        ns.print(`👑 Respect    : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`🚨 Wanted Lvl : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${(100 - gangInfo.wantedPenalty * 100).toFixed(2)}%)`);
        ns.print(`⚡ Power      : ${ns.formatNumber(gangInfo.power)} | 🗺️ Territory: ${(gangInfo.territory * 100).toFixed(2)}%`);

        // Pastikan Warfare SELALU OFF — kita hanya build Power, tidak mau bentrok
        ns.gang.setTerritoryWarfare(false);

        recruitMembers(ns);
        manageAscension(ns, ASCENSION_THRESHOLD);
        buyEquipment(ns, EQUIPMENT_LIMIT_PERCENT);
        assignTasks(ns, gangInfo, WANTED_PENALTY_LIMIT, MIN_TRAINING_STAT, POWER_BUILD_RATIO);

        await ns.sleep(5000);
    }
}

// ==========================================
// 1. REKRUT ANGGOTA BARU SECARA OTOMATIS
// ==========================================
function recruitMembers(ns) {
    while (ns.gang.canRecruitMember()) {
        let members = ns.gang.getMemberNames();
        let newName = "Preman-" + (members.length + 1);
        if (ns.gang.recruitMember(newName)) {
            ns.print(`🎉 Berhasil merekrut anggota baru: ${newName}`);
        } else {
            break;
        }
    }
}

// ==========================================
// 2. SISTEM ASCENSION (REINKARNASI MENDADAK)
// ==========================================
function manageAscension(ns, threshold) {
    let members = ns.gang.getMemberNames();
    for (let member of members) {
        let result = ns.gang.getAscensionResult(member);
        if (!result) continue;

        // Jika Ascension memberikan peningkatan stats multiplier sesuai threshold (mid-game = 1.15x)
        let avgMultiplierGain = (result.str + result.def + result.dex + result.agi) / 4;
        if (avgMultiplierGain >= threshold) {
            ns.gang.ascendMember(member);
            ns.print(`✨ ASCENSION: ${member} naik level! (Multiplier Gain: ${avgMultiplierGain.toFixed(2)}x)`);
        }
    }
}

// ==========================================
// 3. PEMBELIAN EQUIPMENT & AUGMENTASI
// ==========================================
function buyEquipment(ns, budgetPercent) {
    let members = ns.gang.getMemberNames();
    let equipments = ns.gang.getEquipmentNames();

    // Urutkan equip dari yang termurah ke termahal
    equipments.sort((a, b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

    for (let member of members) {
        let memberInfo = ns.gang.getMemberInformation(member);

        for (let equip of equipments) {
            // Jika sudah punya, lewati
            if (memberInfo.upgrades.includes(equip) || memberInfo.augmentations.includes(equip)) continue;

            let cost = ns.gang.getEquipmentCost(equip);
            let budget = ns.getServerMoneyAvailable("home") * budgetPercent;

            // Jangan beli Hack-related equipment untuk Combat Gang agar hemat
            let equipStats = ns.gang.getEquipmentStats(equip);
            if (equipStats.hack && !equipStats.str && !equipStats.def) continue;

            if (cost <= budget) {
                if (ns.gang.purchaseEquipment(member, equip)) {
                    ns.print(`🛍️ Membeli ${equip} untuk ${member} ($${ns.formatNumber(cost)})`);
                }
            }
        }
    }
}

// ==========================================
// 4. PEMBAGIAN TUGAS (COMBAT GANG)
//    + POWER BUILDING via Territory Warfare
// ==========================================
function assignTasks(ns, gangInfo, wantedPenaltyLimit, minTrainingStat, powerRatio) {
    let members = ns.gang.getMemberNames();
    let wantedPenalty = gangInfo.wantedPenalty;

    let needVigilante = wantedPenalty < wantedPenaltyLimit && gangInfo.wantedLevel > 10;
    let vigilanteAssigned = 0;

    let ranked = members.map(m => {
        let info = ns.gang.getMemberInformation(m);
        return { name: m, avg: (info.str + info.def + info.dex + info.agi) / 4, task: info.task };
    }).sort((a, b) => b.avg - a.avg);

    let warSlots = Math.floor(members.length * powerRatio);
    let warAssigned = 0;

    for (let { name, avg } of ranked) {
        let pTask = ns.gang.getMemberInformation(name).task;
        let nTask = "";

        if (avg < minTrainingStat) {
            nTask = "Train Combat";
        } else if (needVigilante && vigilanteAssigned < Math.max(1, Math.floor(members.length / 4))) {
            nTask = "Vigilante Justice";
            vigilanteAssigned++;
        } else if (warAssigned < warSlots && avg > minTrainingStat * 2) {
            nTask = "Territory Warfare";
            warAssigned++;
        } else if (members.length < 6) {
            nTask = avg < 250 ? "Mug People" : "Terrorism";
        } else if (avg < 500) { nTask = "Mug People"; }
        else if (avg < 1200) { nTask = Math.random() > 0.6 ? "Terrorism" : "Strongarm Civilians"; }
        else { nTask = "Human Trafficking"; }

        if (nTask !== "" && pTask !== nTask) {
            ns.gang.setMemberTask(name, nTask);
            ns.print(`🔄 ${name} (avg:${Math.floor(avg)}) → ${nTask}`);
        }
    }
    ns.print(`⚡ Power Builders: ${warAssigned}/${members.length} anggota`);
}
