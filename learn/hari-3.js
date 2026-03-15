/** @param {NS} ns **/
// ================================================================
// HARI 3: Perulangan — for, while, for...of, break, continue
// Jalankan di Bitburner: run learn/hari-3.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 3: Perulangan (Loop) ===\n");

    // ---------------------------------------------------------
    // MATERI 3.1: for klasik
    // Contoh: cari RAM terbesar yang bisa dibeli (dari smart-server-manager)
    // ---------------------------------------------------------
    ns.print("[3.1] for klasik — RAM Server Tersedia:");
    let anggaran = 5_000_000; // 5 juta
    let ramTerbaik = 0;

    for (let i = 1; i <= 20; i++) {
        let ram = Math.pow(2, i);           // 2^1=2, 2^2=4, ... (GB harus pangkat 2!)
        let cost = ram * 55000;              // estimasi harga: ram × $55.000
        if (cost > anggaran) break;          // Hentikan jika sudah tidak mampu beli
        ramTerbaik = ram;
        ns.print(`  2^${i} = ${ram}GB → $${cost.toLocaleString()}`);
    }
    ns.print(`  → Terbaik yang terjangkau: ${ramTerbaik}GB`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 3.2: for...of — iterasi array
    // Contoh: proses setiap saham (dari sell-all.js)
    // ---------------------------------------------------------
    ns.print("[3.2] for...of — Analisis Portofolio:");
    let saham = [
        { nama: "APHE", beli: 1000, sekarang: 1150, lembar: 100 },
        { nama: "ECP", beli: 5000, sekarang: 4800, lembar: 50 },
        { nama: "BLD", beli: 2000, sekarang: 2400, lembar: 200 },
        { nama: "NVMD", beli: 800, sekarang: 750, lembar: 300 },
    ];

    let totalProfit = 0;
    for (let s of saham) {
        let profit = (s.sekarang - s.beli) * s.lembar;
        let pct = ((s.sekarang - s.beli) / s.beli * 100).toFixed(1);
        let icon = profit >= 0 ? "📈" : "📉";
        totalProfit += profit;
        ns.print(`  ${icon} ${s.nama}: ${pct}% | Profit: $${profit.toLocaleString()}`);
    }
    ns.print(`  → TOTAL: $${totalProfit.toLocaleString()}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 3.3: while — loop sampai kondisi terpenuhi
    // Contoh: drain server sampai $0 (dari xp-farm.js)
    // ---------------------------------------------------------
    ns.print("[3.3] while — Simulasi Drain Server:");
    let uangServer = 1_000_000; // Server punya $1M
    let hackPerSiklus = 120_000; // Tiap hack ambil $120K
    let siklus = 0;

    while (uangServer > 0) {
        uangServer -= hackPerSiklus;
        siklus++;
        if (uangServer < 0) uangServer = 0; // Tidak bisa minus
    }
    ns.print(`  Server berhasil di-drain dalam ${siklus} siklus hack!`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 3.4: continue — skip iterasi tertentu
    // Contoh: skip server yang belum di-root
    // ---------------------------------------------------------
    ns.print("[3.4] continue — Skip Server Terkunci:");
    let daftarServer = [
        { nama: "home", rooted: true, ram: 512 },
        { nama: "n00dles", rooted: true, ram: 4 },
        { nama: "foodnstuff", rooted: true, ram: 16 },
        { nama: "zer0", rooted: false, ram: 32 }, // Terkunci!
        { nama: "sigma-cosmetics", rooted: true, ram: 16 },
        { nama: "avmnite-02h", rooted: false, ram: 64 }, // Terkunci!
    ];

    let totalRAM = 0;
    for (let server of daftarServer) {
        if (!server.rooted) {
            ns.print(`  ⏭️ Skip ${server.nama} (belum di-root)`);
            continue;                  // Langsung ke iterasi berikutnya
        }
        totalRAM += server.ram;
        ns.print(`  ✅ ${server.nama}: ${server.ram}GB`);
    }
    ns.print(`  → Total RAM tersedia: ${totalRAM}GB`);
    ns.print("");

    ns.print("=== ✅ Selesai Hari 3! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Ubah 'anggaran' ke $100 juta, lihat berapa GB bisa dibeli");
    ns.print("  2. Tambah saham baru ke array, lihat total profit berubah");
    ns.print("  3. Hitung: berapa siklus hack untuk drain $50 juta dengan $800K/siklus?");
}
