/**
 * European Defense Stocks Tracker
 * Auto-populated performance data from Yahoo Finance
 */

// Stock definitions with Yahoo Finance tickers
const STOCKS = [
    { ticker: 'BA.L', company: 'BAE Systems (London)' },
    { ticker: 'RHM.DE', company: 'Rheinmetall (Germany)' },
    { ticker: 'LDO.MI', company: 'Leonardo (Milan)' },
    { ticker: 'HO.PA', company: 'Thales (Paris)' },
    { ticker: 'RR.L', company: 'Rolls-Royce (London)' },
    { ticker: 'SAAB-B.ST', company: 'SAAB (Stockholm)' },
    { ticker: 'AIR.PA', company: 'Airbus (Paris)' },
    { ticker: 'SAF.PA', company: 'Safran (Paris)' },
    { ticker: 'MTX.DE', company: 'MTU Aero Engines (Germany)' },
    { ticker: 'AM.PA', company: 'Dassault Aviation (Paris)' }
];

// CORS proxy for Yahoo Finance requests
const CORS_PROXY = 'https://corsproxy.io/?';

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
let isLoading = false;

/**
 * Initialize the application
 */
function init() {
    loadData();
    buildPerformanceTable();
    // Auto-fetch data on load
    fetchAllStockData();
}

/**
 * Fetch performance data for all stocks from Yahoo Finance
 */
async function fetchAllStockData() {
    if (isLoading) return;
    isLoading = true;

    showSaveStatus('Fetching stock data...', 'loading');

    for (const stock of STOCKS) {
        try {
            await fetchStockPerformance(stock.ticker);
            // Small delay to avoid rate limiting
            await sleep(300);
        } catch (error) {
            console.error(`Error fetching ${stock.ticker}:`, error);
        }
    }

    isLoading = false;
    showSaveStatus('Data updated!', 'success');
}

/**
 * Fetch performance data for a single stock
 */
