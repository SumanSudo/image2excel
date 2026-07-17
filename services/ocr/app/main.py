import os
import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.preprocessor import preprocess
from app.core.ocr_engine import ocr_engine
from app.utils.spatial_cluster import build_grid_matrix
from app.schemas.ocr import OCRProcessRequest

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr_service")

app = FastAPI(
    title="Image2Excel OCR Service",
    description="Python FastAPI service for OpenCV preprocessing and PaddleOCR table parsing",
    version="1.0.0"
)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ocr-engine"}

@app.post("/api/v1/ocr/process")
@app.post("/api/v1/ocr")  # Support both paths for compatibility
def process_ocr(payload: OCRProcessRequest):
    """
    Triggers OpenCV preprocessing, PaddleOCR layout analysis,
    and spatial clustering to output a 2D text matrix.
    """
    filename = payload.filename
    options = payload.options
    
    deskew = options.deskew if options else True
    high_contrast = options.highContrast if options else False
    
    # Construct paths
    input_path = os.path.join(settings.SHARED_STORAGE_DIR, filename)
    processed_filename = f"proc_{filename}"
    processed_path = os.path.join(settings.SHARED_STORAGE_DIR, processed_filename)
    
    logger.info(f"Received process request for {filename}. deskew={deskew}, high_contrast={high_contrast}")
    
    if not os.path.exists(input_path):
        logger.error(f"File not found: {input_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {filename} not found in shared storage."
        )
        
    try:
        # 1. Run OpenCV Preprocessing
        logger.info(f"Preprocessing {filename} -> {processed_filename}")
        preprocess(
            image_path=input_path,
            output_path=processed_path,
            deskew=deskew,
            high_contrast=high_contrast
        )
        
        # 2. Run PaddleOCR Text Detection
        raw_ocr_results = ocr_engine.process_image(processed_path)
        
        # 3. Apply Spatial Clustering
        grid_matrix = build_grid_matrix(raw_ocr_results)
        
        # Cleanup processed image to save disk space
        if os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except Exception as e:
                logger.warning(f"Failed to remove temp file {processed_path}: {e}")
                
        return {
            "success": True,
            "matrix": grid_matrix
        }
        
    except Exception as e:
        logger.exception("Error processing OCR request")
        # Cleanup on failure
        if os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )

# Initialize blank file __init__.py inside ocr/app
with open(os.path.join(os.path.dirname(__file__), "__init__.py"), "w") as f:
    pass
