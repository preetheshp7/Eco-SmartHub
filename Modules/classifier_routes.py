from flask import Blueprint, request, jsonify, render_template
from PIL import Image
import numpy as np
from tensorflow.keras.models import load_model
import os

classifier_bp = Blueprint('classifier', __name__, template_folder='../templates')

# Define the custom loss function
def focal_loss_fixed(y_true, y_pred):
    import tensorflow as tf
    gamma = 2.0
    alpha = 0.25
    epsilon = tf.keras.backend.epsilon()
    
    y_pred = tf.clip_by_value(y_pred, epsilon, 1. - epsilon)
    cross_entropy = -y_true * tf.math.log(y_pred)
    weight = alpha * tf.math.pow(1 - y_pred, gamma)
    loss = weight * cross_entropy
    return tf.reduce_sum(loss, axis=1)

# Try loading the model, log success or failure
try:
    model = load_model('Model/model.h5', custom_objects={'focal_loss_fixed': focal_loss_fixed})
    print("✅ Model loaded successfully")
    IMG_SIZE = (128, 128)
    CLASS_NAMES = [
        'aerosol_cans', 'aluminum_food_cans', 'battery', 'cardboard_boxes', 'clothes',
        'disposable_plastic_cutlery', 'eggshells', 'food_waste', 'glass', 'glass_cosmetic_containers',
        'glass_food_jars', 'magazines', 'paper', 'paper_cups', 'plastic_detergent_bottles',
        'plastic_food_containers', 'plastic_shopping_bags', 'plastic_soda_bottles', 'plastic_straws',
        'plastic_water_bottles', 'shoes', 'styrofoam_food_containers'
    ]
except Exception as e:
    print("❌ Failed to load model:", e)
    model = None

# Image preprocessing function
def preprocess_image(image_path):
    img = Image.open(image_path).resize(IMG_SIZE)
    img_array = np.array(img) / 255.0  # Normalize image
    return np.expand_dims(img_array, axis=0)

@classifier_bp.route('/predict', methods=['POST'])
def predict():
    # Ensure the model is loaded before processing
    if not model:
        return jsonify({'error': 'Model not loaded'}), 500

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    try:
        print("✅ File received, saving to temp_image.jpg")
        path = 'temp_image.jpg'
        file.save(path)

        # Preprocess the image
        processed = preprocess_image(path)
        print("✅ Image processed, making prediction")

        # Get prediction from model
        pred = model.predict(processed)
        print(f"✅ Prediction made: {pred}")

        confidence = np.max(pred)  # Get the highest confidence score
        idx = np.argmax(pred)  # Get the index of the predicted class

        # Convert confidence to float for JSON response
        confidence = float(confidence)
        
        # Remove the temporary image file
        os.remove(path)

        # If confidence is below 45%, return a warning
        if confidence < 0.45:
            print(f"⚠️ Low confidence: {confidence}. Unable to make a confident prediction.")
            return jsonify({
                'error': 'Model confidence is too low. Please provide clearer input.'
            }), 400
        
        print(f"✅ Prediction class: {CLASS_NAMES[idx]}, confidence: {confidence}")
        return jsonify({
            'prediction': CLASS_NAMES[idx],
            'confidence': confidence  # Return confidence value
        })

    except Exception as e:
        print(f"❌ Error occurred: {e}")
        return jsonify({'error': str(e)}), 500
