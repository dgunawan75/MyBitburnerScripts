/*
 * kill-all-network.js — Kill semua proses di jaringan
 *
 * Tanpa parameter : Kill SEMUA server (home + pserv-* + nuked NPC)
 *   --nuke        : Hanya server hasil nuke (NPC, bukan pserv-* / home)
 *   --pserv       : Hanya server pserv-*
 *   --nuke --pserv: Keduanya (NPC + pserv-*, tidak termasuk home)
 */
/** @param {NS} ns **/
export async function main(ns) {
    const filterNuke = ns.args.includes("--nuke");
    const filterPserv = ns.args.includes("--pserv");
    const filterAny = filterNuke || filterPserv;

    let allServers = scanAll(ns);
    let targets = allServers.filter(s => {
        if (!filterAny) return true;                             // Tanpa flag → semua
        if (filterPserv && s.startsWith("pserv-")) return true;  // --pserv
        if (filterNuke && s !== "home" && !s.startsWith("pserv-") && ns.hasRootAccess(s)) return true; // --nuke
        return false;
    });

    let modeLabel = !filterAny ? "🌐 SEMUA server"
        : filterNuke && filterPserv ? "🔓 NPC + 🖥️ pserv-*"
            : filterNuke ? "🔓 NPC hasil nuke saja"
                : "🖥️ pserv-* saja";

    ns.tprint(`⚡ Kill mode: ${modeLabel} (${targets.length} server)`);

    let killed = 0;
    for (let server of targets) {
        if (ns.killall(server)) {
            ns.tprint(`  🔴 Killed: ${server}`);
            killed++;
        }
    }

    ns.tprint(`✅ Selesai. ${killed}/${targets.length} server di-kill.`);
}

function scanAll(ns) {
    let discovered = new Set(["home"]);
    let queue = ["home"];
    while (queue.length) {
        let server = queue.shift();
        for (let n of ns.scan(server)) {
            if (!discovered.has(n)) {
                discovered.add(n);
                queue.push(n);
            }
        }
    }
    return [...discovered];
}