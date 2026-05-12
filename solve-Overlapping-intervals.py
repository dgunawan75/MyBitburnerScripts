def merge_intervals(intervals):
    if not intervals:
        return []
    
    # Sort intervals based on the start value
    intervals.sort(key=lambda x: x[0])
    
    merged = [intervals[0]]
    for current in intervals[1:]:
        last_merged = merged[-1]
        
        # Jika interval saat ini tumpang tindih dengan interval terakhir di merged
        if current[0] <= last_merged[1]:
            last_merged[1] = max(last_merged[1], current[1])
        else:
            merged.append(current)
            
    return merged

if __name__ == "__main__":
    intervals = [[1,4],[20,25],[7,17],[13,23],[3,6],[18,28],[12,13],[13,20],[25,29]]
    result = merge_intervals(intervals)
    # Output array 2D secara literal seperti format inputnya
    print(str(result).replace(" ", ""))
