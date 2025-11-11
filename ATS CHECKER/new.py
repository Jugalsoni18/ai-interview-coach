import os
import re
import mimetypes

import pytesseract
from PIL import Image
from PyPDF2 import PdfReader
from docx import Document
import google.generativeai as genai

# Gemini API config
genai.configure(api_key="AIzaSyCS81c_wJl8NuwYgGtmJBoaJiuR-qrFyZw")

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

def extract_score_from_response(response_text, label="ATS"):
    # Match both "ATS Score", "ATS Compatibility Score", or variations like "ATS score: 8/10"
    pattern = rf'{label}.*?Score.*?(\d+(\.\d+)?)[ ]*/?[ ]*10'
    match = re.search(pattern, response_text, re.IGNORECASE)
    if match:
        score = float(match.group(1))
        return round(min(max((score / 10) * 100, 0), 100), 2)
    return None


def analyze_resume(resume_text, job_role=None):
    model = genai.GenerativeModel("gemini-2.0-flash")

    if job_role:
        prompt = f"""
You are a resume analyst and ATS evaluation expert.

Below is a resume. The candidate is applying for the role of **{job_role}**.

---

Resume:
{resume_text}

---

Please provide:
1. Summary of the candidate’s strengths.
2. Match Score out of 10 for the role of {job_role}.
3. ATS Compatibility Score out of 10.
4. Key skills or experience gaps for this role.
5. Specific suggestions to improve match and formatting.
6. Any missing keywords that commonly appear in {job_role} roles.

Make the scores easy to find (e.g., "Match Score: 8/10", "ATS Score: 7.5/10").
        """
    else:
        prompt = f"""
You are a resume analyst and ATS optimization expert.

Below is a resume with no specific job role provided.

---

Resume:
{resume_text}

---

Please provide:
1. General strengths of the resume.
2. ATS Compatibility Score out of 10.
3. Suggestions to improve formatting, clarity, and keyword optimization.
4. Highlight potential roles the candidate might fit well into.
5. Mention any missing technical or soft skills relevant for IT careers.

Format the ATS Score clearly (e.g., "ATS Score: 8.5/10").
        """

    response = model.generate_content(prompt)
    return response.text

# CLI Usage
if __name__ == "__main__":
    resume_path = input("Enter path to your resume file (PDF, DOCX, or Image): ").strip()
    job_role = input("Enter the job role you're targeting (or press Enter to skip): ").strip()

    print("\n📄 Extracting text from resume...\n")
    resume_text = extract_text_from_file(resume_path)
    print("--- Extracted Resume Text ---\n")
    print(resume_text)

    print("\n🤖 Sending resume to Gemini for analysis...\n")
    response_text = analyze_resume(resume_text, job_role if job_role else None)

    print("\n--- Gemini Resume Analysis ---\n")
    print(response_text)

    ats_score = extract_score_from_response(response_text, label="ATS")
    match_score = extract_score_from_response(response_text, label="Match") if job_role else None


    if ats_score is not None:
        print(f"\n📊 ATS Compatibility Score: {ats_score}%")
    else:
        print("\n⚠️ Could not extract ATS score.")

    if job_role:
        if match_score is not None:
            print(f"✅ Estimated Match Percentage for '{job_role}': {match_score}%")
        else:
            print("⚠️ Could not extract Job Match score.")
