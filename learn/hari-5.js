/** @param {NS} ns **/
// ================================================================
// HARI 5: Array & Object — filter, map, reduce, sort
// Jalankan di Bitburner: run learn/hari-5.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 5: Array & Object ===\n");

    // ---------------------------------------------------------
    // MATERI 5.1: Array Dasar
    // ---------------------------------------------------------
    let servers = ["home", "n00dles", "foodnstuff", "sigma-cosmetics",
        "pserv-0", "pserv-1", "pserv-2"];

    ns.print(`[5.1] Jumlah server: ${servers.length}`);
    ns.print(`[5.1] Server pertama: ${servers[0]}`);
    ns.print(`[5.1] Server terakhir: ${servers[servers.length - 1]}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 5.2: filter — ambil subset dari array
    // Contoh: pisahkan pserv dari server NPC (gain filterWorkers)
    // ---------------------------------------------------------
    let pservOnly = servers.filter(s => s.startsWith("pserv-"));
    let npcOnly = servers.filter(s => s !== "home" && !s.startsWith("pserv-"));

    ns.print(`[5.2] filter pserv-*: [${pservOnly.join(", ")}]`);
    ns.print(`[5.2] filter NPC: [${npcOnly.join(", ")}]`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 5.3: map — ubah setiap elemen menjadi bentuk baru
    // Contoh: buat object per anggota gang (dari gang-master-war.js)
    // ---------------------------------------------------------
    let namaAnggota = ["Preman-1", "Preman-2", "Preman-3", "Preman-4"];

    // Simulasi stats dengan nilai acak
    let anggota = namaAnggota.map((nama, index) => ({
        nama,
        str: 100 + index * 300,
        def: 90 + index * 280,
        avg: 95 + index * 290,   // rata-rata sederhana
    }));

    ns.print("[5.3] map — daftar anggota:");
    for (let a of anggota) {
        ns.print(`  ${a.nama} → avg stats: ${a.avg}`);
    }
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 5.4: sort — urutkan array
    // Contoh: sortir saham terbaik (dari stock-master-v5.js)
    // ---------------------------------------------------------
    let saham = [
        { sym: "APHE", ER: 0.0045 },
        { sym: "ECP", ER: 0.0120 },
        { sym: "BLD", ER: 0.0008 },
        { sym: "NVMD", ER: 0.0089 },
    ];

    saham.sort((a, b) => b.ER - a.ER); // Terbesar duluan

    ns.print("[5.4] sort — saham terbaik duluan:");
    saham.forEach((s, i) => {
        ns.print(`  #${i + 1} ${s.sym} → ER: ${(s.ER * 10000).toFixed(1)} BP`);
    });
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 5.5: reduce — agregasi nilai dari seluruh array
    // Contoh: total nilai portofolio (dari stock-master-v5.js)
    // ---------------------------------------------------------
    let posisi = [
        { sym: "APHE", lembar: 100, harga: 1150 },
        { sym: "ECP", lembar: 50, harga: 5200 },
        { sym: "BLD", lembar: 200, harga: 2400 },
    ];

    let totalNilai = posisi.reduce((akumulasi, s) => akumulasi + (s.lembar * s.harga), 0);
    ns.print(`[5.5] reduce — Total nilai saham: $${totalNilai.toLocaleString()}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 5.6: Object & Destructuring
    // Contoh: CONFIG pattern dari berbagai script
    // ---------------------------------------------------------
    const CONFIG = {
        MAX_SERVERS: 25,
        MIN_RAM: 8,
        BUDGET_PCT: 0.25,
        RESERVE_PCT: 0.10,
    };

    // Destructuring: ambil nilai dari object lebih ringkas
    let { MAX_SERVERS, MIN_RAM, BUDGET_PCT } = CONFIG;
    ns.print(`[5.6] Max Servers: ${MAX_SERVERS} | Min RAM: ${MIN_RAM}GB | Budget: ${BUDGET_PCT * 100}%`);

    // Spread operator: gabungkan/kopikan object
    let configTambahan = { ...CONFIG, BOOTSTRAP_THRESHOLD: 6 };
    ns.print(`[5.6] Config diperluas: ${JSON.stringify(configTambahan)}`);
    ns.print("");

    ns.print("=== ✅ Selesai Hari 5! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Dari 'servers', filter hanya yang panjang namanya < 8 karakter");
    ns.print("  2. Dari 'posisi', cari saham dengan nilai total terbesar (sort)");
    ns.print("  3. Hitung total lembar saham dari semua posisi menggunakan reduce");
    ns.print("  4. Tambah field 'grade' ke setiap anggota berdasarkan avg stats (map)");
}
