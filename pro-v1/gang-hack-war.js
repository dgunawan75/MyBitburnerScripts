/** @param {NS} ns */
// ============================================================
// GANG HACK WAR — Hacking Gang Territory Warfare Engine
// Aktifkan setelah 8+ anggota & Power cukup untuk bersaing.
// Analisa win-chance tiap gang musuh, engage jika aman.
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
    const WAR_WIN_CHANCE_MIN = 0.55; // Serang jika win chance > 55%
    const WAR_RETREAT_CHANCE = 0.65; // Retreat HANYA jika musuh > 65% menang lawan kita
    const MIN_MEMBERS_FOR_WAR = 8;
    const WARFARE_RATIO = 0.40;

    while (true) {
        ns.clearLog();
        let gangInfo = ns.gang.getGangInformation();
        let members = ns.gang.getMemberNames();
        let others = ns.gang.getOtherGangInformation();

        let warActive = gangInfo.territoryWarfareEngaged;
        ns.print("=========================================");
        ns.print(" 💻⚔️  GANG HACK WAR ENGINE");
        ns.print("=========================================");
        ns.print(`💰 Income   : $${ns.formatNumber(gangInfo.moneyGainRate * 5)}/dtk`);
        ns.print(`👑 Respect  : ${ns.formatNumber(gangInfo.respect)}`);
        ns.print(`⚡ Power    : ${ns.formatNumber(gangInfo.power)}`);
        ns.print(`🗺️  Territory: ${(gangInfo.territory * 100).toFixed(2)}%`);
        ns.print(`🚨 Wanted   : ${ns.formatNumber(gangInfo.wantedLevel)} (Penalty: ${((1 - gangInfo.wantedPenalty) * 100).toFixed(1)}%)`);
        ns.print(`⚔️  Warfare  : ${warActive ? "AKTIF" : "DAMAI"}`);

        // Analisa perang & keputusan
        let warDecision = analyzeWarfare(ns, others, members.length, WAR_WIN_CHANCE_MIN, WAR_RETREAT_CHANCE, MIN_MEMBERS_FOR_WAR);
        ns.gang.setTerritoryWarfare(warDecision.engage);

        if (warDecision.engage) {
            ns.print(`\n⚔️  Target  : ${warDecision.targetGang} (Win: ${(warDecision.bestWinChance * 100).toFixed(1)}%)`);
            ns.print(`   Hindari : ${warDecision.avoidGangs.join(", ") || "-"}`);
        } else {
            ns.print(`\n🛡️  Mode: Build Power (warfare OFF)`);
        }

        recruitMembers(ns);
        manageAscension(ns, ASCENSION_THRESHOLD);
        buyEquipment(ns, EQUIPMENT_LIMIT_PERCENT);
        assignTasks(ns, gangInfo, members, WANTED_PENALTY_LIMIT, MIN_HACK_STAT, warDecision.engage, WARFARE_RATIO);

        // Status gang lain
        ns.print("\n📊 Gang Lain:");
        for (let [name, info] of Object.entries(others).sort((a, b) => b[1].territory - a[1].territory)) {
            if (info.territory <= 0) continue;
            let win = ns.gang.getChanceToWinClash(name);
            let icon = win >= WAR_WIN_CHANCE_MIN ? "✅" : "⚠️";
            ns.print(`   ${icon} ${name}: ${(info.territory * 100).toFixed(1)}% | Win: ${(win * 100).toFixed(1)}%`);
        }

        await ns.sleep(5000);
    }
}

function analyzeWarfare(ns, others, memberCount, winMin, retreatThreshold, minMembers) {
    if (memberCount < minMembers)
        return { engage: false, targetGang: null, bestWinChance: 0, avoidGangs: [] };

    let bestWinChance = 0, targetGang = null, avoidGangs = [], shouldRetreat = false;
    for (let [name, info] of Object.entries(others)) {
        if (info.territory <= 0) continue;
        let win = ns.gang.getChanceToWinClash(name);
        let loseChance = 1 - win;

        // Retreat hanya jika ada musuh SANGAT kuat (> retreatThreshold)
        // DAN mereka punya territory besar (> 10%) — bukan jika sekadar 50/50
        if (loseChance > retreatThreshold && info.territory > 0.10) {
            shouldRetreat = true;
        }

        if (win < winMin) {
            avoidGangs.push(`${name}(${(win * 100).toFixed(0)}%)`);
        } else if (win > bestWinChance) {
            bestWinChance = win;
            targetGang = name;
        }
    }

    // Engage jika ada target yang bisa dikalahkan,
    // KECUALI ada musuh yang benar-benar berbahaya (jarang sekali)
    return {
        engage: targetGang !== null && !shouldRetreat,
        targetGang, bestWinChance, avoidGangs
    };
}

function assignTasks(ns, gangInfo, members, wantedLimit, minHack, warActive, warRatio) {
    let needVigilante = gangInfo.wantedPenalty < wantedLimit && gangInfo.wantedLevel > 10;
    let vigilanteCount = 0;

    let ranked = members.map(m => {
        let info = ns.gang.getMemberInformation(m);
        return { name: m, hack: info.hack };
    }).sort((a, b) => b.hack - a.hack);

    let warSlots = warActive ? Math.floor(members.length * warRatio) : 0;
    let warAssigned = 0;

    for (let { name, hack } of ranked) {
        let pTask = ns.gang.getMemberInformation(name).task;
        let nTask = "";

        if (hack < minHack) { nTask = "Train Hacking"; }
        else if (needVigilante && vigilanteCount < Math.max(1, Math.floor(members.length / 4))) {
            nTask = "Ethical Hacking"; vigilanteCount++;
        }
        else if (warActive && warAssigned < warSlots && hack > minHack * 2) {
            nTask = "Territory Warfare"; warAssigned++;
        }
        else if (members.length < 6) { nTask = hack < 250 ? "Ransomware" : "Cyberterrorism"; }
        else if (hack < 600) { nTask = "Phishing"; }
        else if (hack < 1200) { nTask = Math.random() > 0.5 ? "Identity Theft" : "DDoS Attacks"; }
        else if (hack < 2500) { nTask = Math.random() > 0.5 ? "Plant Virus" : "Fraud & Counterfeiting"; }
        else { nTask = "Money Laundering"; }

        if (nTask && pTask !== nTask) {
            ns.gang.setMemberTask(name, nTask);
            ns.print(`🔄 ${name} (hack:${Math.floor(hack)}) → ${nTask}`);
        }
    }
}

function recruitMembers(ns) {
    while (ns.gang.canRecruitMember()) {
        let names = ns.gang.getMemberNames();
        let newName = "Hacker-" + (names.length + 1);
        if (ns.gang.recruitMember(newName)) ns.print(`🎉 Rekrut: ${newName}`);
        else break;
    }
}

function manageAscension(ns, threshold) {
    for (let m of ns.gang.getMemberNames()) {
        let result = ns.gang.getAscensionResult(m);
        if (!result) continue;
        if ((result.hack || 1) >= threshold) {
            ns.gang.ascendMember(m);
            ns.print(`✨ ASCENSION: ${m}`);
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
            if ((stats.str || stats.def) && !stats.hack && !stats.cha) continue;
            if (cost <= budget && ns.gang.purchaseEquipment(m, eq))
                ns.print(`🛍️ ${eq} → ${m}`);
        }
    }
}
