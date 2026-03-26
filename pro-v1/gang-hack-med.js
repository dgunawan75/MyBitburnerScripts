/** @param {NS} ns */
// ============================================================
// GANG HACK MED — Hacking Gang Manager (Mid Game)
// Power Building via Territory Warfare + Ascension agresif
// ============================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    if (!ns.gang.inGang()) { ns.print("❌ Belum di Gang!"); return; }

    const EQUIPMENT_LIMIT_PERCENT = 0.20;
    const ASCENSION_THRESHOLD = 1.15;
    const WANTED_PENALTY_LIMIT = 0.98;
    const MIN_HACK_STAT = 400;
    const POWER_BUILD_RATIO = 0.20; // 20% anggota terkuat → Territory Warfare

    // Pastikan warfare OFF — hanya build power pasif
    ns.gang.setTerritoryWarfare(false);

    while (true) {
        ns.clearLog();
        let gangInfo = ns.gang.getGangInformation();

        ns.print("=========================================");
        ns.print(" 💻 GANG HACK MED + POWER BUILD");
        ns.print("=========================================");
        ns.print(`💰 Income   : $${ns.formatNumber(gangInfo.moneyGainRate * 5)}/dtk`);
        ns.print(`👑 Respect  : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`⚡ Power    : ${ns.formatNumber(gangInfo.power)}`);
        ns.print(`🗺️  Territory: ${(gangInfo.territory * 100).toFixed(2)}%`);
        ns.print(`🚨 Wanted   : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${((1 - gangInfo.wantedPenalty) * 100).toFixed(1)}%)`);

        ns.gang.setTerritoryWarfare(false); // Selalu OFF dalam mode ini

        recruitMembers(ns);
        manageAscension(ns, ASCENSION_THRESHOLD);
        buyEquipment(ns, EQUIPMENT_LIMIT_PERCENT);
        assignTasks(ns, gangInfo, WANTED_PENALTY_LIMIT, MIN_HACK_STAT, POWER_BUILD_RATIO);

        await ns.sleep(5000);
    }
}

function recruitMembers(ns) {
    let members = ns.gang.getMemberNames();
    let index = 1;
    while (ns.gang.canRecruitMember()) {
        let newName = "Hacker-" + index;
        if (members.includes(newName)) {
            index++;
            continue;
        }
        if (ns.gang.recruitMember(newName)) {
            ns.print(`🎉 Rekrut: ${newName}`);
            members.push(newName);
            index++;
        } else {
            break;
        }
    }
}

function manageAscension(ns, threshold) {
    for (let m of ns.gang.getMemberNames()) {
        let result = ns.gang.getAscensionResult(m);
        if (!result) continue;
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

            // Hacker gang tetap butuh Weapon, Armor & Vehicle jika ingin bertahan di Territory Warfare
            if (cost <= budget && ns.gang.purchaseEquipment(m, eq))
                ns.print(`🛍️ ${eq} → ${m}`);
        }
    }
}

function assignTasks(ns, gangInfo, wantedLimit, minHack, powerRatio) {
    let members = ns.gang.getMemberNames();
    let needVigilante = gangInfo.wantedPenalty < wantedLimit && gangInfo.wantedLevel > 10;
    let vigilanteCount = 0;

    // Sortir dari hack stat tertinggi ke terendah
    let ranked = members.map(m => {
        let info = ns.gang.getMemberInformation(m);
        let combat = (info.str + info.def + info.dex + info.agi) / 4;
        return { name: m, hack: info.hack, combat: combat };
    }).sort((a, b) => b.hack - a.hack);

    let warSlots = Math.floor(members.length * powerRatio);
    let warAssigned = 0;

    for (let { name, hack, combat } of ranked) {
        let pTask = ns.gang.getMemberInformation(name).task;
        let nTask = "";

        if (hack < minHack) {
            nTask = "Train Hacking";
        } else if (combat < 100) {
            nTask = "Train Combat";
        } else if (needVigilante && vigilanteCount < Math.max(1, Math.floor(members.length / 4))) {
            nTask = "Ethical Hacking";
            vigilanteCount++;
        } else if (warAssigned < warSlots && hack > minHack * 2) {
            nTask = "Territory Warfare";
            warAssigned++;
        } else if (members.length < 6) {
            nTask = hack < 250 ? "Ransomware" : "Cyberterrorism";
        } else if (hack < 600) { nTask = "Phishing"; }
        else if (hack < 1200) { nTask = Math.random() > 0.5 ? "Identity Theft" : "DDoS Attacks"; }
        else if (hack < 2500) { nTask = Math.random() > 0.5 ? "Plant Virus" : "Fraud & Counterfeiting"; }
        else { nTask = "Money Laundering"; }

        if (nTask && pTask !== nTask) {
            ns.gang.setMemberTask(name, nTask);
            ns.print(`🔄 ${name} (hack:${Math.floor(hack)} cbt:${Math.floor(combat)}) → ${nTask}`);
        }
    }
    ns.print(`⚡ Power Builders: ${warAssigned}/${members.length} anggota`);
}
