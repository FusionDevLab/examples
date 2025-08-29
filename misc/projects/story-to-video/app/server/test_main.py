import pytest
import asyncio
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    """Test the root endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Story to Video API Server"
    assert "/generate/audio" in data["endpoints"]
    assert "/generate/video" in data["endpoints"]
    assert "/accumulate" in data["endpoints"]

@pytest.mark.asyncio
async def test_generate_audio_success():
    """Test successful audio generation"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "text": "Hello, this is a test audio generation.",
            "voice_settings": {"speed": 1.0, "pitch": 0.5}
        }
        response = await ac.post("/generate/audio", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Audio generated successfully" in data["message"]
    assert data["file_path"].endswith(".mp3")
    assert data["metadata"]["text_length"] == len(payload["text"])

@pytest.mark.asyncio
async def test_generate_audio_empty_text():
    """Test audio generation with empty text"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"text": "", "voice_settings": {}}
        response = await ac.post("/generate/audio", json=payload)
    
    assert response.status_code == 400
    assert "Text input is required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_generate_video_success():
    """Test successful video generation"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "script": "This is a video script for testing.",
            "audio_file": "generated_audio_123.mp3",
            "video_settings": {"resolution": "1080p", "fps": 30}
        }
        response = await ac.post("/generate/video", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Video generated successfully" in data["message"]
    assert data["file_path"].endswith(".mp4")
    assert data["metadata"]["script_length"] == len(payload["script"])

@pytest.mark.asyncio
async def test_generate_video_empty_script():
    """Test video generation with empty script"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"script": "", "video_settings": {}}
        response = await ac.post("/generate/video", json=payload)
    
    assert response.status_code == 400
    assert "Script input is required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_accumulate_success():
    """Test successful accumulation"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "items": [
                {"type": "audio", "file": "audio1.mp3"},
                {"type": "video", "file": "video1.mp4"}
            ],
            "accumulation_type": "media_collection"
        }
        response = await ac.post("/accumulate", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Items accumulated successfully" in data["message"]
    assert data["count"] == 2
    assert data["accumulated_data"]["processed_items"] == 2

@pytest.mark.asyncio
async def test_accumulate_empty_items():
    """Test accumulation with empty items list"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"items": [], "accumulation_type": "default"}
        response = await ac.post("/accumulate", json=payload)
    
    assert response.status_code == 400
    assert "Items list cannot be empty" in response.json()["detail"]

@pytest.mark.asyncio
async def test_health_check():
    """Test health check endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "story-to-video-server"
