from flask import Blueprint, render_template, request, jsonify
import os
import requests
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging

# Load environment variables
load_dotenv()
API_KEY = os.getenv('API_KEY')

if not API_KEY:
    raise EnvironmentError("Missing API_KEY in environment variables.")

# Set up logging
logging.basicConfig(level=logging.INFO)
IS_DEV = os.getenv('FLASK_ENV') == 'development'

# Blueprint
energy_bp = Blueprint('energy', __name__, template_folder='../templates')

# Rate limiter setup
limiter = Limiter(get_remote_address)

def init_rate_limiter(app):
    limiter.init_app(app)

@energy_bp.route('/energy')
def energy_home():
    """Render the energy calculator page."""
    return render_template('energy.html')

@energy_bp.route('/get_ai_suggestions', methods=['POST'])
@limiter.limit("5 per minute")
def get_ai_suggestions():
    try:
        data = request.get_json()
        if not data:
            logging.warning("No JSON data provided in AI suggestion request.")
            return jsonify({'error': 'No data provided.', 'suggestions': []}), 400

        appliances = data.get('appliances', [])
        if not appliances:
            return jsonify({'suggestions': ['No appliances provided. Add appliances to receive energy tips.']}), 200

        usage_lines = [
            f"- {a['name']}: {a['power']}W for {a['hours']} hrs/day, {a['days']} days/month"
            for a in appliances
        ]

        prompt = (
            "Here is a list of appliances and their monthly usage:\n"
            + "\n".join(usage_lines)
            + "\n\nBased on this data, provide exactly 4-5 personalized, practical energy-saving tips. "
            + "Each tip MUST begin with a heading like:\n1. Tip Title**\n2.Tip Title**\n"
            "Follow that with a paragraph of advice. Use **bold** for emphasis. "
            "Do NOT include any introductions, explanations, or internal analysis.\n\n"
            "Your reply should look like this:\n"
            "1. Optimize Refrigerator Settings**\n"
            "Set the refrigerator to **3-4°C** and freezer to **-18°C**. Keep doors closed and seals tight.\n\n"
            "2. Use LED Lighting**\n"
            "Replace high-wattage bulbs with **LED alternatives** to reduce energy usage dramatically.\n\n"
            "Only return the tips. No extra comments."
        )

        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': 'deepseek/deepseek-chat-v3-0324:free',  # <- More reliable formatting
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 500,
            'temperature': 0.7
        }

        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=20
        )

        logging.info(f"OpenRouter response status: {response.status_code}")

        if response.status_code != 200:
            logging.warning(f"Non-200 response from OpenRouter: {response.status_code} | Body: {response.text}")
            return jsonify({'error': 'Model service unavailable. Please try again later.', 'suggestions': []}), 500

        result_json = response.json()
        message = result_json.get('choices', [])[0].get('message', {}).get('content', '').strip()

        logging.info(f"OpenRouter AI raw message content:\n{message}")

        # Fallback if message is empty
        if not message:
            structured_tips = [
                "### **1. No Tips Generated**\nWe couldn’t generate energy-saving tips. Please try again."
            ]
        else:
            # Ensure all tips start with ###
            structured_tips = [tip.strip() for tip in message.split('\n### ') if tip.strip()]
            structured_tips = [f"### {tip}" if not tip.startswith('###') else tip for tip in structured_tips]

            if not structured_tips:
                logging.warning("Failed to extract structured tips. Returning fallback.")
                structured_tips = [
                    "### **1. General Energy Tip**\nUnplug unused devices to prevent phantom power usage."
                ]

        return jsonify({'suggestions': structured_tips})

    except requests.Timeout:
        logging.error("Request to OpenRouter timed out.")
        return jsonify({'error': 'Request timed out. Please try again later.', 'suggestions': []}), 504
    except requests.RequestException as e:
        logging.error(f"API request error with OpenRouter: {e}")
        return jsonify({'error': f'Network error: {str(e)}', 'suggestions': []}), 503
    except Exception as e:
        logging.exception("Unexpected error during AI suggestion processing.")
        return jsonify({'error': f'An unexpected error occurred: {str(e)}', 'suggestions': []}), 500