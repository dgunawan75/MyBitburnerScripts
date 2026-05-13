/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0] || "n00dles";
    const scriptName = "ai/basic-hack.js";
    
    let servers = new Set(["home"]);
    let queue = ["home"];
    
    ns.tprint(`🚀 Memulai Botnet Awal Game! Target: ${target}`);
    
    // BFS untuk mencari semua server
    for (let server of queue) {
        let adjacent = ns.scan(server);
        for (let next of adjacent) {
            if (!servers.has(next)) {
                servers.add(next);
                queue.push(next);
            }
        }
    }
    
    for (let server of servers) {
        // Coba bobol server jika belum ada akses root
        if (!ns.hasRootAccess(server)) {
            let ports = 0;
            if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(server); ports++; }
            if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(server); ports++; }
            if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(server); ports++; }
            if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(server); ports++; }
            if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(server); ports++; }
            
            if (ns.getServerNumPortsRequired(server) <= ports) {
                ns.nuke(server);
                ns.tprint(`🔓 Rooted: ${server}`);
            }
        }
        
        // Jika sudah root, copy script dan jalankan!
        if (ns.hasRootAccess(server)) {
            // Bunuh script lama jika ada
            ns.killall(server);
            
            if (server !== "home") {
                await ns.scp(scriptName, server, "home");
            }
            
            let ramMaks = ns.getServerMaxRam(server);
            let ramTerpakai = server === "home" ? ns.getServerUsedRam("home") : 0;
            if (server === "home") {
                // Sisakan sedikit RAM di home agar kita bisa kerja
                ramMaks = Math.max(0, ramMaks - 32); 
            }
            
            let scriptRam = ns.getScriptRam(scriptName, "home");
            let threads = Math.floor((ramMaks - ramTerpakai) / scriptRam);
            
            if (threads > 0) {
                ns.exec(scriptName, server, threads, target);
                ns.print(`💉 Menginfeksi ${server} dengan ${threads} threads!`);
            }
        }
    }
    ns.tprint("✅ Selesai menyebarkan worm!");
}
