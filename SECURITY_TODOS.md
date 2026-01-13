# Security Hardening TODO List
**Generated:** January 13, 2026  
**Status:** Ready for implementation  
**Related:** See `SECURITY_ANALYSIS.md` for detailed vulnerability descriptions

This document provides actionable TODO items to address the security findings in the security analysis report. Items are organized by priority and include specific implementation guidance.

---

## 🔴 CRITICAL PRIORITY (Do First - Production Blockers)

### TODO-C1: Enforce Strong JWT Secret in Production
**Issue:** Default "supersecretkey" allows JWT forgery if `SESSION_SECRET` not set  
**CVSS:** 9.8 (Critical)

**Changes Required:**

1. **backend/config.py**
   ```python
   # Replace lines 36-42 with:
   SESSION_SECRET = os.environ.get("SESSION_SECRET")
   ENVIRONMENT = os.environ.get("ENV", os.environ.get("APP_ENV", "development")).lower()
   
   if ENVIRONMENT == "production" and not SESSION_SECRET:
       raise RuntimeError(
           "SESSION_SECRET environment variable must be set in production; "
           "refusing to use insecure default JWT secret."
       )
   
   if not SESSION_SECRET and ENVIRONMENT == "development":
       import warnings
       warnings.warn(
           "SESSION_SECRET not set. Using insecure default for development. "
           "This is NOT safe for production!",
           stacklevel=2
       )
   
   SECRET_KEY = SESSION_SECRET or "dev-only-supersecretkey-change-in-production"
   ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
   ALGORITHM = "HS256"
   ```

2. **backend/main.py**
   ```python
   # Remove duplicate SECRET_KEY definition at lines 40-41
   # Use the one from config.py via import
   ```

3. **Documentation**
   - Update `.env.example` with strong secret generation command:
     ```bash
     # Generate with: openssl rand -hex 32
     SESSION_SECRET=your_very_long_random_secret_here_at_least_32_characters
     ```
   - Add to README: "NEVER deploy to production without setting SESSION_SECRET"

**Testing:**
- Verify app crashes on startup if `ENV=production` and `SESSION_SECRET` not set
- Verify warning shows in dev if `SESSION_SECRET` not set
- Add test: `test_production_requires_session_secret()`

**Estimated Effort:** 1 hour

---

### TODO-C2: Implement Refresh Token System
**Issue:** No way to revoke sessions, tokens valid until expiration  
**CVSS:** 7.5 (High)

**Changes Required:**

1. **backend/models.py** - Add RefreshToken model
   ```python
   class RefreshToken(CamelModel, table=True):
       id: UUID = Field(default_factory=uuid4, primary_key=True)
       researcher_id: UUID = Field(foreign_key="researcher.id")
       token: str = Field(unique=True, index=True)
       expires_at: datetime
       created_at: datetime = Field(default_factory=datetime.utcnow)
       revoked_at: Optional[datetime] = None
       is_revoked: bool = Field(default=False)
   ```

2. **backend/auth.py** - Add refresh token functions
   ```python
   def create_refresh_token(researcher_id: UUID, session: Session) -> str:
       """Create a refresh token that lasts 7 days"""
       token = secrets.token_urlsafe(32)
       expires_at = datetime.now(timezone.utc) + timedelta(days=7)
       
       refresh_token = RefreshToken(
           researcher_id=researcher_id,
           token=token,
           expires_at=expires_at
       )
       session.add(refresh_token)
       session.commit()
       return token
   
   @router.post("/refresh", response_model=Token)
   def refresh_access_token(
       refresh_token: str,
       session: Session = Depends(get_session)
   ):
       """Exchange refresh token for new access token"""
       db_token = session.exec(
           select(RefreshToken).where(
               RefreshToken.token == refresh_token,
               RefreshToken.is_revoked == False,
               RefreshToken.expires_at > datetime.now(timezone.utc)
           )
       ).first()
       
       if not db_token:
           raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
       
       researcher = session.get(Researcher, db_token.researcher_id)
       if not researcher:
           raise HTTPException(status_code=401, detail="Researcher not found")
       
       # Create new access token
       access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
       access_token = create_access_token(
           data={"sub": researcher.email},
           expires_delta=access_token_expires
       )
       
       return Token(
           access_token=access_token,
           token_type="bearer",
           expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
       )
   
   @router.post("/revoke")
   def revoke_refresh_token(
       refresh_token: str,
       session: Session = Depends(get_session)
   ):
       """Revoke a refresh token (logout)"""
       db_token = session.exec(
           select(RefreshToken).where(RefreshToken.token == refresh_token)
       ).first()
       
       if db_token:
           db_token.is_revoked = True
           db_token.revoked_at = datetime.now(timezone.utc)
           session.add(db_token)
           session.commit()
       
       return {"message": "Token revoked"}
   ```

3. **Update login/register to return refresh tokens**
   ```python
   # In login() and register() functions:
   refresh_token = create_refresh_token(user.id, session)
   
   return Token(
       access_token=access_token,
       token_type="bearer",
       expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
       refresh_token=refresh_token  # Add this field
   )
   ```

