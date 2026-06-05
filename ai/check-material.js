/** @param {NS} ns **/
export async function main(ns) {
    const C = ns.corporation;
    if (C.hasCorporation()) {
        const upgrades = [
            "FocusWires",
            "Neural Accelerators",
            "Speech Processor Implants",
            "Nuoptimal Nootropic Injector Implants",
            "Smart Factories",
            "Smart Storage",
            "Wilson Analytics",
            "ABC SalesBots",
            "Project Insight"
        ];
        
        ns.tprint("\n======= CORPORATE UPGRADES STATUS =======");
        for (let upg of upgrades) {
            try {
                let lvl = C.getUpgradeLevel(upg);
                let cost = C.getUpgradeLevelCost(upg);
                ns.tprint(`🔹 ${upg.padEnd(40)}: Lvl ${lvl} | Next Cost: $${ns.format.number(cost)}`);
            } catch (e) {
                ns.tprint(`❌ ${upg.padEnd(40)}: Error: ${e}`);
            }
        }
        ns.tprint("=========================================\n");
    } else {
        ns.tprint("No corporation found!");
    }
}
