import os
import shutil
import sys

from sqlmodel import Session

from auth import ensure_dev_user
from config import UPLOAD_DIR
from database import DATABASE_URL, create_db_and_tables, engine


def reset_db():
    print("WARNING: This will delete the entire database and all uploaded files.")
    confirmation = input("Are you sure you want to proceed? (y/n): ")

    if confirmation.lower() != "y":
        print("Operation cancelled.")
        return

    # 1. Delete Database File
    # Extract path from sqlite:///...
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                print(f"Deleted database: {db_path}")
            except Exception as e:
                print(f"Error deleting database: {e}")
        else:
            print("Database file not found, skipping delete.")
    else:
        print(f"Skipping file deletion for non-sqlite URL: {DATABASE_URL}")
        # For non-sqlite, we might want to drop tables, but simple file delete is arguably what was requested for "reset entire db" in this context if it's sqlite.
        # Given project structure, it's likely sqlite.

    # 2. Wipe Uploads Directory
    if os.path.exists(UPLOAD_DIR):
        try:
            # Delete the directory and its contents
            shutil.rmtree(UPLOAD_DIR)
            print(f"Deleted uploads directory: {UPLOAD_DIR}")
            # Recreate the empty directory
            os.makedirs(UPLOAD_DIR)
            print("Recreated empty uploads directory.")
        except Exception as e:
            print(f"Error wiping uploads directory: {e}")
    else:
        print(f"Uploads directory not found: {UPLOAD_DIR}")
        os.makedirs(UPLOAD_DIR)

    # 3. Create DB and Tables
    print("Creating new database schema...")
    try:
        create_db_and_tables()
        print("Database schema created.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        sys.exit(1)

    # 4. Seed Dev User
    print("Seeding development user...")
    try:
        with Session(engine) as session:
            ensure_dev_user(session)
        print("Dev user created (test@research.edu / password123)")
    except Exception as e:
        print(f"Error seeding user: {e}")

    print("\nReset complete!")


if __name__ == "__main__":
    reset_db()
