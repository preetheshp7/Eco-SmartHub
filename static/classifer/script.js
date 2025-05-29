const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const outputDiv = document.getElementById("output");
const loadingDiv = document.getElementById("loading");

// Image preview when a file is selected
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
    }
});

// Function to handle image prediction
function predict() {
    const file = imageInput.files[0];
    if (!file) {
        alert("Please select or capture an image first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Show loading spinner and hide output
    loadingDiv.style.display = "block";
    outputDiv.style.display = "none";

    // Send the image to the server for prediction
    fetch("/classifier/predict", {
        method: "POST",
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error("Server returned " + res.status);
        return res.json();
    })
    .then(data => {
        // Hide loading and show output
        loadingDiv.style.display = "none";
        outputDiv.style.display = "block";
        outputDiv.innerHTML = `
            Prediction: <strong>${data.prediction}</strong><br>
            Confidence: <strong>${(data.confidence * 100).toFixed(2)}%</strong>
        `;
    })
    .catch(err => {
        console.error("Error:", err);
        loadingDiv.style.display = "none";
        outputDiv.style.display = "block";
        outputDiv.innerText = "Prediction failed.";
    });
}
