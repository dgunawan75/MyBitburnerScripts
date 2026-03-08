/** u/param {NS} ns */
export async function main(ns) {
  const tovisit = new Set(["home"]);
  const visited = new Set();


  let best = { target: "n00dles", rate: 0, moneyCap: 0 };


  while (tovisit.size > 0) {
    const host = tovisit.values().next().value;


    for (const n of ns.scan(host)) {
      if (!visited.has(n)) tovisit.add(n);
    }


    if (ns.hasRootAccess(host) && host !== "home") {
      const res = bestCycleForServer(ns, host);


      if (res && res.rate > best.rate) best = res;


      if (res) {
        ns.tprint(
          `target=${host} ` +
          `moneyCap=${res.moneyCap.toFixed(0)} ` +
          `rate=$/sec=${res.rate.toFixed(2)}`
        );
      }
    }


    visited.add(host);
    tovisit.delete(host);
  }


  ns.tprint(
    `BEST target=${best.target} ` +
    `moneyCap=${best.moneyCap.toFixed(0)} ` +
    `rate=$/sec=${best.rate.toFixed(2)}`
  );
}



function bestCycleForServer(ns, t) {
  const maxMoney = ns.getServerMaxMoney(t);
  if (maxMoney <= 0) return null;


  const chance = ns.hackAnalyzeChance(t);
  const s = ns.hackAnalyze(t);
  if (chance <= 0 || s <= 0) return null;


  const hackTime = ns.getHackTime(t);
  const growTime = ns.getGrowTime(t);
  const weakenTime = ns.getWeakenTime(t);


  const hackSec = ns.hackAnalyzeSecurity(1);
  const weakenPerThread = ns.weakenAnalyze(1);


  let best = { rate: 0, moneyCap: 0 };


  for (let rHigh = 0.20; rHigh <= 1.00; rHigh += 0.02) {
    const capMoney = rHigh * maxMoney;
    const afterHackMoney = capMoney * (1 - s);


    const gMult = capMoney / Math.max(1, afterHackMoney);
    const g = Math.ceil(ns.growthAnalyze(t, gMult));
    if (!isFinite(g)) continue;


    const secUp = hackSec + ns.growthAnalyzeSecurity(g);
    const w = Math.ceil(secUp / weakenPerThread);


    const gain = capMoney * s * chance;


    const timeMs =
      hackTime +
      g * growTime +
      w * weakenTime;


    if (timeMs <= 0) continue;


    const rate = gain / (timeMs / 1000);


    if (rate > best.rate) {
      best = {
        target: t,
        rate,
        moneyCap: capMoney
      };
    }
  }


  return best;
}