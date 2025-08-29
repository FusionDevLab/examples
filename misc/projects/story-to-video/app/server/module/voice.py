from openai import OpenAI
import traceback
import json
import subprocess

client = OpenAI()

def generate_tts(text: str, filename: str, voice: str = 'coral', instruction: str = "") -> dict:
    try:
        """Generate narration audio from text using OpenAI TTS and return file path and duration."""
        speech = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=voice,
            input=text,
            instructions=instruction
        )
        with open(filename, "wb") as f:
            f.write(speech.read())
        print(f"TTS audio saved to {filename}")
        duration = get_audio_duration(filename)
        print(f"Audio duration: {duration} seconds")
    except Exception as e:
        traceback.print_exception(e)
        print(f"Error generating TTS: {e}")
        raise e

    return filename, duration


def get_audio_duration(filename):
    """
    Returns duration of an audio file in seconds using ffprobe.
    Requires ffprobe (part of ffmpeg) installed and in PATH.
    """
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            filename
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)
        duration = float(info["format"]["duration"])
        return duration
    except Exception as e:
        print(f"Could not determine duration for {filename}: {e}")
        return None