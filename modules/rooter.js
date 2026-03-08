export function rootServer(ns,server){

    if(ns.hasRootAccess(server)) return

    try{ns.brutessh(server)}catch{}
    try{ns.ftpcrack(server)}catch{}
    try{ns.relaysmtp(server)}catch{}
    try{ns.httpworm(server)}catch{}
    try{ns.sqlinject(server)}catch{}

    try{ns.nuke(server)}catch{}

}