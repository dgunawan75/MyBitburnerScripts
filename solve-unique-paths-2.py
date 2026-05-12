def unique_paths_with_obstacles(obstacleGrid):
    if not obstacleGrid or obstacleGrid[0][0] == 1:
        return 0
        
    m, n = len(obstacleGrid), len(obstacleGrid[0])
    
    # Buat matrix DP yang diisi dengan 0
    dp = [[0]*n for _ in range(m)]
    
    # Titik awal
    dp[0][0] = 1
    
    for i in range(m):
        for j in range(n):
            if obstacleGrid[i][j] == 1:
                dp[i][j] = 0 # Jalan buntu
            else:
                if i > 0:
                    dp[i][j] += dp[i-1][j] # Datang dari atas
                if j > 0:
                    dp[i][j] += dp[i][j-1] # Datang dari kiri
                    
    return dp[-1][-1]

if __name__ == "__main__":
    grid = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]
    result = unique_paths_with_obstacles(grid)
    print(f"Total Unique Paths: {result}")
