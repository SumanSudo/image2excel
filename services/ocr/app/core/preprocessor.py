import cv2
import numpy as np
import os
import math
from typing import Tuple

def deskew_image(image: np.ndarray) -> Tuple[np.ndarray, float]:
    """
    Detects skew angle in the image using Hough Lines and rotates it back to horizontal.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # Use Canny to find edges
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # Detect lines using Probabilistic Hough Transform
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)
    
    angles = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = math.atan2(y2 - y1, x2 - x1) * 180 / math.pi
            # Only consider near-horizontal lines (between -45 and 45 degrees)
            if -45 < angle < 45:
                angles.append(angle)
                
    # Calculate median angle
    skew_angle = np.median(angles) if len(angles) > 0 else 0.0
    
    if abs(skew_angle) > 0.5:  # Only rotate if skew is notable
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        # Get rotation matrix (counter-clockwise by skew_angle)
        M = cv2.getRotationMatrix2D(center, skew_angle, 1.0)
        
        # Calculate new bounding dimensions to avoid cropping the image
        cos = np.abs(M[0, 0])
        sin = np.abs(M[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))
        
        # Adjust the translation component of the matrix
        M[0, 2] += (new_w / 2) - center[0]
        M[1, 2] += (new_h / 2) - center[1]
        
        # Perform rotation
        rotated = cv2.warpAffine(image, M, (new_w, new_h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated, skew_angle
        
    return image, 0.0

def apply_adaptive_threshold(image: np.ndarray) -> np.ndarray:
    """
    Applies adaptive Gaussian thresholding to maximize text contrast.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    # Apply Gaussian adaptive thresholding
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    return binary

def preprocess(image_path: str, output_path: str, deskew: bool = True, high_contrast: bool = False) -> Tuple[str, float]:
    """
    Reads an image, applies selected preprocessing steps, and writes the result.
    Returns the output path and calculated skew angle.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input image not found: {image_path}")
        
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image using OpenCV: {image_path}")
        
    skew_angle = 0.0
    processed = image.copy()
    
    # 1. Deskewing
    if deskew:
        processed, skew_angle = deskew_image(processed)
        
    # 2. Adaptive Binarization / High Contrast
    if high_contrast:
        processed = apply_adaptive_threshold(processed)
    else:
        # Standard conversion to grayscale if high_contrast is false but we need grayscale
        # Wait, PaddleOCR works well with color or gray, but let's keep it in grayscale if it's already gray
        pass
        
    # Write processed image
    cv2.imwrite(output_path, processed)
    return output_path, skew_angle
