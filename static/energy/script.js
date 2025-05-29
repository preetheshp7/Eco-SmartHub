document.addEventListener('DOMContentLoaded', () => {
    // DOM Selectors
    const addApplianceForm = document.getElementById('add-appliance-form');
    const tariffTypeSelect = document.getElementById('tariff-type');
    const applianceListBody = document.getElementById('appliance-list-body');
    const totalAppliancesSpan = document.getElementById('total-appliances');
    const totalConsumptionSpan = document.getElementById('total-consumption');
    const estimatedCostSpan = document.getElementById('estimated-cost');
    const applianceTable = document.getElementById('appliance-table');
    const emptyStateDiv = document.querySelector('.empty-state');
    const appliancesTrackedSpan = document.getElementById('appliances-tracked');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const exportCsvBtn = document.querySelector('.export-btn.export-csv-btn'); // More specific selector
    const exportJsonBtn = document.querySelector('.export-btn.export-json-btn'); // More specific selector
    const energyChartCanvas = document.getElementById('energy-usage-chart');
    const energyChartCtx = energyChartCanvas.getContext('2d');
    const aiSuggestionsOutput = document.getElementById('ai-suggestions-output'); // Changed from aiSuggestionList
    const getNewSuggestionBtn = document.getElementById('get-new-suggestion-btn');
    const saveRateBtn = document.getElementById('save-rate-btn');
    const customRateInputsDiv = document.getElementById('custom-rate-inputs'); // New selector for custom rate inputs container

    let energyChart;
    let appliances = JSON.parse(localStorage.getItem('appliances')) || [];
    // Initialize customSlabRates with default structure if not present
    let customSlabRates = JSON.parse(localStorage.getItem('customSlabRates')) || {};
    const aiApiUrl = '/energy/get_ai_suggestions';

    // --- Custom Modal UI Functions ---
    function showCustomAlert(message) {
        const modalOverlay = document.createElement('div');
        modalOverlay.classList.add('custom-modal-overlay');
        modalOverlay.innerHTML = `
            <div class="custom-modal-content">
                <p>${message}</p>
                <div class="custom-modal-buttons">
                    <button id="custom-alert-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        document.getElementById('custom-alert-ok').addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
    }

    function showCustomConfirm(message, onConfirm) {
        const modalOverlay = document.createElement('div');
        modalOverlay.classList.add('custom-modal-overlay');
        modalOverlay.innerHTML = `
            <div class="custom-modal-content">
                <p>${message}</p>
                <div class="custom-modal-buttons">
                    <button id="custom-confirm-cancel">Cancel</button>
                    <button id="custom-confirm-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        document.getElementById('custom-confirm-ok').addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            if (typeof onConfirm === 'function') {
                onConfirm(true);
            }
        });

        document.getElementById('custom-confirm-cancel').addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            if (typeof onConfirm === 'function') {
                onConfirm(false);
            }
        });
    }
    // --- End Custom Modal UI Functions ---

    // Function to update custom rate input fields based on customSlabRates
    function renderCustomRateInputs() {
        customRateInputsDiv.innerHTML = ''; // Clear existing inputs
        if (tariffTypeSelect.value === 'custom') {
            customRateInputsDiv.style.display = 'block';

            // Define default slabs for custom input display if not already defined
            const defaultSlabs = ['0-50', '51-100', '100+'];
            defaultSlabs.forEach(slab => {
                const label = document.createElement('label');
                label.setAttribute('for', `rate-${slab}`);
                label.textContent = `Rate for ${slab} kWh (₹):`;
                customRateInputsDiv.appendChild(label);

                const input = document.createElement('input');
                input.type = 'number';
                input.id = `rate-${slab}`;
                input.min = "0";
                input.step = "0.01";
                input.placeholder = `e.g., ${slab === '0-50' ? '5.00' : slab === '51-100' ? '7.50' : '10.00'}`;
                // Populate with existing custom rate if available
                input.value = customSlabRates[slab] !== undefined ? customSlabRates[slab] : '';
                customRateInputsDiv.appendChild(input);
            });
        } else {
            customRateInputsDiv.style.display = 'none';
        }
    }

    // Initial render of custom rate inputs
    renderCustomRateInputs();

    saveRateBtn.addEventListener('click', () => {
        if (tariffTypeSelect.value === 'custom') {
            const newCustomSlabRates = {};
            const defaultSlabs = ['0-50', '51-100', '100+'];
            let allRatesValid = true;
            defaultSlabs.forEach(slab => {
                const inputElement = document.getElementById(`rate-${slab}`);
                const value = parseFloat(inputElement?.value);
                if (isNaN(value) || value < 0) {
                    allRatesValid = false;
                }
                newCustomSlabRates[slab] = value || 0;
            });

            if (!allRatesValid) {
                showCustomAlert('Please enter valid non-negative numbers for all custom rates.');
                return;
            }
            customSlabRates = newCustomSlabRates;
            localStorage.setItem('customSlabRates', JSON.stringify(customSlabRates));
            showCustomAlert('Custom rates saved successfully!');
        }
        calculateSummary();
        getAndDisplaySuggestions(); // Recalculate suggestions with new rates
    });

    async function fetchAISuggestions(appliancesData) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout
        try {
            const response = await fetch(aiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appliances: appliancesData }),
                signal: controller.signal
            });
            clearTimeout(timeoutId); // Clear timeout if response received

            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    console.error(`API error ${response.status}`, errorData);
                } catch (e) {
                    console.error(`Non-JSON error ${response.status}:`, e);
                }
                return ['Failed to fetch suggestions. Please try again later.'];
            }

            const data = await response.json();
            // Ensure data.suggestions is an array, if not, return a default message
            return Array.isArray(data.suggestions) ? data.suggestions : ['No suggestions received.'];
        } catch (error) {
            clearTimeout(timeoutId); // Clear timeout on any fetch error
            if (error.name === 'AbortError') {
                return ['Request timed out. Please try again later.'];
            }
            console.error('Fetch error:', error);
            return ['An error occurred while fetching suggestions.'];
        }
    }

    function updateAISuggestionsUI(suggestions) {
        aiSuggestionsOutput.innerHTML = ''; // Clear existing suggestions
        if (!suggestions.length) {
            const noSuggestionsDiv = document.createElement('div');
            noSuggestionsDiv.classList.add('suggestion-box'); // Use suggestion-box style for consistency
            noSuggestionsDiv.innerHTML = '<h3>No Suggestions Available</h3><p>Add some appliances to get personalized energy-saving tips!</p>';
            aiSuggestionsOutput.appendChild(noSuggestionsDiv);
            return;
        }

        suggestions.forEach(text => {
            const suggestionBox = document.createElement('div');
            suggestionBox.classList.add('suggestion-box');

            let title = 'Energy Saving Tip';
            let content = text;

            // Simple parsing to extract title if format matches "### **1. Title**"
            const titleMatch = text.match(/### \*\*(\d+\..*?)\*\*\n(.*)/s);
            if (titleMatch && titleMatch[1] && titleMatch[2]) {
                title = titleMatch[1].trim();
                content = titleMatch[2].trim();
            } else {
                // If no specific title format, use the first sentence or a generic title
                const firstSentenceMatch = text.match(/^([^.!?]*[.!?-]?)\s/);
                if (firstSentenceMatch && firstSentenceMatch[1]) {
                    title = firstSentenceMatch[1].trim();
                    content = text.substring(firstSentenceMatch[0].length).trim();
                }
            }

            const h3 = document.createElement('h3');
            h3.textContent = title;
            suggestionBox.appendChild(h3);

            // Split content by newlines to create multiple paragraphs if needed
            content.split('\n').forEach(paragraphText => {
                if (paragraphText.trim()) { // Only add non-empty paragraphs
                    const p = document.createElement('p');
                    // Basic markdown-like bolding for **text**
                    p.innerHTML = paragraphText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    suggestionBox.appendChild(p);
                }
            });

            aiSuggestionsOutput.appendChild(suggestionBox);
        });
    }

    async function getAndDisplaySuggestions() {
        getNewSuggestionBtn.disabled = true;
        getNewSuggestionBtn.innerHTML = '<span class="spinner" aria-label="Loading..."></span> Fetching...'; // Add spinner
        const suggestions = await fetchAISuggestions(appliances);
        updateAISuggestionsUI(suggestions);
        getNewSuggestionBtn.disabled = false;
        getNewSuggestionBtn.textContent = 'Ask for suggestion'; // Reset button text
    }

    function removeAppliance(index) {
        const name = appliances[index].name;
        showCustomConfirm(`Are you sure you want to remove "${name}" from your appliance list?`, (confirmed) => {
            if (confirmed) {
                appliances.splice(index, 1);
                localStorage.setItem('appliances', JSON.stringify(appliances));
                updateDisplay();
                getAndDisplaySuggestions(); // Update suggestions after removal
            }
        });
    }

    function updateDisplay() {
        totalAppliancesSpan.textContent = appliances.length;
        appliancesTrackedSpan.textContent = `${appliances.length} appliances tracked`;

        // Toggle table and empty state visibility
        if (appliances.length === 0) {
            applianceTable.style.display = 'none';
            emptyStateDiv.innerHTML = '<p>🔌 No appliances yet! Add your fridge, AC, or fan to see how much energy you\'re using.</p>';
            emptyStateDiv.style.display = 'block';
        } else {
            applianceTable.style.display = 'table';
            emptyStateDiv.style.display = 'none';
            emptyStateDiv.innerHTML = ''; // Clear empty state message if appliances exist
        }

        renderApplianceList();
        calculateSummary();
        renderChart();
    }
//editing the appliance table 
    function renderApplianceList() {
        applianceListBody.innerHTML = '';
        appliances.forEach((item, index) => {
            const row = applianceListBody.insertRow();
            row.insertCell().textContent = item.name;
            row.insertCell().textContent = `${item.power} W`;
            row.insertCell().textContent = `${item.hours} hours`;
            row.insertCell().textContent = `${item.days} days`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.classList.add('remove-btn');
            removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
            removeBtn.addEventListener('click', () => removeAppliance(index));
            row.insertCell().appendChild(removeBtn);
        });
    }

    function calculateCost(units) {
        const selectedTariff = tariffTypeSelect?.value || 'domestic';
        return selectedTariff === 'custom' ?
            calculateCostUsingCustomSlabs(units) :
            calculateCostUsingDefaultSlabs(units, selectedTariff);
    }

    function calculateCostUsingCustomSlabs(units) {
        // Ensure customSlabRates has the expected keys, default to 0 if not set
        const rate1 = customSlabRates['0-50'] !== undefined ? customSlabRates['0-50'] : 0;
        const rate2 = customSlabRates['51-100'] !== undefined ? customSlabRates['51-100'] : 0;
        const rate3 = customSlabRates['100+'] !== undefined ? customSlabRates['100+'] : 0;

        let cost = 0;
        if (units <= 50) {
            cost += units * rate1;
        } else if (units <= 100) {
            cost += 50 * rate1 + (units - 50) * rate2;
        } else {
            cost += 50 * rate1 + 50 * rate2 + (units - 100) * rate3;
        }
        return cost;
    }

    function calculateCostUsingDefaultSlabs(units, tariffType) {
        let cost = 0;
        switch (tariffType) {
            case 'domestic':
                if (units <= 50) cost = units * 4.00;
                else if (units <= 100) cost = (50 * 4.00) + (units - 50) * 5.45;
                else if (units <= 200) cost = (50 * 4.00) + (50 * 5.45) + (units - 100) * 6.95;
                else cost = (50 * 4.00) + (50 * 5.45) + (100 * 6.95) + (units - 200) * 7.75;
                break;
            case 'commercial':
                cost = units * 8.50;
                break;
            case 'agriculture':
                cost = units * 3.09 + 3.58;
                break; // Assuming fixed charge + per unit
            case 'industrial':
            case 'ev':
                cost = units * 7.00;
                break;
            case 'temporary':
                cost = units * 11.50;
                break;
            default:
                cost = units * 6.00; // Fallback
        }
        return cost;
    }

    function calculateSummary() {
        let totalConsumption = 0;
        appliances.forEach(item => {
            totalConsumption += (item.power / 1000) * item.hours * item.days;
        });
        totalConsumptionSpan.textContent = `${totalConsumption.toFixed(2)} kWh`;
        const estimatedCost = calculateCost(totalConsumption);
        estimatedCostSpan.textContent = `₹${estimatedCost.toFixed(2)}`;
    }

    function renderChart() {
        try {
            const labels = appliances.map(a => a.name);
            const data = appliances.map(a => (a.power / 1000) * a.hours * a.days);

            if (energyChart) {
                energyChart.destroy();
            }

            energyChart = new Chart(energyChartCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Monthly Energy Consumption (kWh)',
                        data,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Allow chart to fill container height
                    plugins: {
                        title: {
                            display: true,
                            text: 'Energy Consumption by Appliance',
                            font: {
                                size: 16
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: val => `${val} kWh`
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Chart rendering error:', e);
            // Fallback if chart fails to render
            energyChartCanvas.style.display = 'none';
            const chartParent = energyChartCanvas.parentElement;
            if (chartParent && !chartParent.querySelector('.chart-error-message')) {
                const errorMessage = document.createElement('p');
                errorMessage.classList.add('chart-error-message');
                errorMessage.textContent = 'Chart data not available or failed to load.';
                errorMessage.style.textAlign = 'center';
                errorMessage.style.color = '#dc3545';
                chartParent.appendChild(errorMessage);
            }
        }
    }

    // Event Listeners
    addApplianceForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('appliance-name').value.trim();
        const power = parseFloat(document.getElementById('appliance-power').value);
        const hours = parseFloat(document.getElementById('appliance-hours').value);
        const days = parseFloat(document.getElementById('appliance-days').value);

        if (!name || isNaN(power) || isNaN(hours) || isNaN(days) || power <= 0 || hours < 0 || days < 1) {
            showCustomAlert('Please fill in all details correctly. Power must be positive, hours non-negative, and days at least 1.');
            return;
        }
        if (hours > 24) {
            showCustomAlert('Hours per day must be between 0–24.');
            return;
        }
        if (days > 31) {
            showCustomAlert('Days per month must be between 1–31.');
            return;
        }

        appliances.push({
            name,
            power,
            hours,
            days
        });
        localStorage.setItem('appliances', JSON.stringify(appliances));
        addApplianceForm.reset();
        updateDisplay();
        await getAndDisplaySuggestions();
    });

    clearAllBtn.addEventListener('click', async () => {
        showCustomConfirm('Are you sure you want to clear all appliances?', (confirmed) => {
            if (confirmed) {
                appliances = [];
                localStorage.removeItem('appliances');
                updateDisplay();
                getAndDisplaySuggestions(); // Update suggestions after clearing
            }
        });
    });

    getNewSuggestionBtn.addEventListener('click', getAndDisplaySuggestions);

    tariffTypeSelect?.addEventListener('change', () => {
        renderCustomRateInputs(); // Re-render custom rate inputs on tariff type change
        calculateSummary(); // Recalculate summary with new tariff selection
    });

    exportCsvBtn.addEventListener('click', () => {
        if (!appliances.length) {
            showCustomAlert('No appliances to export.');
            return;
        }
        const header = 'Name,Power (W),Hours/Day,Days/Month,Monthly Consumption (kWh),Estimated Monthly Cost (₹)\n';
        const csv = header + appliances.map(a => {
            const usage = (a.power / 1000) * a.hours * a.days;
            const cost = calculateCost(usage);
            return `${a.name},${a.power},${a.hours},${a.days},${usage.toFixed(2)},${cost.toFixed(2)}`;
        }).join('\n');
        const blob = new Blob([csv], {
            type: 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'energy_consumption.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    exportJsonBtn.addEventListener('click', () => {
        if (!appliances.length) {
            showCustomAlert('No appliances to export.');
            return;
        }
        const json = JSON.stringify(appliances, null, 2);
        const blob = new Blob([json], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'energy_consumption.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Initial load
    updateDisplay();
    getAndDisplaySuggestions(); // Fetch suggestions on initial load
});