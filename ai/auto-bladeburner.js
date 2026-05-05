/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("=========================================");
    ns.print(" 🗡️ AUTO BLADEBURNER (BN6 WIPE SYSTEM) ");
    ns.print("=========================================");

    while (!ns.bladeburner.inBladeburner()) {
        if (ns.bladeburner.joinBladeburnerDivision()) {
            ns.print("✅ Sukses masuk ke Divisi Bladeburner!");
        } else {
            ns.print("⏳ Gagal masuk Bladeburner. Butuh Stats Combat = 100.");
            await ns.sleep(60000);
            continue;
        }
    }

    const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

    const OPS = [
        { type: "Operations", name: "Assassination" },
        { type: "Operations", name: "Stealth Retirement Operation" },
        { type: "Operations", name: "Raid" },
        { type: "Operations", name: "Sting Operation" },
        { type: "Operations", name: "Undercover Operation" },
        { type: "Operations", name: "Investigation" },
        { type: "Contracts", name: "Retirement" },
        { type: "Contracts", name: "Bounty Hunter" },
        { type: "Contracts", name: "Tracking" }
    ];

    const SAFE_WIN_CHANCE = 0.75;
    const BLACKOP_WIN_CHANCE = 0.90;
    const HIGH_CHAOS = 50;

    ns.print("🤖 Mengaktifkan AI Tempur...");

    while (true) {
        ns.clearLog();
        ns.print("=========================================");
        ns.print(" 🗡️ BLADEBURNER AI — STATUS            ");
        ns.print("=========================================");

        let [stm, maxStm] = ns.bladeburner.getStamina();
        let hp = ns.getPlayer().hp.current;
        let maxHp = ns.getPlayer().hp.max;
        let city = ns.bladeburner.getCity();
        let chaos = ns.bladeburner.getCityChaos(city);
        let rank = ns.bladeburner.getRank();
        let sp = ns.bladeburner.getSkillPoints();

        ns.print(`🏙️ Lokasi   : ${city} (Chaos: ${chaos.toFixed(1)})`);
        ns.print(`⭐ Rank     : ${rank.toLocaleString()} (Skill Pts: ${sp})`);
        ns.print(`❤️ Health   : ${hp} / ${maxHp}`);
        ns.print(`🏃 Stamina  : ${stm.toFixed(0)} / ${maxStm.toFixed(0)}`);

        // ==========================
        // 1. AUTO UPGRADE SKILLS & TEAM
        // ==========================
        upgradeSkills(ns);
        autoAssignTeam(ns);

        // ==========================
        // 2. STAMINA & HP MANAGEMENT
        // ==========================
        if (hp < maxHp * 0.5) {
            await doAction(ns, "General", "Hyperbolic Regeneration Chamber", "Sekarat! Regen HP.");
            continue;
        }

        if (stm < maxStm * 0.5) {
            await doAction(ns, "General", "Field Analysis", `Istirahat (Stamina < 50%). Memulihkan tenaga...`);
            continue;
        }

        // ==========================
        // 3. CHAOS MANAGEMENT
        // ==========================
        if (chaos > HIGH_CHAOS) {
            await doAction(ns, "General", "Diplomacy", `Chaos Terlalu Tinggi! Melakukan Diplomasi.`);
            continue;
        }

        // ==========================
        // 4. BLACK OPS (Tamatkan Game)
        // ==========================
        let nextBlackOp = getNextBlackOp(ns);
        if (nextBlackOp) {
            let [min, max] = ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", nextBlackOp.name);
            if (min >= BLACKOP_WIN_CHANCE && rank >= nextBlackOp.rank) {
                await doAction(ns, "Black Operations", nextBlackOp.name, `☠️ MENJALANKAN BLACK OPS! Mengincar kemenangan!`);
                continue;
            }
        }

        // ==========================
        // 5. AUTO OPERATIONS / CONTRACTS
        // ==========================
        let bestAction = null;

        for (let op of OPS) {
            let count = ns.bladeburner.getActionCountRemaining(op.type, op.name);
            
            if (count > 0) {
                // Kalibrasi level misi sebelum mengecek peluang menang
                optimizeActionLevel(ns, op.type, op.name);
                
                let [min, max] = ns.bladeburner.getActionEstimatedSuccessChance(op.type, op.name);
                if (min >= SAFE_WIN_CHANCE) {
                    bestAction = op;
                    break;
                }
            }
        }

        if (bestAction) {
            await doAction(ns, bestAction.type, bestAction.name, `Eksekusi ${bestAction.type}: ${bestAction.name}`);
        } else {
            ns.print(`🔍 Target prioritas habis/sulit di ${city}. Melakukan persiapan matang...`);

            // Bergantian melakukan Analisa (untuk Intelligence) dan Rekrutmen (untuk anggota militer)
            if (Math.random() > 0.5) {
                ns.bladeburner.startAction("General", "Field Analysis");
                await ns.sleep(ns.bladeburner.getActionTime("General", "Field Analysis"));
            } else {
                ns.bladeburner.startAction("General", "Recruitment");
                await ns.sleep(ns.bladeburner.getActionTime("General", "Recruitment"));
            }

            let nextCity = CITIES[(CITIES.indexOf(city) + 1) % CITIES.length];
            ns.bladeburner.switchCity(nextCity);
        }
    }
}

