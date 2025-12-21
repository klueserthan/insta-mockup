from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import shutil
import os
from uuid import uuid4
from config import UPLOAD_DIR
from auth import get_current_user
from validators import FileValidator
from pydantic import BaseModel

router = APIRouter()
validator = FileValidator()

class UploadResponse(BaseModel):
    filename: str
    original_filename: str

@router.post("/api/objects/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
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
        raise HTTPException(
            status_code=400, 
            detail=", ".join(validation["errors"])
        )
        
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
        original_filename=file.filename
    )
