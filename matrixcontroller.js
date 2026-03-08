/** u/param {NS} ns */
export async function main(ns) {
  const target = "iron-gym";
  const targetMoney = 490000000;
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const weakenDecrease = ns.weakenAnalyze(1, 1);
  let currentSecurity = ns.getServerSecurityLevel(target);
  let currentMoney = ns.getServerMoneyAvailable(target);

  while (true) {
    const liveMoney = ns.getServerMoneyAvailable(target);
    const liveSec = ns.getServerSecurityLevel(target);
    const growMult1ForDrift = estimateGrowMult1Thread(ns, target);
    const growUnit = Math.max(1e-9, currentMoney * (growMult1ForDrift - 1));
    const frac = ns.hackAnalyze(target);
    const chance = ns.hackAnalyzeChance(target);
    const hackUnit = Math.max(1e-9, currentMoney * frac * chance);
    const weakenUnit = Math.max(1e-9, weakenDecrease);
    const growSecUnit = Math.max(1e-9, ns.growthAnalyzeSecurity(1, target));
    const hackSecUnit = Math.max(1e-9, ns.hackAnalyzeSecurity(1, target));
    const moneyJobUnit = Math.max(growUnit, hackUnit);
    const secJobUnit = Math.max(weakenUnit, growSecUnit, hackSecUnit);
    const moneyJobDrift = Math.abs(liveMoney - currentMoney) / moneyJobUnit;
    const secJobDrift = Math.abs(liveSec - currentSecurity) / secJobUnit;

    if (moneyJobDrift > 1000 || secJobDrift > 1000) {
      ns.tprint(`STOP: drift too large. moneyDrift=${moneyJobDrift.toFixed(2)} jobs, secDrift=${secJobDrift.toFixed(2)} jobs`);
      return;
    }

    if (ns.peek(1) === "NULL PORT DATA") {
      const securityDiff = currentSecurity - minSecurity;


      let type;
      if (securityDiff >= weakenDecrease) {
        type = "weaken";
        currentSecurity -= weakenDecrease;
      } else if (currentMoney < targetMoney) {
        type = "grow";
        const growMult1 = estimateGrowMult1Thread(ns, target);
        currentMoney = Math.min(currentMoney * growMult1, maxMoney);
        currentSecurity += ns.growthAnalyzeSecurity(1, target);
      } else {
        type = "hack";
        const expectedStolen = currentMoney * frac * chance;
        currentMoney = Math.max(0, currentMoney - expectedStolen);
        currentSecurity += ns.hackAnalyzeSecurity(1, target);
      }

      const json = JSON.stringify({ type, target });
      ns.writePort(1, json);
    }

    await ns.sleep(20);
  }
}


function estimateGrowMult1Thread(ns, target) {
  let lo = 1.0;
  let hi = 1.5;

  while (hi < 100 && ns.growthAnalyze(target, hi) <= 1) hi *= 2;

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const th = ns.growthAnalyze(target, mid);
    if (th <= 1) lo = mid;
    else hi = mid;
  }
  return lo;
}