async function fetchStockPerformance(ticker) {
    try {
        // Fetch 1 year of daily data
        const url = `${CORS_PROXY}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!data.chart?.result?.[0]) {
            console.error(`No data for ${ticker}`);
            return;
        }

        const result = data.chart.result[0];
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        const closes = quotes.close;

        if (!closes || closes.length === 0) return;

        // Get current price (most recent close)
        const currentPrice = closes[closes.length - 1];

        // Calculate performance for each period
        const performance = calculatePerformance(timestamps, closes, currentPrice);

        // Update the UI
        updateStockRow(ticker, performance);

        // Store data
        performanceData[ticker] = performance;

    } catch (error) {
        console.error(`Failed to fetch ${ticker}:`, error);
        // Mark as error in UI
        updateStockRowError(ticker);
    }
}

/**
 * Calculate performance for different time periods
 */
function calculatePerformance(timestamps, closes, currentPrice) {
    const now = Date.now() / 1000; // Current timestamp in seconds
    const performance = {};

    // Find prices at different points in time
    const periods = {
        '1d': 1,
        '1w': 7,
        '3m': 90,
        '12m': 365,
        'ytd': null // Special case
    };

    for (const [period, days] of Object.entries(periods)) {
        let targetTimestamp;

        if (period === 'ytd') {
            // Start of current year
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            targetTimestamp = startOfYear.getTime() / 1000;
        } else {
            targetTimestamp = now - (days * 24 * 60 * 60);
        }

        // Find the closest price to the target date
        const historicalPrice = findClosestPrice(timestamps, closes, targetTimestamp);

        if (historicalPrice && currentPrice) {
            const change = ((currentPrice - historicalPrice) / historicalPrice) * 100;
            performance[period] = change;
        } else {
            performance[period] = null;
        }
    }

    return performance;
}

/**
 * Find the closest price to a target timestamp
 */
function findClosestPrice(timestamps, closes, targetTimestamp) {
    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs(timestamps[i] - targetTimestamp);
        if (diff < closestDiff && closes[i] !== null) {
            closestDiff = diff;
            closestIndex = i;
        }
    }

    // Only return if within 5 days of target
    if (closestIndex >= 0 && closestDiff < 5 * 24 * 60 * 60) {
        return closes[closestIndex];
    }

    return null;
}

/**
 * Update a stock row with performance data
 */
function updateStockRow(ticker, performance) {
    PERIODS.forEach(period => {
        const cell = document.getElementById(`perf-${ticker}-${period}`);
        if (cell) {
            const value = performance[period];
            if (value !== null && value !== undefined) {
                const formatted = (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
                cell.textContent = formatted;
                cell.className = 'perf-cell ' + (value >= 0 ? 'positive' : 'negative');
            } else {
                cell.textContent = '--';
                cell.className = 'perf-cell';
            }
        }
    });
}

/**
 * Update a stock row to show error state
 */
function updateStockRowError(ticker) {
    PERIODS.forEach(period => {
        const cell = document.getElementById(`perf-${ticker}-${period}`);
        if (cell) {
            cell.textContent = 'Error';
            cell.className = 'perf-cell error';
        }
    });
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

        // Performance cells (read-only, populated by API)
        PERIODS.forEach(period => {
            const cell = document.createElement('td');
            cell.id = `perf-${stock.ticker}-${period}`;
            cell.className = 'perf-cell';
            cell.textContent = 'Loading...';
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

/**
 * Fetch performance since a custom date
 */
async function fetchCustomDatePerformance() {
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

    const targetDate = new Date(year, month - 1, day);
    const dateDisplay = `${day} ${getMonthName(month)} ${year}`;

    // Show loading
    const container = document.getElementById('custom-dates-container');
    container.innerHTML = `<div class="custom-date-card">
        <div class="custom-date-header">
            <h3>Performance since ${dateDisplay}</h3>
        </div>
        <div class="loading-message">Fetching data...</div>
    </div>`;

    // Fetch data for each stock
    const results = [];
    for (const stock of STOCKS) {
        try {
            const perf = await fetchPerformanceSinceDate(stock.ticker, targetDate);
            results.push({ ticker: stock.ticker, company: stock.company, performance: perf });
            await sleep(300);
        } catch (error) {
            results.push({ ticker: stock.ticker, company: stock.company, performance: null, error: true });
        }
    }

    // Display results
    displayCustomDateResults(dateDisplay, results);
}

/**
 * Fetch performance since a specific date
 */
async function fetchPerformanceSinceDate(ticker, targetDate) {
    const now = new Date();
    const period1 = Math.floor(targetDate.getTime() / 1000);
    const period2 = Math.floor(now.getTime() / 1000);

    const url = `${CORS_PROXY}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
        throw new Error('No data');
    }

    const result = data.chart.result[0];
    const closes = result.indicators.quote[0].close;

    if (!closes || closes.length < 2) {
        throw new Error('Insufficient data');
    }

    // Find first valid close and last valid close
    let firstPrice = null;
    let lastPrice = null;

    for (let i = 0; i < closes.length; i++) {
        if (closes[i] !== null) {
            firstPrice = closes[i];
            break;
        }
    }

    for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] !== null) {
            lastPrice = closes[i];
            break;
        }
    }

    if (firstPrice && lastPrice) {
        return ((lastPrice - firstPrice) / firstPrice) * 100;
    }

    return null;
}

/**
 * Display custom date results
 */
function displayCustomDateResults(dateDisplay, results) {
    const container = document.getElementById('custom-dates-container');

    let tableRows = results.map(r => {
        let perfDisplay = '--';
        let perfClass = '';

        if (r.error) {
            perfDisplay = 'Error';
            perfClass = 'error';
        } else if (r.performance !== null) {
            perfDisplay = (r.performance >= 0 ? '+' : '') + r.performance.toFixed(2) + '%';
            perfClass = r.performance >= 0 ? 'positive' : 'negative';
        }

        return `<tr>
            <td class="ticker">${r.ticker}</td>
            <td class="company">${r.company}</td>
            <td class="perf-cell ${perfClass}">${perfDisplay}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="custom-date-card">
            <div class="custom-date-header">
                <h3>Performance since ${dateDisplay}</h3>
            </div>
            <table class="custom-date-table">
                <thead>
                    <tr>
                        <th>Ticker</th>
                        <th>Company</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Load data from localStorage (for caching)
 */
function loadData() {
    const savedPerformance = localStorage.getItem('defenseStocksPerformance');

    if (savedPerformance) {
        performanceData = JSON.parse(savedPerformance);
    }
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
 * Get month name from number
 */
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
