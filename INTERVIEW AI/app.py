import google.generativeai as genai
from gtts import gTTS
import os
import time
import platform
import subprocess
import webbrowser
import tempfile
import sounddevice as sd
import soundfile as sf
import numpy as np
import keyboard
import speech_recognition as sr
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
import threading
import cv2
import tkinter as tk
from PIL import Image, ImageTk
import queue
import base64
from dotenv import load_dotenv


load_dotenv()  # Load environment variables from .env file
API_KEY = "AIzaSyDyZkVEmEkxMQdYg1Dyrggodk3-y_9oGUM"  # Default API key
genai.configure(api_key=API_KEY)

console = Console()

class FaceMonitor:
    def __init__(self):
        self.running = False
        self.monitor_thread = None
        self.frame_queue = queue.Queue(maxsize=10)  # Queue for thread-safe frame passing
        
        # Face detection variables
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Video display window
        self.root = None
        self.video_label = None
        self.frame = None
        
    def create_video_window(self):
        """Create a tkinter window to display the video feed"""
        self.root = tk.Tk()
        self.root.title("Interview Camera Monitor")
        self.root.geometry("400x300")
        self.root.attributes('-topmost', True)  # Keep window on top
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)  # Handle window close event
        
        # Create label to display video
        self.video_label = tk.Label(self.root)
        self.video_label.pack(fill=tk.BOTH, expand=True)
        
        # Position window in the corner of the screen
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        self.root.geometry(f"+{screen_width-420}+20")  # Position in top-right corner
        
        # Start updating frames from the queue
        self.update_frame_from_queue()
        
    def update_frame_from_queue(self):
        """Update the video label with frames from the queue - runs in main thread"""
        if not self.running:
            return
            
        try:
            if not self.frame_queue.empty():
                frame = self.frame_queue.get_nowait()
                
                # Convert from BGR (OpenCV format) to RGB (PIL format)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Convert to PIL Image
                pil_image = Image.fromarray(rgb_frame)
                
                # Convert to ImageTk format
                tk_image = ImageTk.PhotoImage(image=pil_image)
                
                # Update label
                self.video_label.configure(image=tk_image)
                self.video_label.image = tk_image  # Keep a reference to prevent garbage collection
        except queue.Empty:
            pass
        except Exception as e:
            console.print(f"[yellow]Frame update error: {e}")
            
        # Schedule the next update
        if self.running and self.root:
            self.root.after(30, self.update_frame_from_queue)  # Update roughly 30 times per second
        
    def on_closing(self):
        """Handle window close event"""
        self.stop_monitoring()
        if self.root:
            self.root.destroy()
            self.root = None
        
    def start_monitoring(self):
        """Start face monitoring in a separate thread"""
        if self.running:
            return
            
        self.running = True
        
        # Create video window if not already created
        # Important: This must be done in the main thread
        if not self.root:
            self.create_video_window()
        
        # Start the monitoring thread
        self.monitor_thread = threading.Thread(target=self.monitor_face)
        self.monitor_thread.daemon = True  # Thread will terminate when main program exits
        self.monitor_thread.start()
        console.print("[green]✓ Face monitoring started")
        
    def stop_monitoring(self):
        """Stop face monitoring"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
            console.print("[blue]Face monitoring stopped")
    
    def monitor_face(self):
        """Run face detection in a loop - runs in separate thread"""
        # Initialize video capture
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            console.print("[red]❌ Could not open webcam")
            self.running = False
            return
            
        # For FPS calculation
        prev_frame_time = 0
        
        while self.running:
            # Capture frame
            ret, frame = cap.read()
            if not ret:
                console.print("[red]❌ Failed to capture frame")
                break
                
            # Calculate FPS
            new_frame_time = time.time()
            fps = 1/(new_frame_time-prev_frame_time) if prev_frame_time > 0 else 0
            prev_frame_time = new_frame_time
                
            # Get frame dimensions
            frame_height, frame_width = frame.shape[:2]
                
            # Convert to grayscale for detection (more efficient)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
            # Detect faces with optimized parameters
            faces = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.2,  # Slightly faster detection
                minNeighbors=5,  
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
                
            # Draw faces if any
            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                
            # Draw status info
            cv2.putText(frame, f"FPS: {int(fps)}", (10, frame_height - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            cv2.putText(frame, f"Faces: {len(faces)}", (frame_width - 120, frame_height - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
            # Add frame to queue instead of updating directly
            try:
                # Don't block if queue is full, just skip this frame
                if not self.frame_queue.full():
                    self.frame_queue.put_nowait(frame.copy())
            except:
                pass
            
            # Brief delay to reduce CPU usage
            time.sleep(0.01)
            
        # Clean up
        cap.release()
        console.print("[blue]Face monitoring thread terminated")

class VoiceInterviewCoach:
    def __init__(self):
        # Configure Gemini AI with the hardcoded API key
        genai.configure(api_key=API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash')  # For standard tasks
        self.vision_model = genai.GenerativeModel('gemini-2.0-flash')  # For audio/vision tasks
        
        # Create a dedicated temp directory for our audio files
        self.temp_dir = os.path.join(tempfile.gettempdir(), "interview_coach")
        os.makedirs(self.temp_dir, exist_ok=True)
        console.print(f"[blue]Using temporary directory: {self.temp_dir}")
        
        # Initialize speech recognizer (keep as backup option)
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 4000  # Adjust based on your environment
        self.recognizer.dynamic_energy_threshold = True
        
        # Check if we can create audio files
        self.audio_enabled = self._check_audio_capability()
        
        # Recording settings
        self.recording = False
        self.sample_rate = 44100  # Hz
        self.channels = 1  # Mono
        self.recording_frames = []
        self.stop_recording_flag = threading.Event()
        
        # Initialize face monitor
        self.face_monitor = FaceMonitor()
        
        # Store context for cross-questioning
        self.interview_context = {
            "questions": [],
            "answers": [],
            "feedback": [],
            "follow_ups": []
        }

    def _check_audio_capability(self):
        """Check if we can create audio files in the temp directory"""
        try:
            # Create a test file in our temp directory
            test_file = os.path.join(self.temp_dir, "test_audio.mp3")
            test_tts = gTTS(text="Test audio", lang='en')
            test_tts.save(test_file)

            # Check if file exists
            if not os.path.exists(test_file):
                console.print("[red]Failed to create test audio file")
                return False

            console.print("[green]✓ Audio capability check passed")

            # Clean up test file
            try:
                os.remove(test_file)
            except Exception as e:
                console.print(f"[yellow]Note: Could not remove test file: {str(e)}")

            return True

        except Exception as e:
            console.print(f"[red]❌ Audio capability check failed: {str(e)}")
            return False

    def text_to_speech(self, text):
        """Play speech using safe file handling"""
        if not self.audio_enabled:
            console.print(f"[yellow][TEXT ONLY]: {text}")
            return

        try:
            # Create a unique filename for this speech in our temp directory
            timestamp = int(time.time())
            temp_file = os.path.join(self.temp_dir, f"speech_{timestamp}.mp3")
            
            # Generate the speech file
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(temp_file)
            
            if not os.path.exists(temp_file):
                raise Exception(f"Failed to create audio file at {temp_file}")
                
            console.print(f"[blue]Playing audio...")
            console.print(f"[dim]{text}")

            if platform.system() == 'Windows':
                # On Windows, use the most reliable method
                os.startfile(temp_file)  # This is Windows-specific but very reliable
                
                # Fallback if startfile fails
                try:
                    if not os.path.exists(temp_file):
                        raise Exception("File doesn't exist")
                    webbrowser.open('file://' + os.path.realpath(temp_file))
                except Exception as e:
                    console.print(f"[yellow]Fallback browser method: {str(e)}")
                    # Last resort
                    subprocess.Popen(f'start {temp_file}', shell=True)
            
            elif platform.system() == 'Darwin':  # macOS
                subprocess.run(['afplay', temp_file])
            else:  # Linux
                for player in ['aplay', 'paplay', 'mpg123', 'mpg321']:
                    try:
                        subprocess.run([player, temp_file])
                        break
                    except:
                        continue
                else:
                    # If no players worked, try browser
                    webbrowser.open('file://' + os.path.realpath(temp_file))

            # Wait based on text length for audio to finish playing
            words = len(text.split())
            wait_time = max(words / 2.5, 3)  # At least 3 seconds
            time.sleep(wait_time)
            
            # Don't delete immediately to prevent issues if audio is still playing
            # We'll clean up all files at the end of the session

        except Exception as e:
            console.print(f"[red]❌ Speech playback error: {str(e)}")
            console.print(f"[yellow][TEXT ONLY]: {text}")

    def auto_record_audio(self):
        """Waits for a button press to start recording and stops when space is pressed"""
        # Create a unique filename for this recording
        timestamp = int(time.time())
        output_file = os.path.join(self.temp_dir, f"recording_{timestamp}.wav")
    
        console.print("\n[bold yellow]Press ENTER to start recording...[/]")
        input()  # Wait for ENTER key press before starting recording
    
        console.print("[bold green]Recording started... Press SPACE to stop recording[/]")
    
        # Initialize recording variables
        self.recording = True
        self.recording_frames = []
        self.stop_recording_flag.clear()
        
        # Set up space key monitor
        def check_for_space_key():
            keyboard.wait('space')
            self.stop_recording_flag.set()
            self.recording = False
            console.print("[blue]Recording stopped by user (SPACE key)")
        
        # Start space key monitor in a separate thread
        key_thread = threading.Thread(target=check_for_space_key)
        key_thread.daemon = True
        key_thread.start()
        
        # Callback function for recording
        def callback(indata, frames, time, status):
            if status:
                console.print(f"[red]Status: {status}")
            if self.recording:
                self.recording_frames.append(indata.copy())
        
        # Start recording stream
        try:
            with sd.InputStream(samplerate=self.sample_rate, channels=self.channels, callback=callback):
                # Wait for space key or timeout (90 seconds max)
                self.stop_recording_flag.wait(timeout=90)
                self.recording = False
                console.print("[blue]Recording complete")
            
            # Save the recording if frames were collected
            if len(self.recording_frames) > 0:
                data = np.concatenate(self.recording_frames, axis=0)
                sf.write(output_file, data, self.sample_rate)
                console.print(f"[green]✓ Recording saved to {output_file}")
                return output_file
            else:
                console.print("[yellow]No audio recorded")
                return None
                
        except Exception as e:
            console.print(f"[red]❌ Recording error: {str(e)}")
            self.recording = False
            return None

    def encode_audio_to_base64(self, audio_file_path):
        """Convert audio file to base64 for API requests"""
        try:
            with open(audio_file_path, "rb") as audio_file:
                encoded_string = base64.b64encode(audio_file.read()).decode('utf-8')
                return encoded_string
        except Exception as e:
            console.print(f"[red]❌ Error encoding audio: {str(e)}")
            return None

    def transcribe_audio_with_gemini(self, audio_file):
        """Use Gemini to transcribe audio"""
        try:
            console.print("[blue]Transcribing your answer with Gemini...")
            
            # Read and encode the audio file
            base64_audio = self.encode_audio_to_base64(audio_file)
            
            if not base64_audio:
                raise Exception("Failed to encode audio file")
            
            # Create a prompt for Gemini to transcribe the audio
            prompt = """Please transcribe this audio recording of an interview answer. 
            Return only the transcribed text without any additional comments or formatting."""
            
            # Create proper message structure with audio content
            audio_part = {
                "mime_type": "audio/wav",
                "data": base64_audio
            }
            
            # Send request to Gemini with audio content
            response = self.vision_model.generate_content(
                contents=[
                    {"parts": [{"text": prompt}, {"inline_data": audio_part}]}
                ]
            )
            
            # Extract the transcribed text
            transcription = response.text.strip()
            
            console.print("[green]✓ Gemini transcription complete")
            return transcription
            
        except Exception as e:
            console.print(f"[red]❌ Gemini transcription error: {str(e)}")
            console.print("[yellow]Falling back to backup transcription method...")
            
            # Fall back to the original transcription method if Gemini fails
            return self.transcribe_audio_backup(audio_file)

    def transcribe_audio_backup(self, audio_file):
        """Backup method: Convert speech to text using speech_recognition"""
        try:
            console.print("[blue]Using backup transcription method...")
            
            # Load the audio file
            with sr.AudioFile(audio_file) as source:
                audio_data = self.recognizer.record(source)
                
                # Use Google's speech recognition
                text = self.recognizer.recognize_google(audio_data)
                
                console.print("[green]✓ Backup transcription complete")
                return text
                
        except sr.UnknownValueError:
            console.print("[yellow]Speech could not be understood")
            return ""
        except sr.RequestError as e:
            console.print(f"[red]Could not request results; {e}")
            return ""
        except Exception as e:
            console.print(f"[red]❌ Backup transcription error: {str(e)}")
            return ""

    def analyze_answer(self, question, answer_text, job_role):
        """Analyze the quality of the answer using Gemini"""
        try:
            console.print("[blue]Analyzing your answer...")
            
            # Create a prompt for Gemini to analyze the answer
            prompt = f"""As an interview coach, please analyze this answer for a {job_role} interview:

