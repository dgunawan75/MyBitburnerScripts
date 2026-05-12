def solve_largest_rectangle(matrix):
    if not matrix or not matrix[0]:
        return []
        
    rows = len(matrix)
    cols = len(matrix[0])
    
    max_area = 0
    best_corners = []
    
    # Pre-compute prefix sums of 1s untuk pengecekan O(1)
    # prefix[r][c] = jumlah 1s dari (0,0) sampai (r-1, c-1)
    prefix = [[0] * (cols + 1) for _ in range(rows + 1)]
    for r in range(rows):
        for c in range(cols):
            prefix[r+1][c+1] = matrix[r][c] + prefix[r][c+1] + prefix[r+1][c] - prefix[r][c]
            
    def count_ones(r1, c1, r2, c2):
        return prefix[r2+1][c2+1] - prefix[r1][c2+1] - prefix[r2+1][c1] + prefix[r1][c1]

    for r1 in range(rows):
        for c1 in range(cols):
            for r2 in range(r1, rows):
                for c2 in range(c1, cols):
                    area = (r2 - r1 + 1) * (c2 - c1 + 1)
                    if area > max_area:
                        # Cek apakah ada angka 1 di dalam submatrix ini
                        if count_ones(r1, c1, r2, c2) == 0:
                            max_area = area
                            best_corners = [[r1, c1], [r2, c2]]
                            
    return best_corners

if __name__ == "__main__":
    matrix = [
  [1,0,0,0,0,0,0], 
  [0,1,0,0,0,0,0], 
  [0,0,0,0,0,0,0], 
  [0,0,0,0,0,0,0], 
  [1,0,1,0,0,0,0], 
  [0,0,0,1,0,1,0], 
  [0,0,0,0,0,0,0] 
    ]
    result = solve_largest_rectangle(matrix)
    print(str(result).replace(" ", ""))
