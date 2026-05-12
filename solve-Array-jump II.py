def min_jumps(nums):
    if len(nums) <= 1:
        return 0
        
    jumps = 0
    current_end = 0
    farthest = 0
    
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        
        # Jika kita sudah mencapai batas akhir dari lompatan saat ini
        if i == current_end:
            jumps += 1
            current_end = farthest
            
            # Jika kita sudah bisa mencapai atau melewati index terakhir
            if current_end >= len(nums) - 1:
                break
                
    # Jika current_end masih tidak bisa mencapai akhir, artinya mustahil (return 0)
    return jumps if current_end >= len(nums) - 1 else 0

if __name__ == "__main__":
    nums = [3,5,3,1,3,2,5,1,3,4,5]
    result = min_jumps(nums)
    print(f"Minimum jumps required: {result}")