4. **frontend/src/lib/queryClient.ts** - Store and use refresh token
   ```typescript
   const REFRESH_TOKEN_KEY = "refresh_token";
   
   export function getRefreshToken(): string | null {
     return localStorage.getItem(REFRESH_TOKEN_KEY);
   }
   
   export function setRefreshToken(token: string | null): void {
     if (token) {
       localStorage.setItem(REFRESH_TOKEN_KEY, token);
     } else {
       localStorage.removeItem(REFRESH_TOKEN_KEY);
     }
   }
   
   // Add automatic token refresh on 401 responses
   ```

**Testing:**
- Test refresh token creation on login
- Test access token refresh with valid refresh token
- Test refresh token expiration (7 days)
- Test revoked refresh token rejection
- Test automatic refresh on 401

**Estimated Effort:** 4-6 hours

---

## 🟠 HIGH PRIORITY (Must Fix Before Production)

### TODO-H1: Add Rate Limiting to Public Endpoints
**Issue:** DoS and abuse risk on `/api/feed/*`, `/api/interactions`, `/api/interactions/heartbeat`

**Changes Required:**

1. **Add dependency**
   ```bash
   uv add slowapi
   ```

2. **backend/main.py** - Add rate limiting middleware
   ```python
   from slowapi import Limiter, _rate_limit_exceeded_handler
   from slowapi.util import get_remote_address
   from slowapi.errors import RateLimitExceeded
   
   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
   ```

