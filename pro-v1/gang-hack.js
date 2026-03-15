/** @param {NS} ns */
// ============================================================
// GANG HACK — Hacking Gang Manager (Early/Base)
// Cocok untuk gang yang dibuat melalui NiteSec, The Black Hand
// atau Slum Snakes dengan memilih tipe HACKING.
//
// Tugas valid untuk HACKING GANG:
//   Train: "Train Hacking", "Train Charisma"
//   Wanted: "Ethical Hacking"
//   Income: "Ransomware" → "Phishing" → "Identity Theft"
//           → "DDoS Attacks" → "Plant Virus"
//           → "Fraud & Counterfeiting" → "Money Laundering"
//   Respect: "Cyberterrorism"
//   Power: "Territory Warfare"
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    if (!ns.gang.inGang()) {
        ns.print("❌ Anda belum membuat Gang!");
        return;
    }

    const EQUIPMENT_LIMIT_PERCENT = 0.20;
    const ASCENSION_THRESHOLD = 1.10; // Lebih sering ascend di early
    const WANTED_PENALTY_LIMIT = 0.85;
    const MIN_HACK_STAT = 100;  // Latihan sampai hack >= 100

    while (true) {
        ns.clearLog();
        let gangInfo = ns.gang.getGangInformation();

        ns.print("=========================================");
        ns.print(" 💻 GANG HACK MASTER (EARLY)");
        ns.print("=========================================");
        ns.print(`💰 Income   : $${ns.formatNumber(gangInfo.moneyGainRate * 5)}/dtk`);
        ns.print(`👑 Respect  : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`⚡ Power    : ${ns.formatNumber(gangInfo.power)}`);
        ns.print(`🗺️  Territory: ${(gangInfo.territory * 100).toFixed(2)}%`);
        ns.print(`🚨 Wanted   : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${((1 - gangInfo.wantedPenalty) * 100).toFixed(1)}%)`);

        recruitMembers(ns);
        manageAscension(ns, ASCENSION_THRESHOLD);
        buyEquipment(ns, EQUIPMENT_LIMIT_PERCENT);
        assignTasks(ns, gangInfo, WANTED_PENALTY_LIMIT, MIN_HACK_STAT);

        await ns.sleep(5000);
    }
}

function recruitMembers(ns) {
    while (ns.gang.canRecruitMember()) {
        let members = ns.gang.getMemberNames();
        let newName = "Hacker-" + (members.length + 1);
        if (ns.gang.recruitMember(newName)) {
            ns.print(`🎉 Rekrut: ${newName}`);
        } else break;
    }
}

function manageAscension(ns, threshold) {
    for (let m of ns.gang.getMemberNames()) {
        let result = ns.gang.getAscensionResult(m);
        if (!result) continue;
        // Hacking gang: fokus pada hack multiplier
        let gain = result.hack || 1;
        if (gain >= threshold) {
            ns.gang.ascendMember(m);
            ns.print(`✨ ASCENSION: ${m} (hack×${gain.toFixed(2)})`);
        }
    }
}

function buyEquipment(ns, budgetPct) {
    let equips = ns.gang.getEquipmentNames()
        .sort((a, b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

    for (let m of ns.gang.getMemberNames()) {
        let info = ns.gang.getMemberInformation(m);
        for (let eq of equips) {
            if (info.upgrades.includes(eq) || info.augmentations.includes(eq)) continue;
            let cost = ns.gang.getEquipmentCost(eq);
            let budget = ns.getServerMoneyAvailable("home") * budgetPct;
            let stats = ns.gang.getEquipmentStats(eq);
            // Hacking gang: skip pure combat equipment (str/def tanpa hack)
            if ((stats.str || stats.def) && !stats.hack && !stats.cha) continue;
            if (cost <= budget) {
                if (ns.gang.purchaseEquipment(m, eq))
                    ns.print(`🛍️ ${eq} → ${m}`);
            }
        }
    }
}

function assignTasks(ns, gangInfo, wantedLimit, minHack) {
    let members = ns.gang.getMemberNames();
    let needVigilante = gangInfo.wantedPenalty < wantedLimit && gangInfo.wantedLevel > 10;
    let vigilanteCount = 0;

    for (let m of members) {
        let info = ns.gang.getMemberInformation(m);
        let hack = info.hack;
        let pTask = info.task;
        let nTask = "";

        // 1. Latihan jika hack masih rendah
        if (hack < minHack) {
            nTask = "Train Hacking";
        }
        // 2. Kurangi Wanted jika terlalu tinggi
        else if (needVigilante && vigilanteCount < Math.max(1, Math.floor(members.length / 4))) {
            nTask = "Ethical Hacking";
            vigilanteCount++;
        }
        // 3. Gang kecil → cari Respect dulu
        else if (members.length < 6) {
            nTask = hack < 200 ? "Ransomware" : "Cyberterrorism";
        }
        // 4. Progression income berdasarkan hack stat
        else if (hack < 300) { nTask = "Ransomware"; }
        else if (hack < 600) { nTask = "Phishing"; }
        else if (hack < 1000) { nTask = "Identity Theft"; }
        else if (hack < 2000) { nTask = Math.random() > 0.5 ? "DDoS Attacks" : "Fraud & Counterfeiting"; }
        else { nTask = "Money Laundering"; }

        if (nTask && pTask !== nTask) {
            ns.gang.setMemberTask(m, nTask);
            ns.print(`🔄 ${m} (hack:${Math.floor(hack)}) → ${nTask}`);
        }
    }
}
