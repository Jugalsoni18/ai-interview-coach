# AI Interview Coach Web Application

This is a web-based interface for the AI Interview Coach application. It allows users to practice interview questions with AI feedback and face monitoring.

## Features

- Practice interviews for various job roles
- AI-generated interview questions
- Real-time face monitoring during interviews
- Speech-to-text transcription of your answers
- Detailed AI feedback on your responses
- Follow-up questions based on your answers
- Comprehensive interview summary

## Requirements

- Python 3.7+
- Flask
- Google Generative AI (Gemini)
- gTTS (Google Text-to-Speech)
- OpenCV
- SoundDevice
- SoundFile
- Speech Recognition
- Other dependencies from the original app.py

## Setup

1. Make sure you have all the required dependencies installed:

```bash
pip install flask google-generativeai gtts opencv-python sounddevice soundfile numpy keyboard speechrecognition rich pillow python-dotenv
```

2. Set up your Gemini API key:
   - Create a `.env` file in the project directory
   - Add your API key: `GEMINI_API_KEY=your_api_key_here`

## Running the Application

1. Start the web server:

```bash
python web_app.py
```

2. Open your web browser and navigate to:

```
http://localhost:5000
```

3. Follow the on-screen instructions to start your interview practice.

## Usage

1. Select a job role from the dropdown or enter a custom role
2. Choose the number of questions you want to practice
3. Click "Start Interview" to begin
4. Allow microphone and camera access when prompted
5. Listen to each question and click "Press to Record" to record your answer
6. Press the button again to stop recording
7. Review the AI feedback and answer follow-up questions
8. Continue through all questions to receive a comprehensive interview summary

## Notes

- The face monitoring feature requires camera access
- Audio recording requires microphone access
- All temporary audio files are cleaned up after the session
- For best results, use a quiet environment for recording
