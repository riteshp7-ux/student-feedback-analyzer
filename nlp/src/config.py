import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    service_name: str = "Student Feedback NLP Microservice"
    version: str = "1.0.0"
    model_version: str = "v1.0.0"
    dataset_version: str = "v1.0.0"
    host: str = os.getenv("NLP_HOST", "127.0.0.1")
    port: int = int(os.getenv("NLP_PORT", "8000"))
    max_text_length: int = int(os.getenv("NLP_MAX_TEXT_LENGTH", "5000"))
    min_text_length: int = int(os.getenv("NLP_MIN_TEXT_LENGTH", "1"))
    artifact_dir: str = os.getenv(
        "NLP_ARTIFACT_DIR",
        str(BASE_DIR / "artifacts" / "v1.0.0")
    )
    # Optional shared secret: when set, /analyze requests must carry a matching
    # X-NLP-Token header (the API sends it). Empty string disables the check.
    auth_token: str = os.getenv("NLP_SERVICE_TOKEN", "")

settings = Settings()
