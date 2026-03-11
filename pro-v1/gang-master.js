/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("====================================");
    ns.print(" ⚔️ PRO V1: GANG SYNDICATE MASTER ");
    ns.print("====================================");

    if (!ns.gang.inGang()) {
        ns.print("❌ Anda belum membuat Gang!");
        ns.print("👉 Silakan bergabung ke faksi (misal: Slum Snakes) lalu klik tab Faction -> Create Gang (Pilih Combat).");
        return;
    }

    const EQUIPMENT_LIMIT_PERCENT = 0.20; // Max 20% uang tunai untuk beli equip per siklus

    while (true) {
        ns.clearLog();
        ns.print("====================================");
        ns.print(" ⚔️ PRO V1: GANG SYNDICATE MASTER ");
        ns.print("====================================");

        let gangInfo = ns.gang.getGangInformation();
        ns.print(`💰 Pendapatan : $${ns.formatNumber(gangInfo.moneyGainRate * 5)} / detik`);
        ns.print(`👑 Respect    : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`🚨 Wanted Lvl : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${(100 - gangInfo.wantedPenalty * 100).toFixed(2)}%)`);

        recruitMembers(ns);
        manageAscension(ns);
        buyEquipment(ns, EQUIPMENT_LIMIT_PERCENT);
        assignTasks(ns, gangInfo);

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
function manageAscension(ns) {
    let members = ns.gang.getMemberNames();
    for (let member of members) {
        let result = ns.gang.getAscensionResult(member);
        if (!result) continue;

        // Jika Ascension memberikan peningkatan stats multiplier minimal 1.5x (50%), lakukan Ascension!
        let avgMultiplierGain = (result.str + result.def + result.dex + result.agi) / 4;
        if (avgMultiplierGain >= 1.5) {
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
// 4. PEMBAGIAN TUGAS CERDAS (AI ASSIGNMENT)
// ==========================================
function assignTasks(ns, gangInfo) {
    let members = ns.gang.getMemberNames();
    let wantedPenalty = gangInfo.wantedPenalty; // Semakin dekat ke 1, semakin tidak ada penalti

    // Jika penalty di bawah 0.85 (15% kerugian stats), butuh seseorang untuk Vigilante Justice menurunkan Wanted level.
    let needVigilante = wantedPenalty < 0.85 && gangInfo.wantedLevel > 10;
    let vigilanteAssigned = 0;

    for (let member of members) {
        let info = ns.gang.getMemberInformation(member);
        let avgStats = (info.str + info.def + info.dex + info.agi) / 4;
        let pTask = info.task; // current task
        let nTask = ""; // new task

        // Aturan 1: Anak baru disuruh sekolah (Train Combat)
        if (avgStats < 100) {
            nTask = "Train Combat";
        }
        // Aturan 2: Jika butuh penurun Wanted Level, dan anak ini cukup kuat
        else if (needVigilante && vigilanteAssigned < Math.max(1, Math.floor(members.length / 4)) && avgStats > 200) {
            nTask = "Vigilante Justice";
            vigilanteAssigned++;
        }
        // Aturan 3: Preman kroco (Cari modal awal)
        else if (avgStats < 300) {
            nTask = "Mug People";
        }
        // Aturan 4: Preman menengah (Cari modal lebih besar)
        else if (avgStats < 700) {
            nTask = "Strongarm Assassinations";
        }
        // Aturan 5: Bandar Kelas Kakap (Mesin Uang Utama Miliaran)
        else {
            nTask = "Human Trafficking";
        }

        if (nTask !== "" && pTask !== nTask) {
            ns.gang.setMemberTask(member, nTask);
            ns.print(`🔄 Menggeser ${member} ke tugas: ${nTask}`);
        }
    }
}
