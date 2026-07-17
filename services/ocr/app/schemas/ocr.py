from pydantic import BaseModel, Field
from typing import Optional

class OCROptions(BaseModel):
    deskew: bool = True
    highContrast: bool = False

class OCRProcessRequest(BaseModel):
    filename: str
    options: Optional[OCROptions] = Field(default_factory=OCROptions)
