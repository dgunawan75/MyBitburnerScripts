/** @param {NS} ns **/
import { manageServers } from "/modules/smart-server-manager-v2.js"

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    ns.print("====================================");
    ns.print(" 🚀 AUTO-PSERV BUYER (BACKGROUND)   ");
    ns.print("====================================");

    // Interval dalam milidetik.
    // Default: 10 detik sekali nge-cek dompet.
    let interval = 10000;
    if (ns.args.length > 0 && typeof ns.args[0] === 'number') {
        interval = ns.args[0];
    }

    ns.print(`Berjalan di background. Mengecek uang setiap ${interval / 1000} detik...`);

    while (true) {
        await manageServers(ns);
        await ns.sleep(interval);
    }
}
