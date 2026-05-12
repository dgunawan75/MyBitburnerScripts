def can_jump(nums):
    farthest = 0
    for i in range(len(nums)):
        # Jika indeks saat ini lebih besar dari jangkauan maksimal yang bisa dicapai, artinya kita tersangkut
        if i > farthest:
            return 0
            
        farthest = max(farthest, i + nums[i])
        
        # Jika jangkauan sudah bisa menyentuh akhir array, langsung berhasil
        if farthest >= len(nums) - 1:
            return 1
            
    return 1

if __name__ == "__main__":
    nums = [9,9,1,3,1,1,0,5,0,0,7,9,0,0,6,5]
    result = can_jump(nums)
    print(f"Bisa mencapai akhir?: {result}")
