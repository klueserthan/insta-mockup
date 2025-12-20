from sqlmodel import Session, select, create_engine
# Assuming default sqlite path from database.py (checking main.py/database.py imports usually)
# I'll just rely on the assumption it's sqlite.db in root or similar, but the app is running.
# Let's import the engine creation logic or just use the local file if I can find it.
# Actually faster to just make a small script that imports everything properly.

import sys
import os

from database import engine
from models import ViewSession

with Session(engine) as session:
    sessions = session.exec(select(ViewSession)).all()
    print(f"Total ViewSessions: {len(sessions)}")
    for s in sessions:
        print(f"Session {s.session_id}: Video {s.video_id}, Duration {s.duration_seconds}s, Last Heartbeat {s.last_heartbeat}")