3. **backend/routes/feed.py**
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   
   limiter = Limiter(key_func=get_remote_address)
   
   @router.get("/api/feed/{public_url}")
   @limiter.limit("60/minute")  # 60 requests per minute per IP
   def get_public_feed(...):
   ```

4. **backend/routes/interactions.py**
   ```python
   @router.post("/api/interactions")
   @limiter.limit("120/minute")  # Higher limit for interaction logging
   def log_interaction(...):
   
   @router.post("/api/interactions/heartbeat")
   @limiter.limit("300/minute")  # Very high for heartbeats (5/second)
   def heartbeat(...):
   ```

**Configuration:**
- Make limits configurable via environment variables
- Add Redis backend for distributed rate limiting in production

**Testing:**
- Test rate limit enforcement
- Test rate limit headers in response
- Test different IPs have separate limits

**Estimated Effort:** 2-3 hours

---

### TODO-H2: Add Input Sanitization for User-Generated Content
**Issue:** XSS and injection risks in captions, comments, names

**Changes Required:**

1. **Add dependency**
   ```bash
   uv add bleach
   ```

2. **backend/validators.py** - Add sanitization functions
   ```python
   import bleach
   
   ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'a']
   ALLOWED_ATTRIBUTES = {'a': ['href', 'title']}
   ALLOWED_PROTOCOLS = ['http', 'https']
   
   def sanitize_html(text: str) -> str:
       """Sanitize HTML content to prevent XSS"""
       return bleach.clean(
           text,
           tags=ALLOWED_TAGS,
           attributes=ALLOWED_ATTRIBUTES,
           protocols=ALLOWED_PROTOCOLS,
           strip=True
       )
   
   def sanitize_text(text: str) -> str:
       """Sanitize plain text (remove all HTML)"""
       return bleach.clean(text, tags=[], strip=True)
   ```

3. **Apply sanitization in routes**
   ```python
   # In videos.py, comments.py, etc.
   from validators import sanitize_text
   
   # Before saving:
   video_base.caption = sanitize_text(video_base.caption)
   comment_base.body = sanitize_text(comment_base.body)
   ```

4. **Add Pydantic validators**
   ```python
   from pydantic import validator
   
   class VideoBase(CamelModel):
       caption: str
       
       @validator('caption')
       def sanitize_caption(cls, v):
           return sanitize_text(v)[:2000]  # Also enforce length
   ```

**Testing:**
- Test script tag injection blocked
- Test SQL injection patterns escaped
- Test allowed formatting preserved
- Test very long strings truncated

**Estimated Effort:** 3-4 hours

---

### TODO-H3: Fix Bulk Delete Authorization
**Issue:** Silent failures hide auth errors in bulk delete

**Changes Required:**

**backend/routes/videos.py:175-193**
```python
@router.post("/api/videos/bulk-delete", status_code=207)  # 207 Multi-Status
def bulk_delete_videos(
    video_ids: List[UUID] = Body(..., embed=True, alias="videoIds"),
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    results = {
        "deleted": [],
        "failed": []
    }
    
    for vid in video_ids:
        try:
            db_video = session.get(Video, vid)
            if not db_video:
                results["failed"].append({
                    "videoId": str(vid),
                    "error": "Video not found"
                })
                continue
            
            # Verify ownership - will raise HTTPException if unauthorized
            verify_video_ownership(session, vid, current_user.id)
            session.delete(db_video)
            results["deleted"].append(str(vid))
            
        except HTTPException as e:
            results["failed"].append({
                "videoId": str(vid),
                "error": e.detail
            })
    
    session.commit()
    return results
```

**Testing:**
- Test partial success returns 207 with details
- Test unauthorized video IDs appear in failed list
- Test nonexistent video IDs appear in failed list
- Test all successful returns all IDs in deleted list

**Estimated Effort:** 1 hour

---

### TODO-H4: Remove or Secure Instagram Proxy Endpoint
**Issue:** Open proxy, SSRF risk

**Option A: Remove (Recommended)**
```python
# Delete backend/routes/instagram.py lines 173-193
# Remove from main.py if no other routes use it
```

**Option B: Secure it**
```python
@router.get("/api/instagram/proxy")
async def proxy_download(
    url: str,
    current_user: Researcher = Depends(get_current_researcher)  # Add auth
):
    # Add URL validation
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs allowed")
    
    # Whitelist allowed domains
    allowed_domains = ["cdninstagram.com", "fbcdn.net"]
    from urllib.parse import urlparse
    domain = urlparse(url).netloc
    if not any(domain.endswith(d) for d in allowed_domains):
        raise HTTPException(status_code=400, detail="Domain not allowed")
    
    # ... rest of implementation
```

**Recommendation:** Remove if not used, or document why it's needed

**Estimated Effort:** 30 minutes

---

### TODO-H5: Implement CSRF Protection
**Issue:** CSRF vulnerability for state-changing operations

**Changes Required:**

1. **Add dependency**
   ```bash
   uv add fastapi-csrf-protect
   ```

2. **backend/main.py**
   ```python
   from fastapi_csrf_protect import CsrfProtect
   from fastapi_csrf_protect.exceptions import CsrfProtectError
   
   @CsrfProtect.load_config
   def get_csrf_config():
       return {
           "secret_key": SECRET_KEY,
           "cookie_secure": ENVIRONMENT == "production",
           "cookie_samesite": "lax"
       }
   
   @app.exception_handler(CsrfProtectError)
   def csrf_protect_exception_handler(request, exc):
       return JSONResponse(
           status_code=403,
           content={"detail": "CSRF token validation failed"}
       )
   ```

3. **Add CSRF token to state-changing endpoints**
   ```python
   from fastapi_csrf_protect import CsrfProtect
   
   @router.post("/api/projects")
   def create_project(
       project_base: ProjectBase,
       session: Session = Depends(get_session),
       current_user: Researcher = Depends(get_current_researcher),
       csrf_protect: CsrfProtect = Depends()
   ):
       csrf_protect.validate_csrf_in_cookies(request)
       # ... rest of implementation
   ```

4. **Frontend changes to send CSRF token**

**Note:** Since we use JWT in Authorization header (not cookies), CSRF risk is lower. Consider this lower priority if tokens remain in headers only.

**Estimated Effort:** 2-3 hours (or mark as "acceptable risk" with documentation)

---

### TODO-H6: Add Authentication to Instagram Ingest
**Issue:** Unauthorized RocketAPI usage, DoS risk

**Changes Required:**

**backend/routes/instagram.py:74-76**
```python
@router.post("/api/instagram/ingest", response_model=InstagramIngestResponse)
async def ingest_instagram(
    request: InstagramIngestRequest,
    current_user: Researcher = Depends(get_current_researcher),  # Add this
):
```

**Testing:**
- Test endpoint returns 401 without auth
- Test endpoint works with valid JWT
- Add to existing auth test suite

**Estimated Effort:** 15 minutes

---

### TODO-H7: Secure Comments GET Endpoint
**Issue:** Public access to all comments

**Changes Required:**

**Option A: Add authentication (Recommended)**
```python
@router.get("/api/videos/{video_id}/comments", response_model=List[PreseededComment])
def get_comments(
    video_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),  # Add this
):
```

**Option B: Document as intentional**
- Add comment explaining why it's public
- Add to API documentation
- Consider adding to feed response instead to avoid separate endpoint

**Recommendation:** If comments are shown in public feed, they should be part of the feed response, not a separate endpoint.

**Estimated Effort:** 30 minutes

---

### TODO-H8: Improve Token Storage Security
**Issue:** localStorage vulnerable to XSS

**Changes Required:**

**Option A: Move to HttpOnly Cookies (Recommended for maximum security)**

1. **backend/auth.py** - Return token as cookie
   ```python
   from fastapi import Response
   
   @router.post("/login")
   def login(
       login_data: LoginRequest,
       response: Response,
       session: Session = Depends(get_session)
   ):
       # ... validation ...
       
       access_token = create_access_token(...)
       
       # Set HttpOnly cookie
       response.set_cookie(
           key="access_token",
           value=f"Bearer {access_token}",
           httponly=True,
           secure=ENVIRONMENT == "production",
           samesite="lax",
           max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
       )
       
       return {"message": "Logged in"}
   ```

2. **Update auth dependency to read from cookie**
   ```python
   async def get_current_researcher(
       request: Request,
       session: Session = Depends(get_session),
   ) -> Researcher:
       token = request.cookies.get("access_token")
       if not token:
           raise HTTPException(status_code=401, ...)
       
       # Remove "Bearer " prefix if present
       token = token.replace("Bearer ", "")
       # ... rest of validation
   ```

3. **Frontend: Remove localStorage usage**
   - Cookies are automatically sent
   - Remove token management code
   - Simpler frontend!

**Option B: Keep localStorage but add XSS protections**
- Implement strict CSP (TODO-M9)
- Add input sanitization (TODO-H2)
- Document XSS as acceptable risk with mitigations

**Trade-offs:**
- HttpOnly cookies: Safer from XSS, but need CSRF protection
- localStorage: Easier to work with, but vulnerable to XSS

**Estimated Effort:** 3-4 hours for Option A, 0 hours for Option B (accept risk)

---

### TODO-H9: Make RocketAPI Key Optional in Development
**Issue:** Blocks dev without API key

**Changes Required:**

**backend/config.py:30-32**
```python
# RocketAPI Configuration
ROCKET_API_KEY = os.getenv("ROCKET_API_KEY")

