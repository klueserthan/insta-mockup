import requests

BASE_URL = "http://localhost:8000/api"


def test_get_videos():
    session = requests.Session()

    # 1. Login
    print("Logging in...")
    login_data = {"email": "test@research.edu", "password": "password123"}
    response = session.post(f"{BASE_URL}/login", json=login_data)
    if response.status_code != 200:
        print(f"Login failed: {response.status_code} {response.text}")
        return

    print("Login successful!")

    # 2. Get projects to find an experiment
    print("Fetching projects...")
    projects_resp = session.get(f"{BASE_URL}/projects")
    if projects_resp.status_code != 200:
        print(f"Failed to fetch projects: {projects_resp.status_code}")
        return

    projects = projects_resp.json()
    if not projects:
        print("No projects found. Please create one in the UI first.")
        return

    project_id = projects[0]["id"]
    print(f"Using Project: {projects[0]['name']} ({project_id})")

    # 3. Get experiments for this project
    print(f"Fetching experiments for project {project_id}...")
    experiments_resp = session.get(f"{BASE_URL}/projects/{project_id}/experiments")
    if experiments_resp.status_code != 200:
        print(f"Failed to fetch experiments: {experiments_resp.status_code}")
        return

    experiments = experiments_resp.json()
    if not experiments:
        print("No experiments found for this project.")
        return

    experiment_id = experiments[0]["id"]
    print(f"Using Experiment: {experiments[0]['name']} ({experiment_id})")

    # 4. Finally, test the videos endpoint
    print(f"Fetching videos for experiment {experiment_id}...")
    videos_resp = session.get(f"{BASE_URL}/experiments/{experiment_id}/videos")

    if videos_resp.status_code == 200:
        print("Success! Videos received:")
        import json

        print(json.dumps(videos_resp.json(), indent=2))
    else:
        print(f"Failed to fetch videos: {videos_resp.status_code}")
        print(videos_resp.text)


if __name__ == "__main__":
    test_get_videos()
