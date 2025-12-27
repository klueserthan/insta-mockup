"""Tests for T031: Lock semantics in feed delivery."""

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def test_locked_videos_maintain_position_in_feed(client: TestClient):
    """
    T031: Test that locked videos maintain their positions while unlocked videos are randomized.
    
    Given an experiment with multiple media items, when the researcher locks one item to the 
    first position and one item to the last position and saves the configuration, then any 
    subsequent feed session for that experiment shows those items first and last respectively,
    with remaining items randomized in between.
    """
    token = register_and_login(client, email="locktest@test.com")
    headers = auth_headers(token)

    # Create project with a specific randomization seed
    response = client.post(
        "/api/projects",
        json={"name": "Lock Test Project", "randomizationSeed": 12345},
        headers=headers,
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Lock Test Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "lockuser",
            "displayName": "Lock User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create 5 videos
    videos = []
    for i in range(5):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": i * 10,
                "comments": i,
                "shares": i,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())

    # Lock first video (Video 0) and last video (Video 4), based on their creation order
    # (videos were created in sequence, so they already occupy positions 0 through 4)
    
    response = client.patch(
        f"/api/videos/{videos[0]['id']}", json={"isLocked": True}, headers=headers
    )
    assert response.status_code == 200

    response = client.patch(
        f"/api/videos/{videos[4]['id']}", json={"isLocked": True}, headers=headers
    )
    assert response.status_code == 200

    # Get feed with participant ID to trigger randomization
    response = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant1")
    assert response.status_code == 200
    data = response.json()
    feed_videos = data["videos"]

    # Verify we have 5 videos
    assert len(feed_videos) == 5

    # First video should be Video 0 (locked at position 0)
    assert feed_videos[0]["caption"] == "Video 0"

    # Last video should be Video 4 (locked at position 4)
    assert feed_videos[4]["caption"] == "Video 4"

    # Middle videos (1, 2, 3) should be Videos 1, 2, 3 but in randomized order
    # With seed=12345 and participant_id="participant1", the expected order is:
    # ["Video 3", "Video 2", "Video 1"]
    middle_order = [feed_videos[i]["caption"] for i in [1, 2, 3]]
    expected_middle_order = ["Video 3", "Video 2", "Video 1"]
    assert middle_order == expected_middle_order, \
        f"Expected middle order {expected_middle_order}, got {middle_order}"


def test_all_locked_videos_preserve_order(client: TestClient):
    """Test that when all videos are locked, no randomization occurs."""
    token = register_and_login(client, email="alllocked@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post(
        "/api/projects", json={"name": "All Locked Project"}, headers=headers
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "All Locked Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "alllockuser",
            "displayName": "All Lock User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create 3 videos and lock all of them
    videos = []
    for i in range(3):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        video = response.json()
        videos.append(video)

        # Lock each video
        response = client.patch(
            f"/api/videos/{video['id']}", json={"isLocked": True}, headers=headers
        )
        assert response.status_code == 200

    # Get feed
    response = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant1")
    assert response.status_code == 200
    data = response.json()
    feed_videos = data["videos"]

    # Verify order is preserved (no randomization)
    assert len(feed_videos) == 3
    assert feed_videos[0]["caption"] == "Video 0"
    assert feed_videos[1]["caption"] == "Video 1"
    assert feed_videos[2]["caption"] == "Video 2"


def test_no_locked_videos_allows_full_randomization(client: TestClient):
    """Test that when no videos are locked, all can be randomized."""
    token = register_and_login(client, email="nolocks@test.com")
    headers = auth_headers(token)

    # Create project with specific seed
    response = client.post(
        "/api/projects",
        json={"name": "No Locks Project", "randomizationSeed": 99999},
        headers=headers,
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "No Locks Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "nolockuser",
            "displayName": "No Lock User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create 4 videos (none locked)
    videos = []
    for i in range(4):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())

    # Get feed with different participant IDs to verify randomization happens
    response1 = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant1")
    assert response1.status_code == 200
    data1 = response1.json()

    response2 = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant2")
    assert response2.status_code == 200
    data2 = response2.json()

    # Both should have all 4 videos
    assert len(data1["videos"]) == 4
    assert len(data2["videos"]) == 4

    # Extract caption orders
    order1 = [v["caption"] for v in data1["videos"]]
    order2 = [v["caption"] for v in data2["videos"]]

    # With seed=99999 and deterministic randomization, verify exact expected orders
    # Participant1 should get: ["Video 0", "Video 2", "Video 3", "Video 1"]
    # Participant2 should get: ["Video 3", "Video 0", "Video 2", "Video 1"]
    expected_order1 = ["Video 0", "Video 2", "Video 3", "Video 1"]
    expected_order2 = ["Video 3", "Video 0", "Video 2", "Video 1"]
    
    assert order1 == expected_order1, \
        f"Participant1 expected {expected_order1}, got {order1}"
    assert order2 == expected_order2, \
        f"Participant2 expected {expected_order2}, got {order2}"

    # Test determinism: same participant should get same order on multiple requests
    response1_again = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant1")
    assert response1_again.status_code == 200
    data1_again = response1_again.json()
    order1_again = [v["caption"] for v in data1_again["videos"]]
    
    # Verify deterministic behavior - same participant gets identical order
    assert order1 == order1_again, "Same participant should receive identical video order across requests"


def test_preview_mode_uses_default_order(client: TestClient):
    """Test that preview mode (participantId=preview) returns videos in default position order."""
    token = register_and_login(client, email="preview@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post(
        "/api/projects", json={"name": "Preview Project"}, headers=headers
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Preview Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "previewuser",
            "displayName": "Preview User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create 3 videos
    videos = []
    for i in range(3):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())

    # Get feed in preview mode
    response = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=preview")
    assert response.status_code == 200
    data = response.json()

    # Should return videos in their default position order
    assert len(data["videos"]) == 3
    assert data["videos"][0]["caption"] == "Video 0"
    assert data["videos"][1]["caption"] == "Video 1"
    assert data["videos"][2]["caption"] == "Video 2"


def test_out_of_bounds_locked_video_position(client: TestClient):
    """Test that locked video with out-of-bounds position is handled gracefully."""
    token = register_and_login(client, email="outofbounds@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post(
        "/api/projects", json={"name": "Out of Bounds Project"}, headers=headers
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Out of Bounds Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "outofboundsuser",
            "displayName": "Out of Bounds User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create 3 videos at positions 0, 1, 2
    videos = []
    for i in range(3):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())

    # Lock video at position 2 and then manually update its position to 10 (out of bounds)
    response = client.patch(
        f"/api/videos/{videos[2]['id']}", 
        json={"isLocked": True, "position": 10}, 
        headers=headers
    )
    assert response.status_code == 200

    # Get feed - should handle gracefully without crashing
    response = client.get(f"/api/feed/{experiment['publicUrl']}?participantId=participant1")
    assert response.status_code == 200
    data = response.json()

    # Should only have 2 videos (the out-of-bounds locked video is skipped)
    # Videos 0 and 1 should be present
    assert len(data["videos"]) == 2
    captions = {v["caption"] for v in data["videos"]}
    assert captions == {"Video 0", "Video 1"}
