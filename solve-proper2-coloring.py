def is_bipartite(num_vertices, edges):
    # Buat adjacency list
    adj = [[] for _ in range(num_vertices)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
        
    color = [-1] * num_vertices
    
    # Perlu handle disconnected graph, jadi loop semua vertex
    for start in range(num_vertices):
        if color[start] == -1:
            queue = [start]
            color[start] = 0
            
            while queue:
                u = queue.pop(0)
                for v in adj[u]:
                    if color[v] == -1:
                        color[v] = 1 - color[u]
                        queue.append(v)
                    elif color[v] == color[u]:
                        # Dua node yang saling terhubung punya warna sama -> Gagal
                        return []
                        
    return color

if __name__ == "__main__":
    data = [10,[[3,9],[5,8],[8,9],[3,7],[1,9],[0,7],[4,5],[5,9],[3,5],[2,8],[2,4],[1,5],[2,6],[5,6],[4,7],[4,9]]]
    num_vertices = data[0]
    edges = data[1]
    
    result = is_bipartite(num_vertices, edges)
    # Output sebagai array literal persis seperti input
    print(str(result).replace(" ", ""))
