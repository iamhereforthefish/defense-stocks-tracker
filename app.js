/**
 * European Defense Stocks Tracker
 * Manual performance tracking for European defense companies
 */

// Stock definitions
const STOCKS = [
    { ticker: 'BAES.L', company: 'BAE Systems (London)' },
    { ticker: 'RHM', company: 'Rheinmetall (Germany)' },
    { ticker: 'LDOF.MI', company: 'Leonardo (Milan)' },
    { ticker: 'TCFP.PA', company: 'Thales (Paris)' },
    { ticker: 'RR.L', company: 'Rolls-Royce (London)' },
    { ticker: 'SAABb.ST', company: 'SAAB (Stockholm)' },
    { ticker: 'AIR.PA', company: 'Airbus (Paris)' },
    { ticker: 'SAF.PA', company: 'Safran (Paris)' },
    { ticker: 'MTXGn.DE', company: 'MTU Aero Engines (Germany)' },
    { ticker: 'AM.PA', company: 'Dassault Aviation (Paris)' }
];

// Performance periods
const PERIODS = ['1d', '1w', '3m', '12m', 'ytd'];
const PERIOD_LABELS = {
    '1d': '1 Day',
    '1w': '1 Week',
    '3m': '3 Month',
    '12m': '12 Month',
    'ytd': 'YTD'
};

// Data storage
let performanceData = {};
let customDates = [];

/**
 * Initialize the application
 */
function init() {
    loadData();
    buildPerformanceTable();
    renderCustomDates();
}

/**
 * Build the main performance table
 */
function buildPerformanceTable() {
    const tbody = document.getElementById('stocks-body');
    tbody.innerHTML = '';

    STOCKS.forEach(stock => {
        const row = document.createElement('tr');

        // Ticker cell
        const tickerCell = document.createElement('td');
        tickerCell.className = 'ticker';
        tickerCell.textContent = stock.ticker;
        row.appendChild(tickerCell);

        // Company cell
        const companyCell = document.createElement('td');
        companyCell.className = 'company';
        companyCell.textContent = stock.company;
        row.appendChild(companyCell);

        // Performance cells
        PERIODS.forEach(period => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `perf-${stock.ticker}-${period}`;
            input.placeholder = '--%';

            // Load saved value
            const savedValue = performanceData[stock.ticker]?.[period];
            if (savedValue !== undefined && savedValue !== '') {
                input.value = savedValue;
                applyColorClass(input, savedValue);
            }

            // Event listeners
            input.addEventListener('input', () => {
                applyColorClass(input, input.value);
            });

            input.addEventListener('blur', () => {
                formatPercentage(input);
                savePerformanceValue(stock.ticker, period, input.value);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });

            cell.appendChild(input);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

/**
 * Apply color class based on value
 */
function applyColorClass(input, value) {
    const numValue = parseFloat(value.replace('%', ''));
    input.classList.remove('positive', 'negative');

    if (!isNaN(numValue)) {
        if (numValue > 0) {
            input.classList.add('positive');
        } else if (numValue < 0) {
            input.classList.add('negative');
        }
    }
}

/**
 * Format value as percentage
 */
function formatPercentage(input) {
    let value = input.value.trim();
    if (value === '' || value === '-') return;

    // Remove existing % sign
    value = value.replace('%', '');

    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
        // Format with sign and %
        const formatted = (numValue > 0 ? '+' : '') + numValue.toFixed(2) + '%';
        input.value = formatted;
        applyColorClass(input, formatted);
    }
}

/**
 * Save a performance value
 */
function savePerformanceValue(ticker, period, value) {
    if (!performanceData[ticker]) {
        performanceData[ticker] = {};
    }
    performanceData[ticker][period] = value;
}

/**
 * Save all data to localStorage
 */
function saveData() {
    // Collect all current values from inputs
    STOCKS.forEach(stock => {
        PERIODS.forEach(period => {
            const input = document.getElementById(`perf-${stock.ticker}-${period}`);
            if (input) {
                savePerformanceValue(stock.ticker, period, input.value);
            }
        });
    });

    // Save to localStorage
    localStorage.setItem('defenseStocksPerformance', JSON.stringify(performanceData));
    localStorage.setItem('defenseStocksCustomDates', JSON.stringify(customDates));

    showSaveStatus('Data saved!', 'success');
}

/**
 * Load data from localStorage
 */
function loadData() {
    const savedPerformance = localStorage.getItem('defenseStocksPerformance');
    const savedCustomDates = localStorage.getItem('defenseStocksCustomDates');

    if (savedPerformance) {
        performanceData = JSON.parse(savedPerformance);
    }

    if (savedCustomDates) {
        customDates = JSON.parse(savedCustomDates);
    }
}

/**
 * Clear all data
 */
function clearData() {
    if (!confirm('Are you sure you want to clear all data?')) return;

    performanceData = {};
    customDates = [];
    localStorage.removeItem('defenseStocksPerformance');
    localStorage.removeItem('defenseStocksCustomDates');

    buildPerformanceTable();
    renderCustomDates();
    showSaveStatus('Data cleared', 'success');
}

/**
 * Show save status message
 */
function showSaveStatus(message, type) {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = message;
    statusEl.className = 'save-status ' + type;

    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'save-status';
    }, 3000);
}

/**
 * Add a custom date for tracking
 */
function addCustomDate() {
    const dayInput = document.getElementById('custom-day');
    const monthInput = document.getElementById('custom-month');
    const yearInput = document.getElementById('custom-year');

    const day = parseInt(dayInput.value);
    const month = parseInt(monthInput.value);
    const year = parseInt(yearInput.value);

    // Validate
    if (!day || !month || !year) {
        alert('Please enter a valid date (Day, Month, Year)');
        return;
    }

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
        alert('Please enter a valid date');
        return;
    }

    // Format date string
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateDisplay = `${day} ${getMonthName(month)} ${year}`;

    // Check if date already exists
    if (customDates.find(d => d.key === dateKey)) {
        alert('This date has already been added');
        return;
    }

    // Add date
    customDates.push({
        key: dateKey,
        display: dateDisplay,
        data: {}
    });

    // Clear inputs
    dayInput.value = '';
    monthInput.value = '';
    yearInput.value = '';

    // Re-render and save
    renderCustomDates();
    saveData();
}

