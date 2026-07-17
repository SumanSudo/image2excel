import os
# Disable oneDNN and mkldnn optimizations which can cause unsupported PIR array attribute crashes on Windows CPU execution paths
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
# Disable check of model source to speed up startup and bypass connection delays
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
# Disable oneDNN by default in Paddlex pipeline
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

import logging
from typing import List, Dict, Any
from paddleocr import PaddleOCR

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr_engine")

class OCREngine:
    def __init__(self):
        self.ocr = None

    def initialize(self):
        """Lazy initialization of PaddleOCR to speed up service start."""
        if self.ocr is None:
            logger.info("Initializing PaddleOCR engine...")
            # We set show_log=False to prevent flooding the logs, use_angle_cls=True for rotated text
            # PaddleOCR will auto-download models to ~/.paddleocr/ if not present
            self.ocr = PaddleOCR(use_angle_cls=True, lang='en')
            logger.info("PaddleOCR engine initialized successfully.")

    def process_image(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Runs PaddleOCR on the image and returns bounding box coordinates, text, and confidence.
        """
        self.initialize()
        
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at: {image_path}")
            
        logger.info(f"Running OCR extraction on: {image_path}")
        
        # PaddleOCR returns a list of results (one per page). We are processing single images.
        result = self.ocr.ocr(image_path)
        
        if not result or result == [None]:
            logger.warning(f"No text detected in image: {image_path}")
            return []
            
        formatted_results = []
        
        # Parse the output. format: result[page][line] where line is [box, (text, confidence)]
        for page in result:
            if page is None:
                continue
            
            # PaddleOCR 3.x dict-like OCRResult output format
            if hasattr(page, 'keys') and 'dt_polys' in page and 'rec_texts' in page:
                dt_polys = page['dt_polys']
                rec_texts = page['rec_texts']
                rec_scores = page.get('rec_scores', [1.0] * len(rec_texts))
                
                for box, text, confidence in zip(dt_polys, rec_texts, rec_scores):
                    formatted_results.append({
                        "box": box,
                        "text": str(text),
                        "confidence": float(confidence) if confidence is not None else 1.0
                    })
            else:
                # PaddleOCR 2.x list-like format: line is [box, (text, confidence)]
                for line in page:
                    if not isinstance(line, (list, tuple)) or len(line) < 2:
                        continue
                    box = line[0]
                    val = line[1]
                    if isinstance(val, (tuple, list)):
                        if len(val) >= 2:
                            text = val[0]
                            confidence = val[1]
                        elif len(val) == 1:
                            text = val[0]
                            confidence = 1.0
                        else:
                            text = ""
                            confidence = 1.0
                    elif isinstance(val, str):
                        text = val
                        confidence = 1.0
                    else:
                        text = str(val)
                        confidence = 1.0

                    formatted_results.append({
                        "box": box,
                        "text": str(text),
                        "confidence": float(confidence) if confidence is not None else 1.0
                    })
                
        logger.info(f"Extracted {len(formatted_results)} text elements.")
        return formatted_results

ocr_engine = OCREngine()
