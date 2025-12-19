from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlmodel import Session
from uuid import uuid4
import os
import shutil

from auth import get_current_user

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/api/objects/upload")
def get_upload_url(request: Request, current_user = Depends(get_current_user)):
    filename = f"{uuid4()}.tmp"
    # Ensure uploads/ endpoint is accessible.
    # We will use a dedicated endpoint for uploading content locally.
    url = str(request.url_for('upload_content', filename=filename))
    return {"uploadURL": url}

@router.put("/api/uploads/{filename}", name="upload_content")
async def upload_content(filename: str, request: Request):
    # This endpoint receives the file content directly
    content = await request.body()
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    return {"status": "ok"}

@router.put("/api/objects/finalize")
def finalize_upload(
    body: dict,
    current_user = Depends(get_current_user)
):
    upload_url = body.get("uploadURL")
    if not upload_url:
        raise HTTPException(status_code=400, detail="uploadURL is required")
    
    # Extract filename from URL
    # Assuming local URL: .../api/uploads/{filename}
    try:
        filename = upload_url.split("/")[-1]
    except:
         raise HTTPException(status_code=400, detail="Invalid URL")
         
    tmp_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Rename to permanent (remove .tmp?) or just keep.
    # Return objectPath relative to /objects/
    # Let's say we keep filename as objectPath
    
    return {"objectPath": filename}

@router.get("/objects/{object_path:path}")
def get_object(object_path: str):
    filepath = os.path.join(UPLOAD_DIR, object_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(filepath)
