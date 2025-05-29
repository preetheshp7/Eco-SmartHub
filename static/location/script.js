// Initialize the autocomplete feature
let autocomplete;

function initAutocomplete() {
    const input = document.getElementById("location");
    autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        types: ['geocode'],
        componentRestrictions: { country: 'in' }
    });

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();
        if (place.geometry) {
            console.log('Selected Place:', place);
        }
    });
}

// Function to fetch waste info based on location
async function fetchWasteInfo() {
    const location = document.getElementById("location").value.trim();
    const resultDiv = document.getElementById("result");
    const loadingSpinner = document.getElementById("loading-spinner");

    // Clear previous results and show the loading spinner
    resultDiv.innerHTML = "";
    loadingSpinner.style.display = "inline-block";

    // Check if location is empty
    if (!location) {
        resultDiv.innerHTML = "<p>Error: Please enter a location.</p>";
        loadingSpinner.style.display = "none";  // Hide loading spinner
        return;
    }

    try {
        const response = await fetch("/waste-info", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ location })
        });

        const data = await response.json();

        if (data.reply && Array.isArray(data.reply) && data.reply.length > 0) {
            let html = "";
            const seen = new Set();  // To store unique place IDs and avoid duplicates

            // Loop through each center and render the details
            data.reply.forEach(center => {
                // Check if center is already rendered based on place_id or name
                if (center.place_id && !seen.has(center.place_id)) {
                    seen.add(center.place_id);  // Mark this place as seen

                    html += `
                        <div class="card">
                            <h3>${center.name || 'Not available'}</h3>
                            <p><strong>Address:</strong> ${center.address || 'Not available'}</p>
                            <p><strong>Contact:</strong> ${center.contact || 'Not available'}</p>
                            <p><strong>Opening hours:</strong> ${center.opening_hours || 'Not available'}</p>
                            <p><strong>Description:</strong> ${center.description || 'Not available'}</p>
                        </div>
                    `;
                }
            });

            // If no unique centers, show a message
            if (html === "") {
                resultDiv.innerHTML = "<p>No recycling centers found near this location.</p>";
            } else {
                resultDiv.innerHTML = html;
            }
        } else {
            resultDiv.innerHTML = "<p>No recycling centers found near this location.</p>";
        }

    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = "<p>Error: Failed to fetch info. Try again later.</p>";
    } finally {
        loadingSpinner.style.display = "none";  // Hide loading spinner after request
    }
}

// Function to use current location
function useMyLocation() {
    const resultDiv = document.getElementById("result");
    const loadingSpinner = document.getElementById("loading-spinner");

    // Show loading spinner while trying to get location
    resultDiv.innerHTML = "";
    loadingSpinner.style.display = "inline-block";

    if (navigator.geolocation) {
        // Attempt to get the user's current location
        navigator.geolocation.getCurrentPosition(async function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            try {
                const response = await fetch("/waste-info", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ location: `${latitude},${longitude}` })
                });

                const data = await response.json();

                if (data.reply && Array.isArray(data.reply) && data.reply.length > 0) {
                    let html = "";
                    const seen = new Set();  // To store unique place IDs and avoid duplicates

                    // Loop through each center and render the details
                    data.reply.forEach(center => {
                        // Check if center is already rendered based on place_id or name
                        if (center.place_id && !seen.has(center.place_id)) {
                            seen.add(center.place_id);  // Mark this place as seen

                            html += `
                                <div class="card">
                                    <h3>${center.name || 'Not available'}</h3>
                                    <p><strong>Address:</strong> ${center.address || 'Not available'}</p>
                                    <p><strong>Contact:</strong> ${center.contact || 'Not available'}</p>
                                    <p><strong>Opening hours:</strong> ${center.opening_hours || 'Not available'}</p>
                                    <p><strong>Description:</strong> ${center.description || 'Not available'}</p>
                                </div>
                            `;
                        }
                    });

                    // If no unique centers, show a message
                    if (html === "") {
                        resultDiv.innerHTML = "<p>No recycling centers found near your current location.</p>";
                    } else {
                        resultDiv.innerHTML = html;
                    }

                } else {
                    resultDiv.innerHTML = "<p>No recycling centers found near your current location.</p>";
                }

            } catch (error) {
                console.error(error);
                resultDiv.innerHTML = "<p>Error: Failed to fetch info. Try again later.</p>";
            } finally {
                loadingSpinner.style.display = "none";  // Hide loading spinner after request
            }

        }, function(error) {
            // Handle location access errors (e.g., permission denied, or location services off)
            console.error(error);
            resultDiv.innerHTML = "<p>Error: Unable to fetch your current location. Please enable location services or try again.</p>";
            loadingSpinner.style.display = "none";  // Hide loading spinner
        });
    } else {
        // Geolocation not supported
        resultDiv.innerHTML = "<p>Error: Geolocation is not supported by your browser.</p>";
        loadingSpinner.style.display = "none";  // Hide loading spinner
    }
}
window.initAutocomplete = initAutocomplete;