# Only require in production or if Instagram features are used
if ENVIRONMENT == "production" and not ROCKET_API_KEY:
    raise ValueError(
        "ROCKET_API_KEY must be set in production environment. "
        "Instagram ingest features will not work without it."
    )

if not ROCKET_API_KEY and ENVIRONMENT == "development":
    import warnings
    warnings.warn(
        "ROCKET_API_KEY not set. Instagram ingest features will be disabled. "
        "This is OK for local development.",
        stacklevel=2
    )
```

**backend/routes/instagram.py:86-88**
```python
api_key = os.environ.get("ROCKET_API_KEY")
if not api_key:
    raise HTTPException(
        status_code=503,
        detail="Instagram ingest is not configured. ROCKET_API_KEY required."
    )
```

**Testing:**
- Test app starts without ROCKET_API_KEY in dev mode
- Test Instagram ingest returns 503 without key
- Test app requires key in production mode

**Estimated Effort:** 30 minutes

---

## 🟡 MEDIUM PRIORITY (Within Sprint)

### TODO-M1: Add Input Length Validation
**Issue:** No max length on text fields

**Changes Required:**

**backend/models.py** - Add Field constraints
```python
from pydantic import Field, constr

class VideoBase(CamelModel):
    caption: constr(max_length=2000)
    description: Optional[constr(max_length=5000)] = None
    song: constr(max_length=200)

class ProjectBase(CamelModel):
    name: constr(max_length=200)
    end_screen_message: constr(max_length=1000)
    redirect_url: constr(max_length=2000)

class PreseededCommentBase(CamelModel):
    body: constr(max_length=500)
    author_name: constr(max_length=100)

class SocialAccountBase(CamelModel):
    username: constr(max_length=50)
    display_name: constr(max_length=100)
```

**Testing:**
- Test rejection of overly long inputs
- Test max length accepted
- Test error messages are clear

**Estimated Effort:** 1 hour

---

### TODO-M2: Add File Content-Type Verification
**Issue:** Extension-based validation can be spoofed

**Changes Required:**

1. **Add dependency**
   ```bash
   uv add python-magic
   ```

2. **backend/validators.py**
   ```python
   import magic
   
   ALLOWED_MIME_TYPES = {
       'image/jpeg', 'image/png', 'image/gif',
       'video/mp4', 'video/quicktime', 'video/webm'
   }
   
   async def validate_file(self, file: UploadFile) -> dict:
       # ... existing checks ...
       
       # Check actual MIME type using magic numbers
       file_start = await file.read(2048)  # Read first 2KB
       await file.seek(0)  # Reset for later use
       
       mime = magic.from_buffer(file_start, mime=True)
       if mime not in ALLOWED_MIME_TYPES:
           result["valid"] = False
           result["errors"].append(
               f"File type '{mime}' not allowed. Detected from file content, not extension."
           )
       
       return result
   ```

**Testing:**
- Test .exe renamed to .mp4 is rejected
- Test valid media files accepted
- Test mime type in error messages

**Estimated Effort:** 1 hour

---

### TODO-M3: Add Email Validation
**Issue:** No validation on email format

**Changes Required:**

**backend/models.py**
```python
from pydantic import EmailStr

class ResearcherBase(CamelModel):
    email: EmailStr  # Change from str to EmailStr
    name: str
    lastname: str
```

**Testing:**
- Test invalid email formats rejected
- Test valid email formats accepted

**Estimated Effort:** 15 minutes

---

### TODO-M4: Add Username/Display Name Validation
**Issue:** No validation on names

**Changes Required:**

**backend/models.py**
```python
from pydantic import validator
import re

class SocialAccountBase(CamelModel):
    username: str
    display_name: str
    avatar_url: str
    
    @validator('username')
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9_.-]{1,50}$', v):
            raise ValueError(
                'Username must be 1-50 chars, alphanumeric with _ . - only'
            )
        return v
    
    @validator('display_name')
    def validate_display_name(cls, v):
        if len(v) > 100:
            raise ValueError('Display name must be max 100 characters')
        # Allow more characters for display names, but strip HTML
        from validators import sanitize_text
        return sanitize_text(v)
```

**Estimated Effort:** 30 minutes

---

### TODO-M5: Validate Interaction Data
**Issue:** Arbitrary JSON stored without schema

**Changes Required:**

**backend/models.py**
```python
from typing import Union
from pydantic import BaseModel

class LikeInteractionData(BaseModel):
    action: Literal["like", "unlike"]

class NavigationInteractionData(BaseModel):
    direction: Literal["next", "previous"]
    from_position: int
    to_position: int

class CommentInteractionData(BaseModel):
    comment_id: str
    action: Literal["click", "view"]

# Union type for all interaction data
InteractionDataType = Union[
    LikeInteractionData,
    NavigationInteractionData,
    CommentInteractionData,
    Dict  # Fallback for unknown types
]

class Interaction(CamelModel, table=True):
    # ...
    interaction_data: Optional[InteractionDataType] = Field(default=None, sa_type=JSON)