/**
 * Get month name from number
 */
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
}

/**
 * Render custom date tables
 */
function renderCustomDates() {
    const container = document.getElementById('custom-dates-container');
    container.innerHTML = '';

    customDates.forEach((dateObj, index) => {
        const card = document.createElement('div');
        card.className = 'custom-date-card';

        // Header
        const header = document.createElement('div');
        header.className = 'custom-date-header';
        header.innerHTML = `
            <h3>Performance on ${dateObj.display}</h3>
            <button class="remove-date-btn" onclick="removeCustomDate(${index})">Remove</button>
        `;
        card.appendChild(header);

        // Table
        const table = document.createElement('table');
        table.className = 'custom-date-table';

        // Table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th>Performance</th>
            </tr>
        `;
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement('tbody');
        STOCKS.forEach(stock => {
            const row = document.createElement('tr');

            const tickerCell = document.createElement('td');
            tickerCell.className = 'ticker';
            tickerCell.textContent = stock.ticker;
            row.appendChild(tickerCell);

            const companyCell = document.createElement('td');
            companyCell.className = 'company';
            companyCell.textContent = stock.company;
            row.appendChild(companyCell);

            const perfCell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `custom-${dateObj.key}-${stock.ticker}`;
            input.placeholder = '--%';

            // Load saved value
            const savedValue = dateObj.data[stock.ticker];
            if (savedValue !== undefined && savedValue !== '') {
                input.value = savedValue;
                applyColorClass(input, savedValue);
            }

            // Event listeners
            input.addEventListener('input', () => {
                applyColorClass(input, input.value);
            });

            input.addEventListener('blur', () => {
                formatPercentage(input);
                saveCustomDateValue(index, stock.ticker, input.value);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });

            perfCell.appendChild(input);
            row.appendChild(perfCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        card.appendChild(table);
        container.appendChild(card);
    });
}

/**
 * Save a custom date value
 */
function saveCustomDateValue(dateIndex, ticker, value) {
    if (customDates[dateIndex]) {
        customDates[dateIndex].data[ticker] = value;
    }
}

/**
 * Remove a custom date
 */
function removeCustomDate(index) {
    if (!confirm('Remove this date and all its data?')) return;

    customDates.splice(index, 1);
    renderCustomDates();
    saveData();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
