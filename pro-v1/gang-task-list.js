/** @param {NS} ns **/
// Script utilitas: tampilkan semua nama tugas gang yang valid
// Jalankan: run pro-v1/gang-task-list.js
export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();

    if (!ns.gang.inGang()) {
        ns.tprint("❌ Harus sudah bergabung gang dulu!");
        return;
    }

    let tasks = ns.gang.getTaskNames();

    ns.print("=== DAFTAR NAMA TUGAS GANG (VALID) ===\n");
    for (let i = 0; i < tasks.length; i++) {
        let info = ns.gang.getTaskStats(tasks[i]);
        ns.print(`${String(i + 1).padStart(2)}. "${tasks[i]}"`);
        ns.print(`     isHacking: ${info.isHacking} | combat: str${info.strWeight} def${info.defWeight}`);
    }

    ns.print(`\nTotal: ${tasks.length} tugas`);
    ns.print("\n📋 Copy format siap pakai:");
    ns.print(tasks.map(t => `"${t}"`).join(", "));
}
