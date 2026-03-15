/** @param {NS} ns **/
// ================================================================
// HARI 6: Async/Await — Pemrograman Asinkron
// Jalankan di Bitburner: run learn/hari-6.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 6: Async / Await ===\n");

    // ---------------------------------------------------------
    // MATERI 6.1: Mengapa Async?
    // ---------------------------------------------------------
    ns.print("[6.1] Tanpa async, program akan menunggu SETIAP operasi selesai");
    ns.print("      sebelum lanjut. Dengan async, kita bisa 'menunggu' tanpa");
    ns.print("      memblokir seluruh program.");
    ns.print("");
    ns.print("      Analogi: Anda memasak air (await) sambil tetap bisa");
    ns.print("      menyiapkan bahan lain. Tidak perlu berdiri diam menonton kompor.");
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 6.2: await ns.sleep() — jeda eksekusi
    // Ini adalah await paling dasar yang dipakai di SEMUA script
    // ---------------------------------------------------------
    ns.print("[6.2] Simulasi 3 siklus hack dengan jeda 1 detik:");

    for (let i = 1; i <= 3; i++) {
        ns.print(`  Siklus ${i}: Menjalankan hack...`);
        await ns.sleep(1000);          // ← Tunggu 1 detik lalu lanjut
        ns.print(`  Siklus ${i}: Selesai! ✅`);
    }
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 6.3: async function — fungsi yang bisa di-await
    // ---------------------------------------------------------
    async function persiapkanServer(nama, delay) {
        ns.print(`  🔄 Menyiapkan ${nama}...`);
        await ns.sleep(delay);
        ns.print(`  ✅ ${nama} siap! (setelah ${delay}ms)`);
        return `${nama}-ready`;
    }

    ns.print("[6.3] Persiapan server secara berurutan:");
    let hasil1 = await persiapkanServer("pserv-0", 800);
    let hasil2 = await persiapkanServer("pserv-1", 600);
    ns.print(`  Hasil: ${hasil1}, ${hasil2}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 6.4: Pola Loop Utama (while true)
    // Ini adalah INTI dari hampir semua script Bitburner
    // ---------------------------------------------------------
    ns.print("[6.4] Pola main loop (3 iterasi saja untuk demo):");

    let iterasi = 0;
    let maxIterasi = 3;
    let uangSimulasi = 500_000;

    while (iterasi < maxIterasi) {
        iterasi++;
        let hackResult = Math.floor(uangSimulasi * 0.05); // Ambil 5% tiap siklus
        uangSimulasi += hackResult;

        ns.print(`  Loop ${iterasi}: Hack +$${hackResult.toLocaleString()} | Total: $${uangSimulasi.toLocaleString()}`);
        await ns.sleep(500);  // Jeda pendek agar log terbaca
    }

    ns.print("");

    // ---------------------------------------------------------
    // MATERI 6.5: Perbedaan dengan/tanpa await
    // ---------------------------------------------------------
    ns.print("[6.5] PENTING — Jangan lupa 'await'!");
    ns.print("   BENAR: await ns.sleep(1000)  → program beneran tunggu 1 detik");
    ns.print("   SALAH: ns.sleep(1000)         → program TIDAK tunggu! Bug!");
    ns.print("");
    ns.print("   Ini seperti menyuruh orang mengerjakan tugas lalu langsung");
    ns.print("   memeriksa hasilnya tanpa menunggu dia selesai. 🙅");
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 6.6: try/catch untuk tangani error
    // ---------------------------------------------------------
    ns.print("[6.6] try/catch — tangani error dengan elegan:");

    async function operasiBerisiko(nilaiInput) {
        try {
            if (nilaiInput <= 0) throw new Error("Nilai tidak boleh nol atau negatif!");
            let hasil = 1000 / nilaiInput;
            ns.print(`  ✅ Hasil: ${hasil.toFixed(2)}`);
            return hasil;
        } catch (error) {
            ns.print(`  ⚠️ Error ditangkap: ${error.message}`);
            return null;    // Kembalikan null jika gagal — program tetap jalan!
        }
    }

    await operasiBerisiko(50);   // Berhasil
    await operasiBerisiko(0);    // Error — tapi program tidak crash!
    await operasiBerisiko(25);   // Berhasil lagi

    ns.print("");
    ns.print("=== ✅ Selesai Hari 6! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Tambah iterasi loop dari 3 ke 10, lihat uang tumbuh");
    ns.print("  2. Ubah ns.sleep(1000) menjadi ns.sleep(2000) — apa bedanya?");
    ns.print("  3. Buat fungsi async yang simulasikan proses gang join faction");
}
