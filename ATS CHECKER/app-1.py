from flask import Flask, request, jsonify, render_template
import os
import re
import mimetypes
import json
from werkzeug.utils import secure_filename

import pytesseract
from PIL import Image
from PyPDF2 import PdfReader
from docx import Document
import google.generativeai as genai
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Gemini API config
genai.configure(api_key="AIzaSyCS81c_wJl8NuwYgGtmJBoaJiuR-qrFyZw")

app = Flask(__name__, static_folder='.', static_url_path='')

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'jpg', 'jpeg', 'png'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_path):
    mime_type, _ = mimetypes.guess_type(file_path)

    if mime_type:
        if "pdf" in mime_type:
            return extract_text_from_pdf(file_path)
        elif "word" in mime_type or file_path.endswith(".docx"):
            return extract_text_from_docx(file_path)
        elif "image" in mime_type or file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            return extract_text_from_image(file_path)
    # fallback
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext in [".jpg", ".jpeg", ".png"]:
        return extract_text_from_image(file_path)
    elif ext == ".pdf":
        return extract_text_from_pdf(file_path)

    raise ValueError("Unsupported file format.")

def extract_text_from_pdf(path):
    reader = PdfReader(path)
    return "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])

def extract_text_from_docx(path):
    doc = Document(path)
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

def extract_text_from_image(path):
    image = Image.open(path)
    return pytesseract.image_to_string(image)