Question: {question}

Answer: {answer_text}

Provide analysis in the following format:
1. Provide analysis in the following format:
2. Content Quality (0-10): [Score] - [Brief justification] and Give me how much of the answer is correct and how much is incorrect(in percentage).
3. Relevance to Question (0-10): [Score] - [Brief justification].
4. Completeness (0-10): [Score] - [Brief justification].
5. Sentiment Analysis: [Analyze confidence, nervousness, enthusiasm, etc.].
6. Strengths: [List 2-3 key strengths].
7. Areas for Improvement: [List 2-3 specific suggestions].
8. Specific Feedback: [Give one concrete example of how to improve the answer].
9. Overall Impression: [Brief overall impression of the answer].
10. Additional Insights: [Any additional insights or observations].
11. What all topics are covered in the answer and what more topics can be added to the answer.
12. Highlight the key points in the answer to be added.
13. What are the filler words used in the answer to be removed.
14. while you are giving the feedback ignore the "*".
            """
            
            response = self.model.generate_content(prompt)
            
            console.print("[green]✓ Analysis complete")
            return response.text
            
        except Exception as e:
            console.print(f"[red]❌ Analysis error: {str(e)}")
            return "Unable to analyze the answer due to an error."
            
    def generate_follow_up_questions(self, question, answer_text, job_role):
        """Generate follow-up questions based on the candidate's answer"""
        try:
            console.print("[blue]Generating follow-up questions...")
            
            # Create a prompt for Gemini to generate follow-up questions
            prompt = f"""As an interview coach for a {job_role} position, I need two insightful follow-up questions based on this exchange:

Original Question: {question}

Candidate's Answer: {answer_text}

Generate two specific follow-up questions that:
1. Probe deeper into areas that were mentioned but not fully explored
2. Challenge the candidate to provide more specific examples or details
3. Test the candidate's knowledge in areas they claim expertise

Return just the two follow-up questions without any explanation or commentary. Make them conversational and natural, as if continuing the interview.
            """
            
            response = self.model.generate_content(prompt)
            follow_ups = [q.strip() for q in response.text.split("\n") if q.strip()]
            
            # Ensure we have at least one follow-up
            if not follow_ups:
                follow_ups = [f"Could you elaborate more on your experience with {job_role} responsibilities?"]
            
            # Clean up questions (remove numbers if present)
            clean_follow_ups = []
            for q in follow_ups:
                if q and any(q.startswith(prefix) for prefix in ["1.", "2.", "Question"]):
                    q = q.split(". ", 1)[-1] if ". " in q else q.split(":", 1)[-1]
                clean_follow_ups.append(q.strip())
            
            console.print("[green]✓ Follow-up questions generated")
            return clean_follow_ups[:2]  # Return maximum 2 follow-ups
            
        except Exception as e:
            console.print(f"[red]❌ Follow-up question generation error: {str(e)}")
            return [f"Could you provide more specific examples from your {job_role} experience?"]

    def cleanup_audio_files(self):
        """Clean up all the audio files we created"""
        try:
            files = [os.path.join(self.temp_dir, f) for f in os.listdir(self.temp_dir)]
            count = 0
            for f in files:
                try:
                    os.remove(f)
                    count += 1
                except:
                    pass
            console.print(f"[green]✓ Cleaned up {count} audio files")
        except Exception as e:
            console.print(f"[red]❌ Cleanup error: {str(e)}")

    def conduct_voice_interview(self, job_role="data scientist", num_questions=3):
        try:
            console.print(Panel.fit("🎙 📹 [bold cyan]AI INTERVIEW COACH WITH FACE MONITORING[/]", border_style="cyan"))
            console.print(f"[bold]Starting interview session for [cyan]{job_role}[/] role")
            # Start face monitoring before the interview questions begin
            console.print("[blue]Starting face monitoring...")
            self.face_monitor.start_monitoring()

            # Generate questions
            prompt = f"""Generate {num_questions} challenging but realistic interview questions for {job_role} role.
            Make sure they cover different aspects like technical skills, experience, soft skills, and problem-solving.
            Phrase them as clear, conversational questions without numbers or commentary and start directly from question 1 without telling me what you're gonna do."""
            console.print("[blue]Generating interview questions...")

            response = self.model.generate_content(prompt)
            questions = [q.strip() for q in response.text.split("\n") if q.strip()]

            # Clean up questions and ensure we have the requested number
            clean_questions = []
            for q in questions:
                # Remove numbering if present
                if q and any(q.startswith(prefix) for prefix in ["1.", "2.", "3.", "4.", "5.", "Question"]):
                    q = q.split(". ", 1)[-1] if ". " in q else q.split(":", 1)[-1]
                clean_questions.append(q.strip())
            
            # Make sure we have enough questions
            while len(clean_questions) < num_questions:
                clean_questions.append(f"Can you tell me about your experience as a {job_role}?")
            
            questions = clean_questions[:num_questions]
            
            # Reset interview context
            self.interview_context = {
                "questions": [],
                "answers": [],
                "feedback": [],
                "follow_ups": []
            }

            for i, question in enumerate(questions, 1):
                console.print(f"\n[bold cyan]Question {i}:[/] {question}")
                self.text_to_speech(question)
                
                # Store the question in context
                self.interview_context["questions"].append(question)
                
                # A brief pause before recording starts
                time.sleep(1.5)
                
                # Auto-record user's answer (stops when space is pressed)
                try:
                    console.print("[blue]Auto-starting recording in 2 seconds...")
                    time.sleep(2)
                    audio_file = self.auto_record_audio()
                    
                    if not audio_file:
                        console.print("[yellow]No audio recorded. Skipping analysis.")
                        self.interview_context["answers"].append("")
                        self.interview_context["feedback"].append("")
                        continue
                        
                    # Transcribe the audio using Gemini
                    answer_text = self.transcribe_audio_with_gemini(audio_file)
                    
                    if not answer_text:
                        console.print("[yellow]Could not transcribe your answer. Skipping analysis.")
                        self.interview_context["answers"].append("")
                        self.interview_context["feedback"].append("")
                        continue
                    
                    # Store the answer in context
                    self.interview_context["answers"].append(answer_text)
                    
                    # Show the transcribed text
                    console.print("\n[bold]Your transcribed answer:[/]")
                    console.print(Panel(answer_text, border_style="blue"))
                    
                    # Analyze the answer
                    analysis = self.analyze_answer(question, answer_text, job_role)
                    
                    # Store the feedback in context
                    self.interview_context["feedback"].append(analysis)
                    
                    # Display the analysis as text
                    console.print("\n[bold]Feedback on your answer:[/]")
                    console.print(Panel(Markdown(analysis), border_style="green"))
                    
                    # Save feedback to a text file for reference
                    feedback_file = os.path.join(self.temp_dir, f"feedback_q{i}_{int(time.time())}.txt")
                    with open(feedback_file, 'w') as f:
                        f.write(f"Question: {question}\n\n")
                        f.write(f"Your Answer: {answer_text}\n\n")
                        f.write(f"Feedback:\n{analysis}")
                    console.print(f"[green]✓ Feedback saved to {feedback_file}")
                    
                    # Read out a summary of the feedback
                    if "Specific Feedback:" in analysis:
                        specific_feedback = analysis.split("Specific Feedback:")[1].strip()
                        feedback_summary = f"Here's my feedback on your answer. {specific_feedback}"
                    else:
                        feedback_summary = "I've analyzed your answer and provided detailed feedback on the screen."
                    
                    self.text_to_speech(feedback_summary)
                    
                    # Generate follow-up questions based on the answer
                    follow_ups = self.generate_follow_up_questions(question, answer_text, job_role)
                    self.interview_context["follow_ups"].append(follow_ups)
                    
                    # Ask follow-up questions
                    for j, follow_up in enumerate(follow_ups, 1):
                        console.print(f"\n[bold purple]Follow-up Question {j}:[/] {follow_up}")
                        self.text_to_speech(follow_up)
                        
                        # A brief pause before recording starts
                        time.sleep(1.5)
                        
                        # Auto-record user's answer to follow-up
                        console.print("[blue]Auto-starting recording for follow-up in 2 seconds...")
                        time.sleep(2)
                        follow_up_audio_file = self.auto_record_audio()
                        
                        if not follow_up_audio_file:
                            console.print("[yellow]No audio recorded for follow-up. Moving on.")
                            continue
                            
                        # Transcribe the follow-up answer
                        follow_up_answer = self.transcribe_audio_with_gemini(follow_up_audio_file)
                        
                        if not follow_up_answer:
                            console.print("[yellow]Could not transcribe your follow-up answer. Moving on.")
                            continue
                        
                        # Show the transcribed follow-up answer
                        console.print("\n[bold]Your transcribed follow-up answer:[/]")
                        console.print(Panel(follow_up_answer, border_style="blue"))
                        
                        # Brief feedback on follow-up (simpler than main question)
                        brief_feedback_prompt = f"""Give a very brief (2-3 sentence) feedback on this follow-up answer:
                        
Follow-up Question: {follow_up}
Answer: {follow_up_answer}

Keep it constructive and specific, mentioning one strength and one suggestion for improvement.
                        """
                        
                        brief_feedback_response = self.model.generate_content(brief_feedback_prompt)
                        brief_feedback = brief_feedback_response.text.strip()
                        
                        # Display brief feedback
                        console.print("\n[bold]Quick feedback on follow-up:[/]")
                        console.print(Panel(brief_feedback, border_style="magenta"))
                        
                        # Read out the brief feedback
                        self.text_to_speech(brief_feedback)
                    
                except Exception as e:
                    console.print(f"[red]❌ Error processing this question: {str(e)}")
                
                if i < len(questions):
                    # Add a transition between questions
                    console.print("\n[blue]Moving to the next question...")
                    transition_text = "Let's move on to the next question."
                    self.text_to_speech(transition_text)
                    time.sleep(2)  # Brief pause between questions

            # Stop face monitoring at the end of the interview
            self.face_monitor.stop_monitoring()
            
            # Generate overall interview summary
            console.print("\n[bold cyan]Generating interview summary...[/]")
            
            summary_prompt = f"""As an interview coach, provide a comprehensive summary of this {job_role} interview session.
            
Questions asked:
{chr(10).join(f"- {q}" for q in self.interview_context["questions"])}

Based on the candidate's answers and the feedback provided, please summarize:
1. Overall performance (strengths and areas for improvement)
2. Key recommendations for the candidate
3. Suggested preparation steps for future interviews

Keep the summary concise but actionable, highlighting the most important points.
            """
            
            summary_response = self.model.generate_content(summary_prompt)
            summary = summary_response.text.strip()
            
            # Display the summary
            console.print("\n[bold]INTERVIEW SUMMARY:[/]")
            console.print(Panel(Markdown(summary), border_style="yellow", title="Final Assessment"))
            
            # Save the summary to a file
            summary_file = os.path.join(self.temp_dir, f"interview_summary_{int(time.time())}.txt")
            with open(summary_file, 'w') as f:
                f.write(f"Interview Summary for {job_role} Position\n\n")
                f.write(summary)
                f.write("\n\nDetailed Question-Answer Records:\n\n")
                
                for q_idx, question in enumerate(self.interview_context["questions"]):
                    f.write(f"Question {q_idx + 1}: {question}\n\n")
                    
                    if q_idx < len(self.interview_context["answers"]):
                        f.write(f"Answer: {self.interview_context['answers'][q_idx]}\n\n")
                    
                    if q_idx < len(self.interview_context["feedback"]):
                        f.write(f"Feedback: {self.interview_context['feedback'][q_idx]}\n\n")
                    
                    if q_idx < len(self.interview_context["follow_ups"]):
                        f.write("Follow-up questions:\n")
                        for follow_up in self.interview_context["follow_ups"][q_idx]:
                            f.write(f"- {follow_up}\n")
                        f.write("\n")
                    
                    f.write("-" * 50 + "\n\n")
            
            console.print(f"[green]✓ Complete interview summary saved to {summary_file}")
            
            # Read out a condensed version of the summary
            condensed_summary_prompt = f"""Based on this interview summary, create a brief (3-4 sentences) encouraging verbal conclusion 
            to read to the candidate. Be specific but upbeat, focusing on key strengths and one area to work on:
            
            {summary}"""
            
            condensed_response = self.model.generate_content(condensed_summary_prompt)
            condensed_summary = condensed_response.text.strip()
            
            console.print("\n[bold]Final Remarks:[/]")
            console.print(Panel(condensed_summary, border_style="cyan"))
            
            self.text_to_speech(condensed_summary)
            
            # Clean up audio files
            self.cleanup_audio_files()
            
            console.print(Panel.fit("[bold green]Interview session completed! [/]Good luck with your real interview!", 
                                   border_style="green"))
                                   
        except Exception as e:
            console.print(f"[red]❌ Error during interview: {str(e)}")
            # Make sure face monitoring stops even if there's an error
            self.face_monitor.stop_monitoring()

