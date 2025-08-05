#!/usr/bin/env python3
"""
Convert an audio file to base64 data URL for embedding in HTML
Usage: python convert_audio_to_base64.py path/to/audio.mp3
"""

import base64
import sys
import os
from pathlib import Path

def get_mime_type(file_path):
    """Get MIME type based on file extension"""
    extension = Path(file_path).suffix.lower()
    mime_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.webm': 'audio/webm'
    }
    return mime_types.get(extension, 'audio/mpeg')

def convert_audio_to_base64(file_path):
    """Convert audio file to base64 data URL"""
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found")
        return None
    
    try:
        with open(file_path, 'rb') as audio_file:
            audio_data = audio_file.read()
        
        # Convert to base64
        base64_data = base64.b64encode(audio_data).decode('utf-8')
        
        # Get MIME type
        mime_type = get_mime_type(file_path)
        
        # Create data URL
        data_url = f"data:{mime_type};base64,{base64_data}"
        
        return data_url, len(base64_data)
    
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python convert_audio_to_base64.py path/to/audio.mp3")
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = convert_audio_to_base64(file_path)
    
    if result is None:
        sys.exit(1)
    
    data_url, size = result
    file_name = Path(file_path).name
    
    print(f"// Audio file: {file_name}")
    print(f"// Base64 size: {size:,} characters")
    print(f"const PRELOADED_AUDIO_DATA = '{data_url}';")
    print()
    print("// Add this to your HTML file and use it like:")
    print("// const audio = new Audio(PRELOADED_AUDIO_DATA);")
    print("// audio.play();")

if __name__ == "__main__":
    main()