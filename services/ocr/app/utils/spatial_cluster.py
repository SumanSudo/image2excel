from typing import List, Dict, Any, Tuple
import numpy as np

def build_grid_matrix(ocr_results: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """
    Groups raw PaddleOCR bounding boxes into a 2D grid matrix of rows and columns.
    
    ocr_results element format:
    {
        "box": [[x0, y0], [x1, y1], [x2, y2], [x3, y3]],
        "text": str,
        "confidence": float
    }
    """
    if not ocr_results:
        return []
        
    # 1. Parse boxes and compute metadata
    parsed_boxes = []
    for item in ocr_results:
        box = item["box"]
        text = item["text"].strip()
        confidence = item["confidence"]
        
        if not text:
            continue
            
        xs = [pt[0] for pt in box]
        ys = [pt[1] for pt in box]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        parsed_boxes.append({
            "box": box,
            "text": text,
            "confidence": confidence,
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
            "center_x": (min_x + max_x) / 2.0,
            "center_y": (min_y + max_y) / 2.0,
            "height": max_y - min_y,
            "width": max_x - min_x
        })
        
    if not parsed_boxes:
        return []
        
    # 2. Sort by Y-center for baseline estimation
    parsed_boxes.sort(key=lambda b: b["center_y"])
    
    # Calculate average box height and width
    avg_height = sum(b["height"] for b in parsed_boxes) / len(parsed_boxes)
    avg_width = sum(b["width"] for b in parsed_boxes) / len(parsed_boxes)
    
    # 3. Row Clustering
    # "A new row is instantiated when the vertical distance between adjacent blocks
    # exceeds a dynamic constraint, computed as: Threshold = 0.5 * Average Box Height."
    row_threshold = 0.5 * avg_height
    rows: List[List[Dict[str, Any]]] = []
    current_row: List[Dict[str, Any]] = []
    
    for box in parsed_boxes:
        if not current_row:
            current_row.append(box)
        else:
            prev_box = current_row[-1]
            if box["center_y"] - prev_box["center_y"] > row_threshold:
                # Close the row and start a new one
                rows.append(current_row)
                current_row = [box]
            else:
                current_row.append(box)
    if current_row:
        rows.append(current_row)
        
    # Sort boxes in each row horizontally
    for row in rows:
        row.sort(key=lambda b: b["center_x"])
        
    # 4. Column Mapping
    # Consolidate column tracks by merging overlapping horizontal spans
    # Column overlap tolerance (allow slight offsets)
    col_tolerance = 0.3 * avg_width
    
    all_spans = sorted([(b["min_x"], b["max_x"]) for b in parsed_boxes], key=lambda s: s[0])
    merged_columns: List[Tuple[float, float]] = []
    
    if all_spans:
        curr_start, curr_end = all_spans[0]
        for s, e in all_spans[1:]:
            # If the next span overlaps or is very close to the current one
            if s <= curr_end + col_tolerance:
                curr_end = max(curr_end, e)
            else:
                merged_columns.append((curr_start, curr_end))
                curr_start, curr_end = s, e
        merged_columns.append((curr_start, curr_end))
        
    # Sort columns from left to right
    merged_columns.sort(key=lambda c: c[0])
    
    # 5. Grid Assembly
    num_rows = len(rows)
    num_cols = len(merged_columns)
    
    # Initialize empty grid
    grid: List[List[Dict[str, Any]]] = []
    for r_idx in range(num_rows):
        row_cells = []
        for c_idx in range(num_cols):
            row_cells.append({
                "text": "",
                "confidence": 1.0,
                "isHeader": (r_idx == 0)
            })
        grid.append(row_cells)
        
    # Populate grid by mapping each box in each row to its best matching column
    for r_idx, row_boxes in enumerate(rows):
        for box in row_boxes:
            best_col_idx = 0
            max_overlap = -1.0
            closest_dist = float('inf')
            closest_col_idx = 0
            
            box_start, box_end = box["min_x"], box["max_x"]
            
            for c_idx, (col_start, col_end) in enumerate(merged_columns):
                # Calculate overlap
                overlap = max(0.0, min(box_end, col_end) - max(box_start, col_start))
                if overlap > max_overlap:
                    max_overlap = overlap
                    best_col_idx = c_idx
                    
                # Calculate distance to column center in case of no overlap
                col_center = (col_start + col_end) / 2.0
                dist = abs(box["center_x"] - col_center)
                if dist < closest_dist:
                    closest_dist = dist
                    closest_col_idx = c_idx
                    
            # Use overlap if positive, otherwise fall back to closest distance
            col_idx = best_col_idx if max_overlap > 0 else closest_col_idx
            
            # Map box content to the cell
            cell = grid[r_idx][col_idx]
            if not cell["text"]:
                cell["text"] = box["text"]
                cell["confidence"] = box["confidence"]
            else:
                # Concatenate contents in order (since row_boxes is sorted by center_x)
                cell["text"] = f"{cell['text']} {box['text']}".strip()
                cell["confidence"] = (cell["confidence"] + box["confidence"]) / 2.0
                
    return grid
