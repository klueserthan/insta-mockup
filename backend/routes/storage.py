from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict
import shutil
import os
from uuid import uuid4
from config import UPLOAD_DIR, BASE_URL
from auth import get_current_user
from validators import FileValidator

router = APIRouter()
validator = FileValidator()

@router.post("/api/objects/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Handle single file upload with validation.
    Returns the public URL of the uploaded file.
    """
    
    # 1. Validate File
    validation = await validator.validate_file(file)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400, 
            detail=", ".join(validation["errors"])
        )
        
    # 2. Generate Unique Filename
    # Use original extension if present, else .tmp (though validator checks extension)
    _, ext = os.path.splitext(file.filename)
    unique_filename = f"{uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # 3. Save File
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # 4. Return Public URL
    # We return 'uploadURL' to match what the frontend expects for consistency, 
    # or arguably 'url'. Let's check what we promised in plan.
    # Plan said: { "url": "..." }. But frontend might expect uploadURL from S3 legacy.
    # Let's verify frontend expectation in next steps. For now, returning clear structure.
    
    public_url = f"{BASE_URL}/media/{unique_filename}"
    
    return {
        "url": public_url,
        "filename": unique_filename,
        "original_filename": file.filename
    }
