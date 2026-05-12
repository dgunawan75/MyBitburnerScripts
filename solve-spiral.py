def spiral_order(matrix):
    res = []
    while matrix:
        # Ambil baris paling atas (kiri ke kanan)
        res += matrix.pop(0)
        
        # Ambil kolom paling kanan (atas ke bawah)
        if matrix and matrix[0]:
            for row in matrix:
                res.append(row.pop())
                
        # Ambil baris paling bawah (kanan ke kiri)
        if matrix:
            res += matrix.pop()[::-1]
            
        # Ambil kolom paling kiri (bawah ke atas)
        if matrix and matrix[0]:
            for row in matrix[::-1]:
                res.append(row.pop(0))
                
    return res

if __name__ == "__main__":
    matrix = [ 
        [24,37,46,44,26,43,35, 9,23,29, 9,35],
        [21, 8, 1,15,18,18,11,20,22, 2,12,32],
        [47,29,34,49, 2,39, 6,29,24,39,38,11] 
    ]
    
    result = spiral_order(matrix)
    print(f"[{', '.join(map(str, result))}]")
