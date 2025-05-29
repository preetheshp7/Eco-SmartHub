from flask import Flask, render_template, request, jsonify, Blueprint
import os
import requests

API_KEY = os.getenv('API_KEY')  # Ensure this is set in your environment
bot_bp = Blueprint('bot', __name__, template_folder='../templates')

# Waste-related keywords for question filtering
WASTE_KEYWORDS = [
    "waste", "recycling", "disposal", "compost", "ewaste",
    "electronic waste", "plastic", "paper", "organic", "glass",
    "textile", "hazardous", "construction", "demolition", "food waste",
    "reduce", "reuse", "recycle", "landfill", "pollution", "sustainable",
    "garbage", "trash", "litter", "packaging", "container", "scrap",
    "byproduct", "discards", "emission", "spoilage",
    "upcycling", "biodegradable", "non-biodegradable",
    "sewage", "sludge", "leachate", "incineration",
    "sanitation", "dumpsite", "junkyard", "recyclable", "non-recyclable",
    "precycling", "source reduction", "extended producer responsibility",
    "composting", "vermicomposting", "aerobic digestion", "anaerobic digestion",
    "recycling center", "transfer station", "materials recovery facility",
    "bottle bill", "deposit refund", "curbside recycling",
    "Zero Waste",
    "agricultural waste", "industrial waste", "mining waste", "medical waste",
    "radioactive waste", "nuclear waste",
    "e-waste recycling", "plastic recycling", "paper recycling", "glass recycling",
    "textile recycling", "hazardous waste disposal", "construction waste recycling", "food waste recycling"
]

def is_waste_related(question):
    """Check if the question is related to waste based on predefined keywords."""
    question = question.lower()
    return any(keyword in question for keyword in WASTE_KEYWORDS)

@bot_bp.route('/bot')
def bot_home():
    """Render the bot homepage."""
    return render_template('bot.html')

@bot_bp.route('/bot/ask', methods=['POST'])
def ask_chatbot():
    """Handle the user's question and generate a response."""
    data = request.get_json()
    question = data.get('question')

    if not question:
        return jsonify({'error': 'No question received.'}), 400

    if not is_waste_related(question):
        return jsonify({'response': 'Please ask a waste-related question.'}), 200

    if not API_KEY:
        return jsonify({'error': 'OpenRouter API key not configured.'}), 500

    try:
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'qwen/qwen3-30b-a3b:free',
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant. Answer briefly and in simple language.'},
                {'role': 'user', 'content': question}
            ]
        }
        api_url = 'https://openrouter.ai/api/v1/chat/completions'
        api_response = requests.post(api_url, headers=headers, json=payload)
        api_response.raise_for_status()

        bot_data = api_response.json()
        response = bot_data['choices'][0]['message']['content']
        return jsonify({'response': response})

    except requests.exceptions.RequestException as e:
        error_message = f'Error communicating with the AI: {e}'
        print(error_message)
        return jsonify({'error': error_message}), 500

    except KeyError:
        error_message = 'Error processing AI response: Invalid JSON structure.'
        print(error_message)
        return jsonify({'error': error_message}), 500
