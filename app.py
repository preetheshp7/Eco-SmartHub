import os
from flask import Flask, render_template
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize the Flask app
app = Flask(__name__, static_folder='static', template_folder='templates')

# Register Blueprints
from Modules.bot_routes import bot_bp
app.register_blueprint(bot_bp)

from Modules.classifier_routes import classifier_bp
app.register_blueprint(classifier_bp, url_prefix='/classifier')

from Modules.energy_routes import energy_bp
app.register_blueprint(energy_bp, url_prefix='/energy')

from Modules.location_routes import location_bp
app.register_blueprint(location_bp)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/bot')
def bot():
    return render_template('bot.html')

@app.route('/classifier')
def classifier():
    return render_template('classifier.html')
@app.route('/energy')
def energy():
    return render_template('energy.html')

@app.route('/location')
def location():
    return render_template('location.html', GOOGLE_API_KEY=os.getenv("GOOGLE_API_KEY"))

# Run the app
if __name__ == '__main__':
    app.run(debug=True)
