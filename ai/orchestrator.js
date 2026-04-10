/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Memulai Singularity Orchestrator ULTIMATE (Kawal dari Miskin s/d Gang)");
    ns.ui.openTail();

    const PROGRAMS = [
        { name: "BruteSSH.exe", cost: 500_000, portFn: ns.brutessh },
        { name: "FTPCrack.exe", cost: 1_500_000, portFn: ns.ftpcrack },
        { name: "relaySMTP.exe", cost: 5_000_000, portFn: ns.relaysmtp },
        { name: "HTTPWorm.exe", cost: 30_000_000, portFn: ns.httpworm },
        { name: "SQLInject.exe", cost: 250_000_000, portFn: ns.sqlinject },
        { name: "Formulas.exe", cost: 5_000_000_000, portFn: null }
    ];

    while (true) {
        let config = readConfig(ns);
        let money = ns.getServerMoneyAvailable("home");
        let player = ns.getPlayer();
        let hackLvl = player.skills ? player.skills.hacking : player.hacking;
        let strLvl = player.skills ? player.skills.strength : player.strength;
        let defLvl = player.skills ? player.skills.defense : player.defense;
        let dexLvl = player.skills ? player.skills.dexterity : player.dexterity;
        let agiLvl = player.skills ? player.skills.agility : player.agility;

        // 1. AUTO-ROOTER GLOBAL
        let servers = scanAll(ns);
        let rootCount = 0;
        for (let s of servers) {
            if (!ns.hasRootAccess(s)) {
                let openPorts = 0;
                for (let p of PROGRAMS) {
                    if (p.portFn && ns.fileExists(p.name, "home")) {
                        try { p.portFn(s); openPorts++; } catch (e) { }
                    }
                }
                if (openPorts >= ns.getServerNumPortsRequired(s)) {
                    try { ns.nuke(s); rootCount++; } catch (e) { }
                }
            }
        }
        if (rootCount > 0) ns.print(`💣 [ROOT] Sistem berhasil menembus dan me-root ${rootCount} server baru!`);

        // 2. AUTO-BELI TOR & PROGRAM
        if (!ns.hasTorRouter() && money > 250_000) {
            if (ns.singularity.purchaseTor()) {
                ns.print("🌐 [TOR] Berhasil membobol saluran Darkweb!");
                money -= 200_000;
            }
        }

        if (ns.hasTorRouter()) {
            for (let prog of PROGRAMS) {
                if (!ns.fileExists(prog.name, "home") && money >= prog.cost * 2) {
                    if (ns.singularity.purchaseProgram(prog.name)) {
                        ns.print(`🔓 [PROGRAM] Auto-Download ${prog.name} selesai. (Kemampuan Nuke meningkat)`);
                        money -= prog.cost;
                    }
                }
            }
        }

        // 3. AUTO-TERIMA FRAKSI
        let invites = ns.singularity.checkFactionInvitations();
        for (let faction of invites) {
            if (ns.singularity.joinFaction(faction)) {
                ns.print(`🤝 [FACTION] Undangan diterima otomatis: Bergabung dengan aliansi ${faction}`);
            }
        }

        // 4. AUTO-UPGRADE RAM
        let ramCost = ns.singularity.getUpgradeHomeRamCost();
        if (ramCost > 0 && money >= config.reserve + ramCost) {
            if (ns.singularity.upgradeHomeRam()) {
                ns.print(`💻 [UPGRADE] Menggandakan RAM Home menjadi ${ns.getServerMaxRam("home")}GB!`);
                money -= ramCost;
            }
        }

        // 5. FITUR AUTO-SURVIVAL & GYM (Perubahan: Gym Ngutang sampai 50)
        let currentWork = ns.singularity.getCurrentWork();
        let isIdle = (currentWork === null);

        let minCombat = Math.min(strLvl, defLvl, dexLvl, agiLvl);

        // Evaluasi stat mana yang harus dilatih SETIAP DETIK (Kunci perpindahan gym otomatis)
        let statTrain = "Strength";
        if (strLvl >= 50) statTrain = "Defense";
        if (strLvl >= 50 && defLvl >= 50) statTrain = "Dexterity";
        if (strLvl >= 50 && defLvl >= 50 && dexLvl >= 50) statTrain = "Agility";

        if (isIdle) {
            // A. Kejar Hack 50 
            if (hackLvl < 50) {
                if (ns.singularity.universityCourse("Rothman University", "Study Computer Science", false)) {
                    ns.print("� [STUDY] Auto-Kuliah Ilmu Komputer (Kejar Hack Lvl 50)");
                }
            }
            // B. Mampir ke GYM (Target Base Stat 50, Bebas Ngutang jika miskin)
            else if (minCombat < 50) {
                ns.singularity.gymWorkout("Powerhouse Gym", statTrain, false);
                ns.print(`�️ [GYM] Latihan (Boleh Utang): Membentuk ${statTrain} (Target Semua 50)...`);
            }
            // C. Jika Hacking dan Tubuh kuat sudah ada, jadilah preman
            else if (money < 15_000_000) {
                let mugChance = ns.singularity.getCrimeChance("Mug");
                let homChance = ns.singularity.getCrimeChance("Homicide");

                let crime = "Shoplift";
                if (homChance > 0.60) crime = "Homicide";
                else if (mugChance > 0.65) crime = "Mug";

                ns.singularity.commitCrime(crime);
                ns.print(`🥷 [Kriminal] Beraksi melakukan ${crime} otomatis (Peluang Lolos: ${(ns.singularity.getCrimeChance(crime) * 100).toFixed(0)}%)`);
            }
        } else {
            if (currentWork.type === "CLASS" && currentWork.classType === "COMPUTER SCIENCE" && hackLvl >= 50) {
                ns.singularity.stopAction();
            } else if (currentWork.type === "CLASS" && currentWork.classType !== "COMPUTER SCIENCE") {
                if (minCombat >= 50) {
                    ns.singularity.stopAction();
                    ns.print("🏋️ [GYM] Seluruh 4 Statistik fisik mencapai 50. Siap membunuh di jalanan!");
                } else {
                    // PENTING: Mendorong transisi otomatis antar-stat
                    ns.singularity.gymWorkout("Powerhouse Gym", statTrain, false);
                }
            } else if (currentWork.type === "CRIME" && money >= 15_000_000) {
                ns.singularity.stopAction();
                ns.print("💰 [GRINDING] Uang modal minimum telah terkumpul ($15 Juta)!");
            }
        }

        // 6. AUTO-SWITCH ENGINE (3-Fase: Brain -> Early HWGW -> Full HWGW V4)
        let brainScript = "/ai/brain.js";
        let earlyEngine = "/pro-v4/dist-hwgw-v4-early.js";
        let fullEngine = "/pro-v4/dist-hwgw-v5.js";
        let hasFormulas = ns.fileExists("Formulas.exe", "home");

        // FASE 1: Level 0-49 — Hanya Brain.js
        if (hackLvl < 50) {
            if (ns.isRunning(earlyEngine, "home")) { ns.kill(earlyEngine, "home"); ns.print("🛑 [ENGINE] Stop Early HWGW."); }
            if (ns.isRunning(fullEngine, "home")) { ns.kill(fullEngine, "home"); ns.print("🛑 [ENGINE] Stop Full HWGW."); }
            if (!ns.isRunning(brainScript, "home") && ns.fileExists(brainScript, "home")) {
                ns.run(brainScript);
                ns.print("🌱 [ENGINE] Fase 1: Brain Engine (Kejar Hack Lvl 50)");
            }
        }
        // FASE 2: Level >=50 tapi belum ada Formulas.exe — Early HWGW
        else if (hackLvl >= 50 && !hasFormulas) {
            if (ns.isRunning(brainScript, "home")) { ns.kill(brainScript, "home"); ns.print("🛑 [ENGINE] Stop Brain."); }
            if (ns.isRunning(fullEngine, "home")) { ns.kill(fullEngine, "home"); ns.print("🛑 [ENGINE] Stop Full HWGW."); }
            if (!ns.isRunning(earlyEngine, "home") && ns.fileExists(earlyEngine, "home")) {
                ns.run(earlyEngine);
                ns.print("⚡ [ENGINE] Fase 2: Early HWGW Engine (Tanpa Formulas)");
            }
        }
        // FASE 3: Formulas.exe sudah ada — Full HWGW V4 (Presisi & Efisien Penuh)
        else if (hackLvl >= 50 && hasFormulas) {
            if (ns.isRunning(brainScript, "home")) { ns.kill(brainScript, "home"); ns.print("🛑 [ENGINE] Stop Brain."); }
            if (ns.isRunning(earlyEngine, "home")) { ns.kill(earlyEngine, "home"); ns.print("🛑 [ENGINE] Stop Early HWGW → Naik Kelas!"); }
            if (!ns.isRunning(fullEngine, "home") && ns.fileExists(fullEngine, "home")) {
                ns.run(fullEngine);
                ns.print("💥 [ENGINE] Fase 3: Full HWGW V4 (Formulas Presisi Aktif)!");
            }
        }

        // 8. AUTO-BUAT GANG (Cuma Create, Launching diurus Master Board)
        let karma = 0;
        try { karma = ns.heart.break(); } catch (e) { }

        if (karma <= -54000) {
            if (!ns.gang.inGang()) {
                if (ns.singularity.joinFaction("NiteSec")) {
                    if (ns.gang.createGang("NiteSec")) ns.print("💀 [GANG] Faksi NiteSec diubah menjadi Hacking Gang!");
                } else if (ns.singularity.joinFaction("The Black Hand")) {
                    if (ns.gang.createGang("The Black Hand")) ns.print("💀 [GANG] The Black Hand dijadikan Hacking Gang!");
                }
            }
        }

        // 9. MASTER BOARD SCRIPT MANAGER
        const SCRIPTS = {
            "auto-pserv": "/ai/auto-pserv.js",
            "auto-worker": "/ai/auto-worker.js",
            "stock": "/ai/stock-master-v4.js",
            "gang-med": "/pro-v1/gang-hack-med.js",
            "gang-war": "/pro-v1/gang-hack-war.js",
            "backdoor": "/ai/auto-backdoor.js"
        };

        for (let [key, path] of Object.entries(SCRIPTS)) {
            if (config[key] !== undefined) {
                let isRunning = ns.isRunning(path, "home");
                let shouldRun = config[key] === 1;

                // Safety: Gang script tidak boleh jalan kalau belum punya geng
                if ((key === "gang-med" || key === "gang-war") && !ns.gang.inGang()) shouldRun = false;
                // Safety: Jika war ON, matikan paksa med agar tidak rebutan equipment
                if (key === "gang-med" && config["gang-war"] === 1) shouldRun = false;

                if (shouldRun && !isRunning && ns.fileExists(path, "home")) {
                    ns.run(path);
                    ns.print(`▶️ [MASTER BOARD] ON: Menyalakan ${key}`);
                } else if (!shouldRun && isRunning) {
                    ns.kill(path, "home");
                    ns.print(`🛑 [MASTER BOARD] OFF: Mematikan ${key}`);
                }
            }
        }

        await ns.sleep(5000); // Dipercepat 5 dtk agar config lebih real-time
    }
}

// Master Config Parser
function readConfig(ns) {
    let cfg = { reserve: 10e9, "auto-pserv": 0, "auto-worker": 0, stock: 0, "gang-med": 0, "gang-war": 0 };
    let raw = ns.read("config.txt");
    if (!raw) return cfg;
    for (let line of raw.split("\n")) {
        let p = line.trim().split(/[\s:]+/);
        if (p.length >= 2 && !line.startsWith("#")) {
            let key = p[0].toLowerCase();
            let val = p[1].toLowerCase();
            if (key === "reserve") {
                let m = 1;
                if (val.endsWith("m")) m = 1e6; else if (val.endsWith("b")) m = 1e9; else if (val.endsWith("t")) m = 1e12;
                cfg[key] = parseFloat(val) * m;
            } else cfg[key] = parseInt(val) || 0;
        }
    }
    return cfg;
}

// Helper Scanner
function scanAll(ns) {
    let visited = new Set();
    let stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (visited.has(s)) continue;
        visited.add(s);
        for (let n of ns.scan(s)) stack.push(n);
    }
    return [...visited];
}
