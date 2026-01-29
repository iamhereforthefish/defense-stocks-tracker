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

// Multiple CORS proxies for redundancy
const CORS_PROXIES = [
    { url: 'https://api.allorigins.win/raw?url=', wrapped: false },
    { url: 'https://api.allorigins.win/get?url=', wrapped: true },
    { url: 'https://corsproxy.io/?', wrapped: false }
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
 * Makes multiple requests for different time periods since large ranges fail via proxy
 */
async function fetchStockPerformance(ticker) {
    try {
        const performance = {};

        // Fetch 1 month data for 1d, 1w, and partial 3m
        const data1m = await fetchYahooData(ticker, '1mo');
        if (!data1m) {
            updateStockRowError(ticker);
            return;
        }

        const { timestamps: ts1m, closes: cl1m } = data1m;
        const currentPrice = cl1m[cl1m.length - 1];

        // Calculate 1d performance
        if (cl1m.length >= 2) {
            const prevClose = cl1m[cl1m.length - 2];
            performance['1d'] = ((currentPrice - prevClose) / prevClose) * 100;
        }

        // Calculate 1w performance (5 trading days back)
        if (cl1m.length >= 6) {
            const weekAgoPrice = cl1m[cl1m.length - 6];
            performance['1w'] = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;
        }

        // For 3m, 12m, and YTD - fetch using period parameters
        const now = Math.floor(Date.now() / 1000);

        // 3 month
        const threeMonthsAgo = now - (90 * 24 * 60 * 60);
        const data3m = await fetchYahooDataByPeriod(ticker, threeMonthsAgo, now);
        if (data3m && data3m.closes.length > 0) {
            const firstPrice = data3m.closes.find(p => p !== null);
            if (firstPrice) {
                performance['3m'] = ((currentPrice - firstPrice) / firstPrice) * 100;
            }
        }

        // 12 month
        const oneYearAgo = now - (365 * 24 * 60 * 60);
        const data12m = await fetchYahooDataByPeriod(ticker, oneYearAgo, now);
        if (data12m && data12m.closes.length > 0) {
            const firstPrice = data12m.closes.find(p => p !== null);
            if (firstPrice) {
                performance['12m'] = ((currentPrice - firstPrice) / firstPrice) * 100;
            }
        }

        // YTD
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const ytdStart = Math.floor(startOfYear.getTime() / 1000);
        const dataYtd = await fetchYahooDataByPeriod(ticker, ytdStart, now);
        if (dataYtd && dataYtd.closes.length > 0) {
            const firstPrice = dataYtd.closes.find(p => p !== null);
            if (firstPrice) {
                performance['ytd'] = ((currentPrice - firstPrice) / firstPrice) * 100;
            }
        }

        // Update the UI
        updateStockRow(ticker, performance);

        // Store data
        performanceData[ticker] = performance;

    } catch (error) {
        console.error(`Failed to fetch ${ticker}:`, error);
        updateStockRowError(ticker);
    }
}

/**
 * Fetch Yahoo Finance data with range parameter - tries multiple proxies
 */
async function fetchYahooData(ticker, range) {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;

    for (const proxy of CORS_PROXIES) {
        try {
            const url = `${proxy.url}${encodeURIComponent(yahooUrl)}`;
            const response = await fetch(url);

            if (!response.ok) continue;

            let data;
            if (proxy.wrapped) {
                const wrapper = await response.json();
                data = JSON.parse(wrapper.contents);
            } else {
                data = await response.json();
            }

            if (!data.chart?.result?.[0]) continue;

            const result = data.chart.result[0];
            return {
                timestamps: result.timestamp || [],
                closes: result.indicators.quote[0].close || []
            };
        } catch (error) {
            console.log(`Proxy ${proxy.url} failed for ${ticker}, trying next...`);
            continue;
        }
    }

    console.error(`All proxies failed for ${ticker}`);
    return null;
}

/**
 * Fetch Yahoo Finance data with period1/period2 parameters - tries multiple proxies
 */
async function fetchYahooDataByPeriod(ticker, period1, period2) {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1wk`;

    for (const proxy of CORS_PROXIES) {
        try {
            const url = `${proxy.url}${encodeURIComponent(yahooUrl)}`;
            const response = await fetch(url);

            if (!response.ok) continue;

            let data;
            if (proxy.wrapped) {
                const wrapper = await response.json();
                data = JSON.parse(wrapper.contents);
            } else {
                data = await response.json();
            }

            if (!data.chart?.result?.[0]) continue;

            const result = data.chart.result[0];
            return {
                timestamps: result.timestamp || [],
                closes: result.indicators.quote[0].close || []
            };
        } catch (error) {
            console.log(`Proxy ${proxy.url} failed for ${ticker} period query, trying next...`);
            continue;
        }
    }

    console.error(`All proxies failed for ${ticker} period query`);
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

    const data = await fetchYahooDataByPeriod(ticker, period1, period2);

    if (!data || !data.closes || data.closes.length < 1) {
        throw new Error('No data');
    }

    // Find first valid close and last valid close
    let firstPrice = null;
    let lastPrice = null;

    for (let i = 0; i < data.closes.length; i++) {
        if (data.closes[i] !== null) {
            firstPrice = data.closes[i];
            break;
        }
    }

    for (let i = data.closes.length - 1; i >= 0; i--) {
        if (data.closes[i] !== null) {
            lastPrice = data.closes[i];
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
