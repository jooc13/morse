#!/usr/bin/env python3
"""
Quick test script for the morse workout API.

1. Upload an existing wav file you specify
2. Generate a test wav file using text-to-speech and upload it

Helpful for testing the whole pipeline - upload -> transcription -> workout extraction.
"""

import requests
import sys
import os
from datetime import datetime

# Configuration - update this to your EC2 instance
API_ENDPOINT = "http://18.116.241.17:32531/api/upload"

def upload_audio(filename):
    """Upload audio file to the API endpoint"""
    if not os.path.exists(filename):
        print(f"Error: File '{filename}' not found!")
        return False
    
    print(f"\nUploading {filename} to {API_ENDPOINT}...")
    print(f"File size: {os.path.getsize(filename)} bytes")
    
    try:
        with open(filename, 'rb') as f:
            files = {'audio': (os.path.basename(filename), f, 'audio/wav')}
            response = requests.post(API_ENDPOINT, files=files, timeout=30)
        
        print(f"\n=== Response ===")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Body: {response.text}")
        
        if response.status_code == 200:
            print("\n✓ Upload successful!")
            return True
        else:
            print(f"\n✗ Upload failed with status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Error uploading file: {e}")
        return False

def test_connection():
    """Test basic connectivity to the server"""
    print("Testing server connectivity...")
    try:
        response = requests.get("http://18.116.241.17:32531/", timeout=5)
        print(f"✓ Server responded with status: {response.status_code}")
        if response.text:
            print(f"Response preview: {response.text[:200]}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"✗ Connection failed: {e}")
        return False

def create_test_wav(text="Hello, this is a test of the audio API"):
    """Create a test WAV file with text-to-speech"""
    from gtts import gTTS
    import wave
    from pydub import AudioSegment
    
    filename = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
    temp_mp3 = "temp_tts.mp3"
    
    print(f"\nCreating test WAV file: {filename}")
    print(f"Text: '{text}'")
    
    try:
        # Generate speech
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(temp_mp3)
        
        # Convert to WAV with correct format (16kHz, mono, 16-bit)
        audio = AudioSegment.from_mp3(temp_mp3)
        audio = audio.set_frame_rate(16000)
        audio = audio.set_channels(1)
        audio = audio.set_sample_width(2)  # 16-bit
        audio.export(filename, format="wav")
        
        # Clean up temp file
        os.remove(temp_mp3)
        
        print(f"✓ Created {filename} ({os.path.getsize(filename)} bytes)")
        return filename
        
    except ImportError:
        print("\n✗ Missing dependencies! Install with:")
        print("  pip install gtts pydub")
        print("\nOn macOS, you may also need ffmpeg:")
        print("  brew install ffmpeg")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error creating audio: {e}")
        sys.exit(1)

def main():
    print("=== Audio API Tester ===\n")
    
    # Test connection first
    print()
    if not test_connection():
        print("\nWarning: Server connection test failed!")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print()
    
    # Determine what to upload
    if len(sys.argv) > 1:
        # Upload existing file
        filename = sys.argv[1]
    else:
        # Create a test file with speech
        print("No file specified. Creating a test WAV file with speech...")
        text = input("Enter text to speak (or press Enter for default): ").strip()
        if not text:
            text = "Hello, this is a test of the audio API"
        filename = create_test_wav(text)
    
    # Upload the file
    print()
    success = upload_audio(filename)
    
    print()
    if success:
        print("✓ Test completed successfully!")
    else:
        print("✗ Test failed!")
        sys.exit(1)

if __name__ == "__main__":
    print("\nUsage:")
    print("  python api_test.py                # Create test WAV with text-to-speech")
    print("  python api_test.py my_audio.wav   # Upload existing WAV file")
    print()
    
    main()