/** @param {NS} ns **/
export async function main(ns) {

    const hackScript = "hack-template.js";

    while (true) {

        const servers = scanAll(ns);

        rootAll(ns, servers);

        let target = findBestTarget(ns, servers);

        await deployAll(ns, servers, hackScript, target);

        await managePurchasedServers(ns);

        ns.print("Current target: " + target);

        await ns.sleep(60000);
    }
}


function scanAll(ns) {

    let visited = new Set();
    let stack = ["home"];

    while (stack.length > 0) {

        let server = stack.pop();

        if (!visited.has(server)) {

            visited.add(server);

            for (let next of ns.scan(server)) {
                stack.push(next);
            }

        }
    }

    return [...visited];
}


function rootAll(ns, servers) {

    for (let server of servers) {

        if (server === "home") continue;
        if (ns.hasRootAccess(server)) continue;

        tryOpenPorts(ns, server);

        if (ns.getServerNumPortsRequired(server) <= portCount(ns)) {

            ns.nuke(server);
            ns.print("Rooted: " + server);

        }

    }
}


function tryOpenPorts(ns, server) {

    if (ns.fileExists("BruteSSH.exe")) ns.brutessh(server);
    if (ns.fileExists("FTPCrack.exe")) ns.ftpcrack(server);
    if (ns.fileExists("relaySMTP.exe")) ns.relaysmtp(server);
    if (ns.fileExists("HTTPWorm.exe")) ns.httpworm(server);
    if (ns.fileExists("SQLInject.exe")) ns.sqlinject(server);

}


function portCount(ns) {

    let count = 0;

    if (ns.fileExists("BruteSSH.exe")) count++;
    if (ns.fileExists("FTPCrack.exe")) count++;
    if (ns.fileExists("relaySMTP.exe")) count++;
    if (ns.fileExists("HTTPWorm.exe")) count++;
    if (ns.fileExists("SQLInject.exe")) count++;

    return count;
}


function findBestTarget(ns, servers) {

    let bestServer = "n00dles";
    let bestMoney = 0;

    for (let server of servers) {

        if (!ns.hasRootAccess(server)) continue;

        let money = ns.getServerMaxMoney(server);

        if (money > bestMoney) {

            bestMoney = money;
            bestServer = server;

        }
    }

    return bestServer;
}


async function deployAll(ns, servers, script, target) {

    for (let server of servers) {

        if (!ns.hasRootAccess(server)) continue;
        if (server === "home") continue;

        let ram = ns.getServerMaxRam(server);
        let scriptRam = ns.getScriptRam(script);

        let threads = Math.floor(ram / scriptRam);

        if (threads > 0) {

            await ns.scp(script, server);

            ns.exec(script, server, threads, target);

        }

    }

}


async function managePurchasedServers(ns) {

    const limit = ns.getPurchasedServerLimit();
    const ram = 32;

    if (ns.getPurchasedServers().length < limit) {

        let cost = ns.getPurchasedServerCost(ram);

        if (ns.getServerMoneyAvailable("home") > cost) {

            let name = "pserv-" + Date.now();

            ns.purchaseServer(name, ram);

            ns.print("Purchased server: " + name);

        }

    }

}