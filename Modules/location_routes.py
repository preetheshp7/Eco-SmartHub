from flask import Blueprint, request, jsonify, render_template
import requests
import os
from dotenv import load_dotenv

# Load environment variables for API keys
load_dotenv()
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

# Initialize the Blueprint for location-based services
location_bp = Blueprint('location_bp', __name__)

@location_bp.route('/location')
def location_page():
    """Render the location page with the Google API key."""
    return render_template('location.html', GOOGLE_API_KEY=GOOGLE_API_KEY)

@location_bp.route('/waste-info', methods=['POST'])
def waste_info():
    """Fetch nearby waste-related centers based on user-provided location."""
    data = request.get_json()
    location = data.get('location')

    # Check if location was provided
    if not location:
        return jsonify({"error": "Location not provided."}), 400

    try:
        # Step 1: Geocode the location to get latitude and longitude
        geo_url = "https://maps.googleapis.com/maps/api/geocode/json"
        if "," in location:  # crude check for "lat,lng"
            geo_params = {"latlng": location, "key": GOOGLE_API_KEY}
        else:
            geo_params = {"address": location, "key": GOOGLE_API_KEY}
        geo_response = requests.get(geo_url, params=geo_params)
        geo_data = geo_response.json()

        # Ensure geocoding request was successful
        if geo_data.get('status') != "OK":
            return jsonify({"error": "Geocoding failed. Please check the location or try again later."}), 400

        if not geo_data.get('results'):
            return jsonify({"error": "Location not found."}), 404

        # Extract latitude and longitude from geocoding response
        lat = geo_data['results'][0]['geometry']['location']['lat']
        lng = geo_data['results'][0]['geometry']['location']['lng']

        # Check if lat/lng values are valid
        if not lat or not lng:
            return jsonify({"error": "Unable to determine location."}), 400

        # Step 2: Search for nearby waste-related centers
        places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        places_params = {
    "location": f"{lat},{lng}",
    "radius": 15000,
    "keyword": "waste disposal OR recycling center OR scrap yard OR reuse center OR junkyard OR salvage yard OR second hand OR municipal corporation OR city hall OR municipality OR municipal council OR local government OR waste segregation OR public sanitation OR solid waste management OR garbage depot OR recycling depot",
    "key": GOOGLE_API_KEY
}


        # Send the request to Places API
        places_response = requests.get(places_url, params=places_params)
        places_data = places_response.json()
        print("Google Places API raw response:", places_data)

        # Step 3: Handle the response and extract the center details
        centers = []
        if places_data.get('results'):
            for place in places_data['results']:
                center = {
                    "place_id": place.get("place_id"),
                    "name": place.get('name', 'Not available'),
                    "address": place.get('vicinity', 'Not available'),
                    "opening_hours": (
                        "Open now" if place.get('opening_hours', {}).get('open_now') else "Closed now"
                    ) if place.get('opening_hours') else "Not available",
                    "description": get_place_description(place)
                }

                centers.append(center)

        # Step 4: Return the centers or an empty result if none found
        if not centers:
            return jsonify({"reply": []})

        return jsonify({"reply": centers})

    except Exception as e:
        # Handle any unexpected errors during the process
        print(f"Error: {e}")
        return jsonify({"error": "Internal server error."}), 500

def get_place_description(place):
    """
    Returns a relevant description of a place.
    Prioritizes: place types, vicinity (address), and any additional details.
    """
    description = []

    # Include place types in the description
    if 'types' in place:
        description.extend(place['types'])

    # Include the vicinity (address) of the place
    if 'vicinity' in place:
        description.append(f"Located at: {place['vicinity']}")

    # Add a fallback description if no specific details are found
    if not description:
        description.append("No additional description available")

    return ", ".join(description)