def ai_suggestions(resume_text, job_description=""):
    """Get AI-powered resume improvement tips using Gemini"""
    try:
        available_models = ["gemini-2.0-flash", "gemini-1.0-pro", "gemini-pro"]
        model_name = None
        
        # Try available models
        for model_candidate in available_models:
            try:
                model = genai.GenerativeModel(model_candidate)
                model_name = model_candidate
                logger.info(f"Using Gemini model: {model_name}")
                break
            except Exception as e:
                logger.warning(f"Model {model_candidate} not available: {e}")
        
        if model_name:
            # Generate more precisely structured prompt for easier parsing
            if job_description:
                prompt = f"""
                Analyze this resume and provide the following clearly labeled sections:

                [STRENGTHS]
                List 3-5 key strengths of the resume.

                [ATS_SCORE]
                Provide an ATS Compatibility Score out of 10 (format exactly as: ATS Score: X/10)

                [JOB_MATCH]
                Provide a Job Match Score out of 10 based on how well the resume matches the job description (format exactly as: Job Match Score: X/10)

                [AREAS_TO_IMPROVE]
                List 3 specific areas where the resume could be improved.

                [ATS_ISSUES]
                Identify formatting issues that might cause ATS problems.

                [MISSING_SKILLS]
                List skills mentioned in the job description that are missing from the resume.

                Resume text:
                {resume_text[:4000]}
                
                Job Description:
                {job_description[:2000]}
                """
            else:
                prompt = f"""
                Analyze this resume and provide the following clearly labeled sections:

                [STRENGTHS]
                List 3-5 key strengths of the resume.

                [ATS_SCORE]
                Provide an ATS Compatibility Score out of 10 (format exactly as: ATS Score: X/10)

                [AREAS_TO_IMPROVE]
                List 3 specific areas where the resume could be improved.

                [ATS_ISSUES]
                Identify formatting issues that might cause ATS problems.

                Resume text:
                {resume_text[:4000]}
                """
            
            response = model.generate_content(prompt)
            return response.text
        else:
            raise Exception("No available Gemini models found")
    except Exception as e:
        logger.error(f"Error with Gemini API: {str(e)}")
        
        # Fallback analysis if Gemini API fails
        try:
            word_count = len(resume_text.split())
            score = min(75, word_count // 10)
            
            keywords = ["experience", "skills", "education", "project", "achievement"]
            keyword_count = sum(1 for kw in keywords if kw.lower() in resume_text.lower())
            
            return f"""
            [STRENGTHS]
            - Resume contains content that can be analyzed
            - {keyword_count} out of 5 important section keywords detected

            [ATS_SCORE]
            ATS Score: {score/10}/10

            [AREAS_TO_IMPROVE]
            - Consider expanding on your experiences with more quantifiable achievements
            - Make sure your resume includes relevant keywords from the job description
            - Format your resume with a clean, ATS-friendly layout

            [ATS_ISSUES]
            - Unable to perform detailed analysis due to API limitations
            """
        except Exception as e2:
            return f"Error in analysis: {str(e2)}"

def parse_ai_analysis(response_text):
    """Parse the structured AI analysis response"""
    sections = {
        "strengths": "",
        "atsScore": 0,
        "atsPercentage": 0,
        "matchScore": 0,
        "matchPercentage": 0,
        "areasToImprove": "",
        "atsIssues": "",
        "missingSkills": ""
    }
    
    # Extract sections using regex with labeled sections
    section_patterns = {
        "strengths": r'\[STRENGTHS\](.*?)(?=\[|\Z)',
        "atsScore": r'\[ATS_SCORE\](.*?)(?=\[|\Z)',
        "matchScore": r'\[JOB_MATCH\](.*?)(?=\[|\Z)',
        "areasToImprove": r'\[AREAS_TO_IMPROVE\](.*?)(?=\[|\Z)',
        "atsIssues": r'\[ATS_ISSUES\](.*?)(?=\[|\Z)',
        "missingSkills": r'\[MISSING_SKILLS\](.*?)(?=\[|\Z)'
    }
    
    for key, pattern in section_patterns.items():
        match = re.search(pattern, response_text, re.DOTALL | re.IGNORECASE)
        if match:
            content = match.group(1).strip()
            sections[key] = content
    
    # Extract score values
    ats_score_match = re.search(r'ATS Score:?\s*(\d+(?:\.\d+)?)\s*\/\s*10', sections["atsScore"], re.IGNORECASE)
    if ats_score_match:
        score = float(ats_score_match.group(1))
        sections["atsScore"] = score
        sections["atsPercentage"] = round(score * 10)
    else:
        # Try to find in the entire response as fallback
        ats_score_match = re.search(r'ATS Score:?\s*(\d+(?:\.\d+)?)\s*\/\s*10', response_text, re.IGNORECASE)
        if ats_score_match:
            score = float(ats_score_match.group(1))
            sections["atsScore"] = score
            sections["atsPercentage"] = round(score * 10)
    
    # Extract job match score if present
    if "matchScore" in sections and sections["matchScore"]:
        match_score_match = re.search(r'Job Match Score:?\s*(\d+(?:\.\d+)?)\s*\/\s*10', sections["matchScore"], re.IGNORECASE)
        if match_score_match:
            score = float(match_score_match.group(1))
            sections["matchScore"] = score
            sections["matchPercentage"] = round(score * 10)
    
    return sections

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'resumeFile' not in request.files:
            return jsonify({"error": "No file part"}), 400
            
        file = request.files['resumeFile']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        # Get job description if provided
        job_description = request.form.get('job_description', '')
        
        # Process the file
        if file and allowed_file(file.filename):
            # Save the file temporarily
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(temp_path)
            
            try:
                # Extract text from file
                extracted_text = extract_text_from_file(temp_path)
                
                # Get AI suggestions (with job description if provided)
                logger.info("Using Gemini AI to analyze resume and job match...")
                ai_analysis_text = ai_suggestions(extracted_text, job_description)
                
                # Parse the analysis
                analysis_results = parse_ai_analysis(ai_analysis_text)
                
                # Include extracted text and raw response
                analysis_results["extractedText"] = extracted_text
                analysis_results["rawResponse"] = ai_analysis_text
                analysis_results["hasJobDescription"] = bool(job_description)
                
                # Clean up the temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                
                # Return the results
                return jsonify({
                    "success": True,
                    **analysis_results
                })
                
            except Exception as e:
                logger.error(f"Error processing file: {str(e)}")
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return jsonify({"error": f"Error processing file: {str(e)}"}), 500
        else:
            return jsonify({"error": "File type not allowed"}), 400
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({"error": f"Error uploading file: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=1500)