function scan(ns){

    let list=["home"]

    for (let i=0;i<list.length;i++){

        let server=list[i]

        let neighbors=ns.scan(server)

        for (let n of neighbors)

            if (!list.includes(n))
                list.push(n)

    }

    return list

}