```

**Estimated Effort:** 2 hours

---

### TODO-M6: Validate URL Fields
**Issue:** No URL validation, open redirect risk

**Changes Required:**

**backend/models.py**
```python
from pydantic import HttpUrl, validator

class ProjectBase(CamelModel):
    redirect_url: HttpUrl  # Validates URL format
    
    @validator('redirect_url')
    def validate_redirect_url(cls, v):
        if v:
            # Only allow https in production
            if ENVIRONMENT == "production" and not str(v).startswith("https://"):
                raise ValueError("Redirect URL must use HTTPS in production")
        return v

class SocialAccountBase(CamelModel):
    avatar_url: HttpUrl
```

**Testing:**
- Test invalid URLs rejected
- Test javascript: URLs rejected
- Test file: URLs rejected
- Test http: allowed in dev, rejected in production

**Estimated Effort:** 1 hour

---

### TODO-M7: Explicit Path Traversal Check (Defense in Depth)
**Issue:** While UUID prevents this, add explicit check

**Changes Required:**

**backend/routes/storage.py**
```python
@router.post("/api/objects/upload")
async def upload_file(...):
    # After generating unique_filename
    
    # Defense in depth: Ensure filename is just a filename
    if '/' in unique_filename or '\\' in unique_filename or '..' in unique_filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename detected"
        )
    
    # Ensure it doesn't become an absolute path
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    real_upload_dir = os.path.realpath(UPLOAD_DIR)
    real_file_path = os.path.realpath(file_path)
    
    if not real_file_path.startswith(real_upload_dir):
        raise HTTPException(
            status_code=400,
            detail="Path traversal attempt detected"
        )
```

**Estimated Effort:** 30 minutes

---

### TODO-M8: Validate Participant IDs
**Issue:** No validation on participant ID format/length

**Changes Required:**

**backend/routes/interactions.py** and **backend/routes/feed.py**
```python
from pydantic import validator, constr

