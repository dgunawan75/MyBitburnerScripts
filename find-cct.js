/** @param {NS} ns */
export async function main(ns) {
    // 1. Kumpulkan semua server menggunakan algoritma BFS (Breadth-First Search)
    const servers = new Set(["home"]);
    const queue = ["home"];
    
    for (let server of queue) {
        let adjacent = ns.scan(server);
        for (let next of adjacent) {
            if (!servers.has(next)) {
                servers.add(next);
                queue.push(next);
            }
        }
    }
    
    let totalCCT = 0;
    ns.tprint("===== PENCARIAN CODING CONTRACTS (.cct) =====");
    
    // 2. Cek setiap server apakah memiliki file berakhiran ".cct"
    for (let server of servers) {
        let files = ns.ls(server, ".cct");
        
        if (files.length > 0) {
            ns.tprint(`\n🖥️ Server: ${server}`);
            for (let file of files) {
                // Mendapatkan tipe kontrak (Opsional, tapi sangat berguna)
                let type = ns.codingcontract.getContractType(file, server);
                ns.tprint(`   📄 [ ${file} ] ---> Tipe: "${type}"`);
                totalCCT++;
            }
        }
    }
    
    ns.tprint("\n=============================================");
    if (totalCCT === 0) {
        ns.tprint("❌ Tidak ada Coding Contract (.cct) yang ditemukan di seluruh network.");
    } else {
        ns.tprint(`✅ Total Ditemukan: ${totalCCT} buah Coding Contract.`);
    }
}
