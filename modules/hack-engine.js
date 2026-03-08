export async function deployHack(ns, workers, targets) {

    for (let w of workers) {

        let ram = ns.getServerMaxRam(w) - ns.getServerUsedRam(w)

        // Sisakan 64GB RAM khusus di server "home" agar Anda bisa menjalankan script lain (seperti stock-master)
        if (w === "home") {
            ram -= 64;
        }

        if (ram < 2) continue

        let target = targets[Math.floor(Math.random() * targets.length)]

        await ns.scp(["/workers/hack.js", "/workers/grow.js", "/workers/weaken.js", "/workers/share.js"], w)

        let money = ns.getServerMoneyAvailable(target)
        let max = ns.getServerMaxMoney(target)

        let sec = ns.getServerSecurityLevel(target)
        let min = ns.getServerMinSecurityLevel(target)

        if (sec > min + 5) {

            ns.exec("/workers/weaken.js", w, Math.floor(ram / 1.75), target)

        }

        else if (money < max * 0.7) {

            ns.exec("/workers/grow.js", w, Math.floor(ram / 1.75), target)

        }

        else {

            // Switch: ON/OFF Faction Reputation Share dikontrol oleh Orchestrator
            let enableShare = false;
            if (ns.fileExists("/pro-v1/config.txt")) {
                try {
                    let config = JSON.parse(ns.read("/pro-v1/config.txt"));
                    enableShare = config.enableShare || false;
                } catch (e) { }
            }

            // Berikan probabilitas 10-20% agar RAM dialokasikan untuk mem-boost Reputation (Share)
            // ns.share() membutuhkan RAM 4GB per thread.
            if (enableShare && Math.random() < 0.2 && ram >= 4) {
                ns.exec("/workers/share.js", w, Math.floor(ram / 4));
            } else {
                ns.exec("/workers/hack.js", w, Math.floor(ram / 1.7), target);
            }

        }

    }

}