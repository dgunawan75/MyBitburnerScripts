def minimum_total(triangle):
    if not triangle:
        return 0
        
    # Mulai dari baris paling bawah
    dp = triangle[-1][:]
    
    # Bergerak naik dari baris kedua dari bawah hingga ke puncak
    for i in range(len(triangle) - 2, -1, -1):
        for j in range(len(triangle[i])):
            # Untuk setiap posisi, tambahkan nilai minimum dari dua pilihan jalan di bawahnya
            dp[j] = triangle[i][j] + min(dp[j], dp[j + 1])
            
    return dp[0]

if __name__ == "__main__":
    triangle = [ 
           [6], 
          [6,3], 
         [2,1,3], 
        [8,2,8,4], 
       [8,7,5,4,9], 
      [4,8,2,5,6,1], 
     [8,9,8,5,3,9,5], 
    [5,3,4,8,3,8,6,3], 
   [9,1,5,6,2,6,7,5,9], 
  [8,5,7,3,9,8,5,7,2,1] 
    ]
    result = minimum_total(triangle)
    print(f"Minimum Path Sum: {result}")
