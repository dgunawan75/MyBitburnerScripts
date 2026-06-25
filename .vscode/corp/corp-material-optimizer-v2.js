/** @param {NS} ns **/
export async function main(ns) {

    const division = ns.args[0];

    if (!division) {
        ns.tprint("");
        ns.tprint("Usage:");
        ns.tprint("run corp-material-optimizer-v2.js Agro");
        ns.tprint("run corp-material-optimizer-v2.js Smokeware");
        return;
    }

    const corp = ns.corporation;

    const SAFE_USAGE = 0.80;
    const WARNING_USAGE = 0.90;
    const CRITICAL_USAGE = 0.95;

    const MATERIAL_SIZE = {
        "Hardware": 0.06,
        "Robots": 0.50,
        "AI Cores": 0.10,
        "Real Estate": 0.005,

        "Water": 0.05,
        "Energy": 0.01,
        "Food": 0.03,
        "Plants": 0.05,
        "Ore": 0.04,
        "Metal": 0.10,
        "Minerals": 0.05,
        "Chemicals": 0.05,
        "Drugs": 0.02,
        "Computers": 0.10,
    };

    const MATERIALS = [
        "Hardware",
        "Robots",
        "AI Cores",
        "Real Estate",

        "Water",
        "Energy",
        "Food",
        "Plants",
        "Ore",
        "Metal",
        "Minerals",
        "Chemicals",
        "Drugs",
        "Computers",
    ];

    function warehouseStatus(usage) {

        if (usage >= CRITICAL_USAGE)
            return "CRITICAL";

        if (usage >= WARNING_USAGE)
            return "WARNING";

        return "OK";
    }

    function fmt(n) {

        if (!isFinite(n))
            return "∞";

        return n.toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );
    }

    const div = corp.getDivision(division);

    ns.tprint("");
    ns.tprint("==================================================");
    ns.tprint(`DIVISION : ${division}`);
    ns.tprint("==================================================");

    for (const city of div.cities) {

        const wh =
            corp.getWarehouse(
                division,
                city
            );

        const usage =
            wh.sizeUsed / wh.size;

        const freeWH =
            wh.size - wh.sizeUsed;

        const materials = [];

        for (const matName of MATERIALS) {

            try {

                const mat =
                    corp.getMaterial(
                        division,
                        city,
                        matName
                    );

                const size =
                    MATERIAL_SIZE[matName] ?? 0;

                const warehouse =
                    mat.stored * size;

                const netFlow =
                    mat.productionAmount +
                    mat.importAmount -
                    mat.actualSellAmount;

                materials.push({
                    name: matName,
                    stored: mat.stored,
                    warehouse,
                    netFlow,
                    production: mat.productionAmount,
                    sell: mat.actualSellAmount
                });

            } catch {

                // ignore

            }
        }

        const topConsumers =
            [...materials]
                .filter(m => m.warehouse > 0)
                .sort(
                    (a, b) =>
                        b.warehouse - a.warehouse
                )
                .slice(0, 5);

        const backlog =
            materials
                .filter(
                    m => m.netFlow > 0.01
                )
                .sort(
                    (a, b) =>
                        b.warehouse - a.warehouse
                );

        const growthWH =
            backlog.reduce(
                (sum, m) =>
                    sum +
                    (
                        m.netFlow *
                        (
                            MATERIAL_SIZE[m.name] ??
                            0
                        )
                    ),
                0
            );

        let cyclesToFull =
            Infinity;

        if (
            growthWH > 0 &&
            freeWH > 0
        ) {

            cyclesToFull =
                freeWH /
                growthWH;

        }

        const targetUsed =
            wh.size *
            SAFE_USAGE;

        const spaceToFree =
            Math.max(
                0,
                wh.sizeUsed -
                targetUsed
            );

        ns.tprint("");
        ns.tprint("==================================================");
        ns.tprint(`${city}`);
        ns.tprint("==================================================");

        ns.tprint("");
        ns.tprint("Warehouse");
        ns.tprint("--------------------------------");

        ns.tprint(
            `Used     : ${fmt(wh.sizeUsed)} / ${fmt(wh.size)}`
        );

        ns.tprint(
            `Free     : ${fmt(freeWH)}`
        );

        ns.tprint(
            `Usage    : ${(usage * 100).toFixed(2)}%`
        );

        ns.tprint(
            `Status   : ${warehouseStatus(usage)}`
        );

        ns.tprint("");
        ns.tprint("Top Consumers");
        ns.tprint("--------------------------------");

        if (
            topConsumers.length === 0
        ) {

            ns.tprint("No material data");

        } else {

            for (
                const m of topConsumers
            ) {

                ns.tprint(
                    `${m.name.padEnd(15)} ${fmt(m.warehouse)} WH`
                );

            }

        }

        ns.tprint("");
        ns.tprint("Backlog");
        ns.tprint("--------------------------------");

        if (
            backlog.length === 0
        ) {

            ns.tprint(
                "No accumulating materials"
            );

        } else {

            for (
                const m of backlog
            ) {

                ns.tprint(
                    `${m.name}`
                );

                ns.tprint(
                    `  Stored    : ${fmt(m.stored)}`
                );

                ns.tprint(
                    `  Net Flow  : +${fmt(m.netFlow)}/cycle`
                );

                ns.tprint(
                    `  Warehouse : ${fmt(m.warehouse)}`
                );

            }

        }

        ns.tprint("");
        ns.tprint("Warehouse Growth");
        ns.tprint("--------------------------------");

        ns.tprint(
            `Growth/Cycle : ${fmt(growthWH)} WH`
        );

        if (
            cyclesToFull === Infinity
        ) {

            if (freeWH <= 0) {

                ns.tprint(
                    "Time To Full : ALREADY FULL"
                );

            } else {

                ns.tprint(
                    "Time To Full : STABLE"
                );

            }

        } else {

            ns.tprint(
                `Time To Full : ${fmt(cyclesToFull)} cycles`
            );

        }

        ns.tprint("");
        ns.tprint("Recommendation");
        ns.tprint("--------------------------------");

        const salesLimited =
            backlog.some(
                m =>
                    (
                        m.sell > 0
                    ) &&
                    (
                        m.production >
                        m.sell
                    )
            );

        if (
            usage >= CRITICAL_USAGE
        ) {

            ns.tprint(
                "DO NOT BUY BOOSTERS"
            );

            ns.tprint(
                "Reason:"
            );

            ns.tprint(
                "- Warehouse Critical"
            );

            if (
                salesLimited
            ) {

                ns.tprint(
                    "- Sales Limited"
                );

            }

        } else if (
            usage >= WARNING_USAGE
        ) {

            ns.tprint(
                "Avoid Additional Boosters"
            );

            ns.tprint(
                "Monitor Warehouse Closely"
            );

        } else {

            ns.tprint(
                "Warehouse Healthy"
            );

            ns.tprint(
                "Ready For Booster Analysis (V3)"
            );

        }

        if (
            spaceToFree > 0
        ) {

            ns.tprint("");

            ns.tprint(
                `Need To Free : ${fmt(spaceToFree)} WH`
            );

            const food =
                materials.find(
                    m =>
                        m.name === "Food"
                );

            if (
                food &&
                food.stored > 0
            ) {

                const foodRemove =
                    Math.ceil(
                        spaceToFree /
                        0.03
                    );

                ns.tprint(
                    `Sell/Export ~${fmt(foodRemove)} Food`
                );

            }

            const plants =
                materials.find(
                    m =>
                        m.name === "Plants"
                );

            if (
                plants &&
                plants.stored > 0
            ) {

                const plantRemove =
                    Math.ceil(
                        spaceToFree /
                        0.05
                    );

                ns.tprint(
                    `Sell/Export ~${fmt(plantRemove)} Plants`
                );

            }

        }
    }

    ns.tprint("");
    ns.tprint("==================================================");
    ns.tprint("Analysis Complete");
    ns.tprint("==================================================");
}