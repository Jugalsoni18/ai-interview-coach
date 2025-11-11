# Resume Analyzer Web Application

This web application analyzes resumes and provides feedback on ATS compatibility and job match scores. It uses Google's Gemini AI to analyze the resume content.

## Features

- Upload resume files (PDF, DOCX, or images)
- Extract text from various file formats
- Analyze resume against specific job roles
- Get detailed feedback on strengths, weaknesses, and improvement suggestions
- View ATS compatibility score
- View job match score for specific roles

## Requirements

- Python 3.8+
- Flask
- PyTesseract (requires Tesseract OCR to be installed)
- Pillow
- PyPDF2
- python-docx
- google-generativeai

## Installation

1. Clone this repository
2. Install Tesseract OCR:
   - Windows: Download and install from https://github.com/UB-Mannheim/tesseract/wiki
   - macOS: `brew install tesseract`
   - Linux: `sudo apt-get install tesseract-ocr`
3. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

## Configuration

1. Get a Gemini API key from Google AI Studio (https://makersuite.google.com/)
2. Replace the API key in `app.py` with your own key:
   ```python
   genai.configure(api_key="YOUR_API_KEY_HERE")
   ```

## Usage

1. Start the Flask server:
   ```
   python app.py
   ```
2. Open your browser and navigate to `http://localhost:5000`
3. Upload a resume file and optionally enter a job role
4. View the analysis results

## Project Structure

- `app.py`: Flask application and backend logic
- `index.html`: Main HTML page
- `styles.css`: CSS styles
- `script.js`: Frontend JavaScript
- `new.py`: Original CLI script for resume analysis

## License

MIT
