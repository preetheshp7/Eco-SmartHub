const wasteTypeSelect = document.getElementById('waste-type');
const suggestedQuestionsDiv = document.getElementById('suggested-questions');
const questionsListDiv = document.getElementById('questions-list');
const customQuestionInput = document.getElementById('customQuestion');
const chatBox = document.getElementById('chat-box');
const errorMessageDiv = document.getElementById('error-message');

// Data structure for waste types and their suggested questions
const suggestedQuestionsData = {
    "electronic": {
        displayName: "Electronic Waste (E-Waste)",
        questions: [
            "How can we dispose of electronic waste safely?",
            "What is the impact of improper e-waste disposal?",
            "What are the recycling methods for e-waste?",
            "Where can I donate old electronics?",
            "Are there any government programs for e-waste recycling?"
        ]
    },
    "plastic": {
        displayName: "Plastic Waste",
        questions: [
            "Where can I recycle plastic bags?",
            "What are the different types of recyclable plastics?",
            "How can I reduce my plastic consumption?",
            "What are the effects of plastic pollution?",
            "What are bioplastics?"
        ]
    },
    "paper": {
        displayName: "Paper Waste",
        questions: [
            "How to recycle paper properly?",
            "What types of paper can be recycled?",
            "What is the impact of deforestation on paper production?",
            "Where can I recycle newspapers?",
            "Are there any innovations in paper recycling?"
        ]
    },
    "organic": {
        displayName: "Organic Waste",
        questions: [
            "How to compost organic waste?",
            "What are the benefits of composting?",
            "What food scraps can be composted?",
            "How to build a compost bin?",
            "What are the uses of compost?"
        ]
    },
    "glass": {
        displayName: "Glass Waste",
        questions: [
            "Where can I recycle glass?",
            "What types of glass are recyclable?",
            "What is the process of glass recycling?",
            "What are the environmental benefits of glass recycling?",
            "Are there any innovations in glass recycling?"
        ]
    },
    "textile": {
        displayName: "Textile Waste",
        questions: [
            "How to recycle old clothes?",
            "What are the environmental impacts of textile waste?",
            "Where can I donate used clothing?",
            "What are the different methods of textile recycling?",
            "How can I reduce textile waste?"
        ]
    },
    "hazardous": {
        displayName: "Hazardous Waste",
        questions: [
            "How to dispose of hazardous waste safely?",
            "What are common examples of household hazardous waste?",
            "Where can I dispose of paint and chemicals?",
            "What are the risks of improper hazardous waste disposal?",
            "Are there any special collection programs for hazardous waste?"
        ]
    },
    "construction": {
        displayName: "Construction and Demolition Waste",
        questions: [
            "How is construction waste recycled?",
            "What materials are included in construction waste?",
            "What are the environmental impacts of construction waste?",
            "Where can I dispose of construction debris?",
            "Are there any regulations for construction waste disposal?"
        ]
    },
    "food": {
        displayName: "Food Waste",
        questions: [
            "How to reduce food waste at home?",
            "What are the environmental impacts of food waste?",
            "How can businesses minimize food waste?",
            "What are the different methods to process food waste?",
            "What are the benefits of reducing food waste?"
        ]
    }
};

function populateWasteTypeDropdown() {
    wasteTypeSelect.innerHTML = '<option value="">Select Waste Type</option>';
    for (const wasteTypeKey in suggestedQuestionsData) {
        if (suggestedQuestionsData.hasOwnProperty(wasteTypeKey)) {
            const wasteType = suggestedQuestionsData[wasteTypeKey];
            const option = document.createElement('option');
            option.value = wasteTypeKey;
            option.textContent = wasteType.displayName;
            wasteTypeSelect.appendChild(option);
        }
    }
}

function showSuggestedQuestions() {
    const selectedWasteType = wasteTypeSelect.value;
    questionsListDiv.innerHTML = ''; // Clear previous suggestions

    if (selectedWasteType && suggestedQuestionsData[selectedWasteType]) {
        const questions = suggestedQuestionsData[selectedWasteType].questions;
        questions.forEach(question => {
            const button = document.createElement('button');
            button.textContent = question;
            button.addEventListener('click', () => askQuestion(question));
            questionsListDiv.appendChild(button);
        });
        suggestedQuestionsDiv.style.display = 'block';
    } else {
        suggestedQuestionsDiv.style.display = 'none';
    }
}

function askQuestion(question) {
    if (question.trim() !== "") {
        displayUserMessage(question);
        fetch('/bot/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                displayErrorMessage(data.error);
            } else if (data.response) {
                displayBotMessage(data.response);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            displayErrorMessage('Failed to connect to the chatbot.');
        });

        if (question === customQuestionInput.value) {
            customQuestionInput.value = ''; // Clear the custom question input after asking
        }
    }
}

function askCustomQuestion() {
    const customQuestion = customQuestionInput.value.trim();
    askQuestion(customQuestion);
}

function displayUserMessage(message) {
    const userDiv = document.createElement('div');
    userDiv.classList.add('user-message');
    userDiv.textContent = message;
    chatBox.appendChild(userDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function displayBotMessage(message) {
    const botDiv = document.createElement('div');
    botDiv.classList.add('bot-message');
    let formattedMessage = formatMessage(message);
    botDiv.innerHTML = formattedMessage;
    chatBox.appendChild(botDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatMessage(message) {
    let formattedMessage = message;

    // Convert URLs to clickable links
    formattedMessage = formattedMessage.replace(/(https?:\/\/[^\s]+)/g, url => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    // Handle markdown-style headers, bold text, and lists
    formattedMessage = formattedMessage.replace(/####\s*(.+)/g, '<h4>$1</h4>');
    formattedMessage = formattedMessage.replace(/###\s*(.+)/g, '<h3>$1</h3>');
    formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    // Handle ordered list formatting
    if (message.startsWith("1.")) {
        const listItems = message.split(/(\d+\.)\s/).filter(Boolean);
        formattedMessage = "<ol>";
        listItems.forEach(item => {
            if (!item.match(/^\d+\.$/)) {
                formattedMessage += `<li>${item}</li>`;
            }
        });
        formattedMessage += "</ol>";
    }

    // Handle bullet list formatting
    if (message.startsWith("*")) {
        const listItems = message.split(/\*\s/).filter(Boolean);
        formattedMessage = "<ul>";
        listItems.forEach(item => {
            formattedMessage += `<li>${item}</li>`;
        });
        formattedMessage += "</ul>";
    }

    return formattedMessage;
}

function displayErrorMessage(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    setTimeout(() => errorMessageDiv.style.display = 'none', 5000);
}

// Call this function when the page loads
window.onload = function() {
    populateWasteTypeDropdown();
    showSuggestedQuestions(); // Initial call in case a default is selected
};
