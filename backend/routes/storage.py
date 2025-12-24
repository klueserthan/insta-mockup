import os
import shutil
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from auth import get_current_researcher
from config import BASE_URL, UPLOAD_DIR
from validators import FileValidator

router = APIRouter()
validator = FileValidator()


class UploadResponse(BaseModel):
    filename: str
    original_filename: str
    url: str


@router.post("/api/objects/upload")
async def upload_file(
    file: UploadFile = File(...), current_user=Depends(get_current_researcher)
) -> UploadResponse:
    """
    Handle file upload. Returns:
      filename: The basename of the file (uuid.ext)
      original_filename: Original upload name
    """

    # Auth
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 1. Validate File
    validation = await validator.validate_file(file)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=", ".join(validation["errors"]))

    # 2. Generate Unique Filename
    _, ext = os.path.splitext(file.filename)
    unique_filename = f"{uuid4()}{ext}"

    # 3. Determine Storage Path
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # 4. Save File
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return UploadResponse(
        filename=unique_filename,
        original_filename=file.filename,
        url=f"{BASE_URL}/media/{unique_filename}",
    )