async function doAction(ns, type, name, logText) {
    ns.print(`>> ${logText}`);
    let time = ns.bladeburner.getActionTime(type, name);
    if (!ns.bladeburner.startAction(type, name)) {
        await ns.sleep(1000);
        return;
    }

    let elapsed = 0;
    while (elapsed < time) {
        let current = ns.bladeburner.getCurrentAction();
        if (current.name !== name) break;

        await ns.sleep(1000);
        elapsed += 1000;
    }
}

function getNextBlackOp(ns) {
    let blackOps = ns.bladeburner.getBlackOpNames();
    for (let name of blackOps) {
        if (ns.bladeburner.getActionCountRemaining("Black Operations", name) > 0) {
            let reqRank = ns.bladeburner.getBlackOpRank(name);
            return { name: name, rank: reqRank };
        }
    }
    return null;
}

function upgradeSkills(ns) {
    const PRIORITIES = [
        "Overclock",
        "Blade's Intuition",
        "Cloak",
        "Short-Circuit",
        "Digital Observer",
        "Tracer",
        "Reaper",
        "Evasive System"
    ];

    for (let skill of PRIORITIES) {
        let cost = ns.bladeburner.getSkillUpgradeCost(skill);
        let pts = ns.bladeburner.getSkillPoints();
        if (pts >= cost && cost > 0) {
            ns.bladeburner.upgradeSkill(skill);
            ns.print(`🆙 LEVEL UP SKILL: ${skill}!`);
            break;
        }
    }
}

function autoAssignTeam(ns) {
    const OPS = [
        "Assassination", "Stealth Retirement Operation", "Raid",
        "Sting Operation", "Undercover Operation", "Investigation"
    ];
    let blackOps = ns.bladeburner.getBlackOpNames();

    try {
        for (let op of OPS) {
            ns.bladeburner.setTeamSize("Operations", op, 999999);
        }
        for (let op of blackOps) {
            ns.bladeburner.setTeamSize("Black Operations", op, 999999);
        }
    } catch { }
}

// Sistem Kalibrasi Level Otomatis (V3 Optimization)
function optimizeActionLevel(ns, type, name) {
    if (type === "Black Operations" || type === "General") return; // Hanya Operations & Contracts yang punya Level
    
    // Matikan fitur AutoLevel bawaan game yang terlalu gegabah
    ns.bladeburner.setActionAutolevel(type, name, false);
    
    let currentLvl = ns.bladeburner.getActionCurrentLevel(type, name);
    let maxLvl = ns.bladeburner.getActionMaxLevel(type, name);
    let [min, max] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);

    // Jika peluang menangnya telalu kecil (Bahaya Mati), INSTAN turunkan level sampai aman
    while (min < 0.85 && currentLvl > 1) {
        currentLvl--;
        ns.bladeburner.setActionLevel(type, name, currentLvl);
        [min, max] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
    }
    
    // Jika peluang menangnya sangat aman (>95%), INSTAN naikkan level untuk melipatgandakan Uang & Reputasi
    while (min >= 0.95 && currentLvl < maxLvl) {
        currentLvl++;
        ns.bladeburner.setActionLevel(type, name, currentLvl);
        [min, max] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
        
        // Jika kita terlalu rakus menaikkan level dan tiba-tiba bahaya, mundur 1 langkah
        if (min < 0.85) {
            currentLvl--;
            ns.bladeburner.setActionLevel(type, name, currentLvl);
            break;
        }
    }
}
