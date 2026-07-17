import os

class Settings:
    # Use environment variable or fallback to local path (for direct running)
    SHARED_STORAGE_DIR: str = os.getenv(
        "SHARED_STORAGE_DIR", 
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../shared/storage/tmp"))
    )
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

settings = Settings()