def main():
    console.print(Panel.fit("[bold cyan]Voice Interview Coach with Face Monitoring[/]", border_style="cyan"))
    console.print("[bold]This program helps you practice interview questions with AI feedback[/]")
    
    # Check for API key in environment
    env_api_key = os.getenv("GEMINI_API_KEY")
    if env_api_key:
        global API_KEY
        API_KEY = env_api_key
        console.print("[green]✓ Using API key from environment")
    else:
        console.print("[yellow]Using default API key. For best results, create a .env file with your GEMINI_API_KEY")
    
    # Create the interview coach
    coach = VoiceInterviewCoach()
    
    while True:
        console.print("\n[bold]Voice Interview Coach[/]")
        
        # Prebuilt job role options
        preset_roles = {
            1: "Data Scientist",
            2: "Software Engineer",
            3: "Product Manager",
            4: "UX Designer",
            5: "Marketing Specialist",
            6: "Financial Analyst",
            7: "Custom Role"
        }
        
        # Display job role options
        console.print("\n[cyan]Select a job role:[/]")
        for key, role in preset_roles.items():
            console.print(f"  {key}. {role}")
        
        # Get user selection
        try:
            role_choice = int(input("\nEnter your choice (1-7): "))
            if 1 <= role_choice <= 6:
                job_role = preset_roles[role_choice]
            elif role_choice == 7:
                job_role = input("Enter your custom job role: ")
            else:
                console.print("[red]Invalid choice. Please enter a number between 1 and 7.[/]")
                continue
        except ValueError:
            console.print("[red]Please enter a valid number.[/]")
            continue
        
        # Get number of questions
        try:
            num_questions = int(input("\nHow many questions would you like to practice? "))
            num_questions = max(1, min(100, num_questions))
        except ValueError:
            console.print("[red]Invalid input. Defaulting to 5 questions.[/]")
            num_questions = 5
        
        # Confirm selection
        console.print(f"\n[green]Starting interview practice for: [bold]{job_role}[/bold][/]")
        console.print(f"[green]Number of questions: [bold]{num_questions}[/bold][/]")
        
        # Start countdown
        console.print("\n[yellow]Interview starting in:[/]")
        for i in range(3, 0, -1):
            console.print(f"[yellow]{i}...[/]")
            time.sleep(1)
        console.print("[green]Begin![/]")
        
        coach.conduct_voice_interview(job_role=job_role, num_questions=num_questions)
        
        # Ask if user wants to continue
        if input("\nWould you like another practice session? (y/n): ").lower() != 'y':
            console.print("[bold blue]Thank you for using Voice Interview Coach. Good luck with your interviews![/]")
            break

if __name__ == "__main__":
    main()