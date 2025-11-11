from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
import json
import logging
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure the Gemini API
API_KEY = "AIzaSyCS81c_wJl8NuwYgGtmJBoaJiuR-qrFyZw"
genai.configure(api_key=API_KEY)

# Create a directory for storing conversation history
os.makedirs('chat_history', exist_ok=True)

# Initialize Gemini model
try:
    model = genai.GenerativeModel('gemini-2.0-flash')
    logger.info("Gemini model initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Gemini model: {e}")
    traceback.print_exc()

# JobBuddy system prompt to guide the AI's behavior
SYSTEM_PROMPT = """
You are JobBuddy AI, a helpful career and job search assistant.
Your role is to provide helpful, accurate, and supportive guidance on:
- Job search strategies and techniques
- Interview preparation and common questions
- Resume and cover letter optimization
- Career guidance and professional development
- Workplace skills and communication

Be concise, friendly, and professional. Provide practical advice that users can immediately apply.
If you don't know something, admit it rather than providing incorrect information.
Format your responses with appropriate HTML formatting for the chat interface.
"""

# Store conversation histories (in the format expected by Gemini API)
user_history = {}

@app.route('/', methods=['GET'])
def index():
    return "JobBuddy API is running!"

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        logger.info(f"Received request: {data}")
        
        user_id = data.get('user_id', 'default')
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({"error": "Empty message"}), 400
        
        # Initialize chat for this user if needed
        if user_id not in user_history:
            # Try to load saved history from file
            history_file = f'chat_history/{user_id}.json'
            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    # Load history but don't use it directly with the API
                    # We'll use it to reconstruct the conversation
                    saved_messages = json.load(f)
                    logger.info(f"Loaded history for user {user_id}: {len(saved_messages)} messages")
            else:
                saved_messages = []
                logger.info(f"No history found for user {user_id}, starting new conversation")
                
            # Start a new chat for this user
            user_history[user_id] = {
                'messages': saved_messages,
                'chat': model.start_chat(history=[])
            }
            
            # If this is first interaction, send the system prompt first
            if not saved_messages:
                try:
                    user_history[user_id]['chat'].send_message(SYSTEM_PROMPT)
                    # Save system message in our internal history
                    user_history[user_id]['messages'].append({
                        'role': 'system',
                        'content': SYSTEM_PROMPT
                    })
                    logger.info("System prompt sent to model")
                except Exception as e:
                    logger.error(f"Error sending system prompt: {e}")
                    return jsonify({"error": f"API error: {str(e)}"}), 500
        
        # For returning users, we'll create a new chat but maintain context
        # by sending a summary of the previous conversation
        elif len(user_history[user_id]['messages']) > 0:
            # Create fresh chat
            user_history[user_id]['chat'] = model.start_chat(history=[])
            logger.info(f"Created new chat session for returning user {user_id}")
            
            # First send system prompt
            user_history[user_id]['chat'].send_message(SYSTEM_PROMPT)
            
            # Then send a condensed version of previous messages to maintain context
            # Only if we have more than just the system message
            if len(user_history[user_id]['messages']) > 1:
                context = "Here's our conversation so far:\n\n"
                
                # Add last 5 exchanges (or fewer if there aren't that many)
                max_history = min(10, len(user_history[user_id]['messages']) - 1)
                for msg in user_history[user_id]['messages'][-max_history:]:
                    if msg['role'] == 'system':
                        continue
                    prefix = "User: " if msg['role'] == 'user' else "You: "
                    context += prefix + msg['content'] + "\n\n"
                
                context += "Please continue helping the user with their job search and career questions."
                user_history[user_id]['chat'].send_message(context)
                logger.info("Sent context summary to model")
        
        # Add user message to our history
        user_history[user_id]['messages'].append({
            'role': 'user',
            'content': user_message
        })
        
        # Get response from model
        logger.info(f"Sending user message to Gemini API: {user_message[:50]}...")
        try:
            response = user_history[user_id]['chat'].send_message(user_message)
            response_text = response.text
            logger.info(f"Received response from Gemini API: {response_text[:50]}...")
        except Exception as e:
            logger.error(f"Error from Gemini API: {e}")
            return jsonify({"error": f"API error: {str(e)}"}), 500
        
        # Add bot response to history
        user_history[user_id]['messages'].append({
            'role': 'model',
            'content': response_text
        })
        
        # Save updated history
        try:
            with open(f'chat_history/{user_id}.json', 'w') as f:
                json.dump(user_history[user_id]['messages'], f)
            logger.info(f"Saved history for user {user_id}")
        except Exception as e:
            logger.error(f"Error saving history: {e}")
        
        return jsonify({"reply": response_text})
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset_conversation():
    try:
        data = request.json
        user_id = data.get('user_id', 'default')
        logger.info(f"Resetting conversation for user {user_id}")
        
        # Reset the conversation history
        if user_id in user_history:
            del user_history[user_id]
        
        # Remove the saved history file
        history_file = f'chat_history/{user_id}.json'
        if os.path.exists(history_file):
            os.remove(history_file)
        
        return jsonify({"status": "success", "message": "Conversation reset successfully"})
    
    except Exception as e:
        logger.error(f"Error in reset endpoint: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Make sure the server is accessible from other machines
    logger.info("Starting JobBuddy API server on port 4000...")
    app.run(debug=True, host='0.0.0.0', port=4000)