class InteractionCreate(CamelModel):
    participant_id: constr(max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    # ...

@router.get("/api/feed/{public_url}")
def get_public_feed(
    public_url: str,
    participantId: Optional[constr(max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')] = None,
    # ...
```

**Testing:**
- Test very long participant IDs rejected
- Test special characters rejected
- Test valid IDs accepted

**Estimated Effort:** 30 minutes

---

### TODO-M9: Add Content Security Policy
**Issue:** Missing CSP headers

**Changes Required:**

**backend/main.py**
```python
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Adjust for your needs
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "media-src 'self' https:; "
            "connect-src 'self'; "
            "font-src 'self' data:; "
            "frame-ancestors 'none'; "
        )
        
        # Other security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        if ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

**Testing:**
- Test headers present in responses
- Test CSP doesn't break frontend
- Adjust CSP directives as needed

**Estimated Effort:** 1-2 hours

---

### TODO-M10: Enforce PostgreSQL in Production
**Issue:** SQLite not suitable for production

**Changes Required:**

**backend/database.py**
```python
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///database.db")

if ENVIRONMENT == "production":
    if DATABASE_URL.startswith("sqlite"):
        raise RuntimeError(
            "SQLite is not supported in production. "
            "Please set DATABASE_URL to a PostgreSQL connection string."
        )

engine = create_engine(
    DATABASE_URL,
    # Add production-appropriate settings
    pool_size=5 if ENVIRONMENT == "production" else 1,
    max_overflow=10 if ENVIRONMENT == "production" else 0,
    pool_pre_ping=True,  # Test connections before using
)
```

**Documentation:**
- Add PostgreSQL setup instructions to README
- Add example DATABASE_URL to .env.example

**Estimated Effort:** 30 minutes

---

### TODO-M11: Make CORS Origins Configurable
**Issue:** Hardcoded development origins

**Changes Required:**

**backend/config.py**
```python
# CORS Configuration
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://0.0.0.0:5173"
).split(",")
```

**backend/main.py**
```python
from config import ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],  # Specific methods
    allow_headers=["*"],  # Or restrict to specific headers
)
```

**backend/.env.example**
```bash
# CORS - Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

**Estimated Effort:** 30 minutes

---

### TODO-M12: Restrict CORS Methods
**Issue:** Wildcard allows any HTTP method

*Covered in TODO-M11 above*

---

### TODO-M13: Add Security Headers for Media Files
**Issue:** Static files served without security headers

**Changes Required:**

**backend/main.py**
```python
from starlette.staticfiles import StaticFiles
from starlette.types import Scope, Receive, Send

class SecureStaticFiles(StaticFiles):
    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        async def send_wrapper(message):
            if message['type'] == 'http.response.start':
                headers = list(message.get('headers', []))
                headers.append((b'x-content-type-options', b'nosniff'))
                headers.append((b'content-disposition', b'inline'))
                headers.append((b'x-frame-options', b'DENY'))
                message['headers'] = headers
            await send(message)
        await super().__call__(scope, receive, send_wrapper)

# Replace StaticFiles with SecureStaticFiles
if os.path.exists(UPLOAD_DIR):
    app.mount("/media", SecureStaticFiles(directory=UPLOAD_DIR), name="media")
```

**Estimated Effort:** 1 hour

---

### TODO-M14: Add Virus Scanning for Uploads
**Issue:** No malware detection

**Changes Required:**

1. **Add ClamAV dependency**
   ```bash
   # Install ClamAV daemon on server
   sudo apt-get install clamav clamav-daemon
   
   # Python client
   uv add clamd
   ```

2. **backend/validators.py**
   ```python
   import clamd
   
   class FileValidator:
       def __init__(self, ...):
           # ...
           try:
               self.clamd_client = clamd.ClamdUnixSocket()
               self.clamd_available = True
           except:
               self.clamd_available = False
               if ENVIRONMENT == "production":
                   raise RuntimeError("ClamAV is required in production")
       
       async def validate_file(self, file: UploadFile) -> dict:
           # ... existing checks ...
           
           # Virus scan in production
           if self.clamd_available:
               file_content = await file.read()
               await file.seek(0)
               
               scan_result = self.clamd_client.scan_stream(file_content)
               if scan_result and 'stream' in scan_result:
                   status, virus_name = scan_result['stream']
                   if status == 'FOUND':
                       result["valid"] = False
                       result["errors"].append(f"Malware detected: {virus_name}")
```

**Note:** This requires infrastructure setup. May defer to deployment phase.

**Estimated Effort:** 2-4 hours (plus infrastructure)

---

### TODO-M15: Strip Image Metadata
**Issue:** EXIF data may contain sensitive info

**Changes Required:**

1. **Add dependency**
   ```bash
   uv add pillow
   ```

2. **backend/routes/storage.py**
   ```python
   from PIL import Image
   
   @router.post("/api/objects/upload")
   async def upload_file(...):
       # After saving file
       
       # Strip metadata from images
       if file_ext in ['.jpg', '.jpeg', '.png']:
           try:
               img = Image.open(file_path)
               # Create new image without EXIF
               data = list(img.getdata())
               image_without_exif = Image.new(img.mode, img.size)
               image_without_exif.putdata(data)
               image_without_exif.save(file_path)
           except Exception as e:
               # Log but don't fail upload
               import logging
               logging.warning(f"Failed to strip EXIF data: {e}")
```

**Estimated Effort:** 1 hour

---

### TODO-M16: Document Secrets Rotation
**Issue:** No rotation procedures

**Changes Required:**

Create **SECURITY_OPERATIONS.md**
```markdown
# Security Operations Guide

## Secrets Rotation Procedures

### Rotating SESSION_SECRET

1. Generate new secret: `openssl rand -hex 32`
2. Update SESSION_SECRET in production environment
3. Deploy new version
4. All existing JWT tokens will be invalidated
5. Users will need to log in again

**Schedule:** Rotate every 90 days or immediately if compromised

### Rotating ROCKET_API_KEY

1. Generate new key from RocketAPI dashboard
2. Update ROCKET_API_KEY in production environment
3. Deploy new version
4. Test Instagram ingest functionality
5. Revoke old key in RocketAPI dashboard

**Schedule:** Rotate every 6 months or immediately if compromised

## Incident Response

### If JWT Secret is Compromised
1. Generate new SESSION_SECRET immediately
2. Deploy to production
3. Notify all users to log in again
4. Review access logs for suspicious activity
5. Post-incident review

### If Database is Compromised
1. Rotate all secrets immediately
2. Force password reset for all users
3. Review and patch vulnerability
4. Notify affected users per GDPR/regulations
5. Document incident and response
```

**Estimated Effort:** 1 hour

---

### TODO-M17: Add Environment Variable Validation
**Issue:** Typos cause runtime errors

**Changes Required:**

**backend/config.py**
```python
from pydantic import BaseSettings, Field, validator

class Settings(BaseSettings):
    # Database
    database_url: str = Field(default="sqlite:///database.db", env="DATABASE_URL")
    
    # Upload Directory
    upload_dir: str = Field(default="./uploads", env="UPLOAD_DIR")
    
    # Base URL
    base_url: str = Field(default="http://localhost:8000", env="BASE_URL")
    
    # API Keys
    rocket_api_key: Optional[str] = Field(default=None, env="ROCKET_API_KEY")
    
    # Auth
    session_secret: Optional[str] = Field(default=None, env="SESSION_SECRET")
    environment: str = Field(default="development", env="ENV")
    access_token_expire_minutes: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    algorithm: str = "HS256"
    
    # CORS
    allowed_origins: List[str] = Field(
        default=["http://localhost:5173"],
        env="ALLOWED_ORIGINS"
    )
    
    @validator('environment')
    def validate_environment(cls, v):
        allowed = ['development', 'staging', 'production']
        if v.lower() not in allowed:
            raise ValueError(f"ENV must be one of: {allowed}")
        return v.lower()
    
    @validator('session_secret')
    def validate_session_secret(cls, v, values):
        env = values.get('environment', 'development')
        if env == 'production' and not v:
            raise ValueError("SESSION_SECRET required in production")
        if v and len(v) < 32:
            raise ValueError("SESSION_SECRET must be at least 32 characters")
        return v
    
    @validator('access_token_expire_minutes')
    def validate_token_expiry(cls, v):
        if v < 1 or v > 10080:  # Max 1 week
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be 1-10080")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create global settings instance
settings = Settings()

# Export for backward compatibility
DATABASE_URL = settings.database_url
UPLOAD_DIR = settings.upload_dir
BASE_URL = settings.base_url
ROCKET_API_KEY = settings.rocket_api_key
SECRET_KEY = settings.session_secret or "dev-only-secret"
ENVIRONMENT = settings.environment
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
ALGORITHM = settings.algorithm
ALLOWED_ORIGINS = settings.allowed_origins
```

**Estimated Effort:** 2 hours

---

## 🔵 LOW PRIORITY (Nice to Have)

### TODO-L1: Enable Database Encryption at Rest
**Issue:** Unencrypted database files

**Solution:**
- Use PostgreSQL with `pgcrypto` extension
- Or use AWS RDS with encryption enabled
- Or use encrypted filesystem (LUKS)

**Documentation:** Add to deployment guide

**Estimated Effort:** Varies by infrastructure (0 hours for managed services)

---

### TODO-L2: Document Backup Procedures
**Issue:** No documented backup strategy

Create **BACKUP_PROCEDURES.md** with:
- Backup schedule (daily recommended)
- Backup retention policy (30 days minimum)
- Restore procedures
- Test restore process monthly

**Estimated Effort:** 2 hours

---

### TODO-L3: Configure Database Connection Pooling
**Issue:** Default pool settings may not scale

*Already addressed in TODO-M10*

---

### TODO-L4: Implement File Deduplication
**Issue:** Duplicate files waste storage

**Changes Required:**

**backend/routes/storage.py**
```python
import hashlib

@router.post("/api/objects/upload")
async def upload_file(...):
    # Calculate hash before saving
    file_content = await file.read()
    await file.seek(0)
    
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # Check if file with this hash already exists
    existing_file = f"{file_hash}{ext}"
    existing_path = os.path.join(UPLOAD_DIR, existing_file)
    
    if os.path.exists(existing_path):
        # File already uploaded, return existing
        return UploadResponse(
            filename=existing_file,
            original_filename=original,
            url=f"{BASE_URL}/media/{existing_file}"
        )
    
    # Save with hash-based filename
    unique_filename = existing_file
    file_path = existing_path
    
    # ... save file ...
```

**Estimated Effort:** 2 hours

---

### TODO-L5: Add Audit Logging
**Issue:** No audit trail for security events

**Changes Required:**

1. **Create audit log model**
   ```python
   class AuditLog(CamelModel, table=True):
       id: UUID = Field(default_factory=uuid4, primary_key=True)
       timestamp: datetime = Field(default_factory=datetime.utcnow)
       user_id: Optional[UUID] = None
       event_type: str  # login, logout, create, update, delete, auth_failure
       resource_type: Optional[str] = None  # project, experiment, video, etc.
       resource_id: Optional[UUID] = None
       ip_address: Optional[str] = None
       user_agent: Optional[str] = None
       details: Optional[Dict] = Field(default=None, sa_type=JSON)
   ```

2. **Add audit logging middleware**
   ```python
   async def log_audit_event(
       event_type: str,
       request: Request,
       user: Optional[Researcher] = None,
       resource_type: Optional[str] = None,
       resource_id: Optional[UUID] = None,
       details: Optional[Dict] = None
   ):
       audit_log = AuditLog(
           event_type=event_type,
           user_id=user.id if user else None,
           resource_type=resource_type,
           resource_id=resource_id,
           ip_address=request.client.host if request.client else None,
           user_agent=request.headers.get("user-agent"),
           details=details
       )
       # ... save to database ...
   ```

3. **Log key events**
   - Login attempts (success and failure)
   - Logout
   - Password changes
   - Resource creation/deletion
   - Authorization failures
   - Sensitive data access

**Estimated Effort:** 4-6 hours

---

### TODO-L6: Add Security Headers
**Issue:** Missing defense-in-depth headers

*Already covered in TODO-M9*

---

### TODO-L7: Add Security-Focused Tests
**Issue:** Limited security testing

**Changes Required:**

Create **backend/tests/test_security.py**
```python
def test_sql_injection_attempts(client):
    """Test that SQL injection attempts are rejected"""
    malicious_inputs = [
        "'; DROP TABLE researchers; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM researchers--"
    ]
    
    for payload in malicious_inputs:
        response = client.post("/api/login", json={
            "email": payload,
            "password": "test"
        })
        # Should not cause 500 error or leak data
        assert response.status_code in [401, 422]

def test_xss_attempts(client, auth_header):
    """Test that XSS payloads are sanitized"""
    xss_payloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>"
    ]
    
    for payload in xss_payloads:
        response = client.post(
            "/api/projects",
            json={"name": payload, "queryKey": "test"},
            headers=auth_header
        )
        if response.status_code == 201:
            data = response.json()
            # Ensure payload is sanitized
            assert "<script>" not in data["name"]
            assert "onerror=" not in data["name"]

def test_path_traversal_attempts(client, auth_header):
    """Test that path traversal is prevented"""
    # Test would require creating mock files and attempting to access them
    pass

def test_csrf_protection(client):
    """Test CSRF protection on state-changing endpoints"""
    # If CSRF protection is implemented
    pass

def test_rate_limiting(client):
    """Test rate limiting on public endpoints"""
    # Make many requests in short time
    for i in range(100):
        response = client.get("/api/feed/test-token")
    
    # Should eventually get rate limited
    # (Exact behavior depends on rate limit implementation)

def test_file_upload_exploits(client, auth_header):
    """Test file upload security"""
    # Test malicious file types
    # Test oversized files
    # Test files with null bytes in name
    pass
```

**Estimated Effort:** 6-8 hours

---

### TODO-L8: Run Penetration Testing
**Issue:** No external security validation

**Actions:**
1. Run OWASP ZAP automated scan
2. Run Burp Suite scan
3. Consider hiring security professional for manual pentest
4. Schedule annually

**Estimated Effort:** 8-16 hours (or external service)

---

### TODO-L9: Add Dependency Vulnerability Scanning
**Issue:** No automated checks for vulnerable dependencies

**Changes Required:**

1. **Add to CI/CD pipeline**
   ```yaml
   # .github/workflows/security.yml
   name: Security Checks
   
   on: [push, pull_request]
   
   jobs:
     dependency-scan:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Python dependency scan
           run: |
             pip install pip-audit
             cd backend
             pip-audit --requirement requirements.txt
         
         - name: JavaScript dependency scan
           run: |
             cd frontend
             npm audit --audit-level=moderate
     
     bandit-scan:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: |
             cd backend
             pip install bandit
             bandit -r . -f json -o bandit-report.json
   ```

2. **Enable GitHub Dependabot**
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "pip"
       directory: "/backend"
       schedule:
         interval: "weekly"
     
     - package-ecosystem: "npm"
       directory: "/frontend"
       schedule:
         interval: "weekly"
   ```

3. **Add pre-commit hook**
   ```yaml
   # Add to .pre-commit-config.yaml
   - repo: https://github.com/Lucas-C/pre-commit-hooks-safety
     rev: v1.3.1
     hooks:
       - id: python-safety-dependencies-check
   ```

**Estimated Effort:** 2 hours

---

### TODO-L10: Update Ruff Version
**Issue:** Outdated linter version

**Changes Required:**

**.pre-commit-config.yaml**
```yaml
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.8.4  # Update to latest
  hooks:
    - id: ruff
      args: ['--fix']
    - id: ruff-format
```

**backend/pyproject.toml**
```toml
[dependency-groups]
dev = [
    "ruff==0.8.4",  # Update version
    # ... other deps
]
```

Then run:
```bash
cd backend
uv sync
pre-commit autoupdate
```

**Estimated Effort:** 15 minutes

---

## Implementation Priority Order

### Week 1 (Critical - Do First)
1. TODO-C1: Enforce strong JWT secret (1h)
2. TODO-C2: Implement refresh tokens (6h)
3. TODO-H6: Add auth to Instagram ingest (15m)
4. TODO-H9: Make RocketAPI key optional in dev (30m)

**Total: ~8 hours**

### Week 2 (High Priority - Before Production)
5. TODO-H1: Add rate limiting (3h)
6. TODO-H2: Add input sanitization (4h)
7. TODO-H3: Fix bulk delete (1h)
8. TODO-H4: Secure/remove proxy endpoint (30m)
9. TODO-H7: Secure comments endpoint (30m)

**Total: ~9 hours**

### Week 3 (Medium Priority - Within Sprint)
10. TODO-M1: Input length validation (1h)
11. TODO-M2: File content-type verification (1h)
12. TODO-M3: Email validation (15m)
13. TODO-M6: URL validation (1h)
14. TODO-M8: Participant ID validation (30m)
15. TODO-M9: Add CSP and security headers (2h)
16. TODO-M11: Configure CORS (30m)
17. TODO-M17: Environment validation (2h)

**Total: ~8.5 hours**

### Week 4 (Low Priority - Nice to Have)
18. TODO-L5: Audit logging (6h)
19. TODO-L7: Security tests (8h)
20. TODO-L9: Dependency scanning (2h)
21. TODO-L10: Update Ruff (15m)

**Total: ~16 hours**

### Future/Infrastructure
- TODO-H5: CSRF protection (if needed)
- TODO-H8: Move tokens to HttpOnly cookies (if desired)
- TODO-M14: Virus scanning (requires infrastructure)
- TODO-L1: Database encryption (infrastructure dependent)
- TODO-L2: Backup procedures (documentation)
- TODO-L8: Penetration testing (external)

---

## Quick Wins (Do First)

These can be done quickly for immediate security improvement:

1. **TODO-H6** - Add auth to Instagram ingest (15 min)
2. **TODO-H9** - Make RocketAPI optional (30 min)
3. **TODO-M3** - Email validation (15 min)
4. **TODO-L10** - Update Ruff (15 min)

**Total: 1.25 hours for 4 quick security improvements**

---

## Success Metrics

Track implementation progress:
- [ ] All Critical items complete
- [ ] All High Priority items complete
- [ ] 75%+ Medium Priority items complete
- [ ] Security tests passing
- [ ] Bandit scan clean
- [ ] Dependency scans clean
- [ ] Pre-commit hooks passing
- [ ] Documentation updated

---

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **FastAPI Security:** https://fastapi.tiangolo.com/tutorial/security/
- **JWT Best Practices:** https://datatracker.ietf.org/doc/html/rfc8725
- **Python Security:** https://python.readthedocs.io/en/stable/library/security_warnings.html
- **NIST Guidelines:** https://csrc.nist.gov/publications

---

**Document Version:** 1.0  
**Last Updated:** January 13, 2026  
**Maintainer:** Security Team
