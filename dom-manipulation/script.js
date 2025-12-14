// script.js

let quotes = [];

// DOM elements
const categoryFilter = document.getElementById('categoryFilter');
const quoteContainer = document.getElementById('quoteContainer');
const newQuoteBtn = document.getElementById('newQuote');
const newQuoteText = document.getElementById('newQuoteText');
const newQuoteCategory = document.getElementById('newQuoteCategory');
const addQuoteBtn = document.getElementById('addQuoteBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const syncStatus = document.getElementById('syncStatus');
const manualSyncBtn = document.getElementById('manualSyncBtn');
const resolveLocalBtn = document.getElementById('resolveLocalBtn');

// Storage keys
const QUOTES_STORAGE_KEY = 'dynamicQuotes';
const FILTER_STORAGE_KEY = 'lastSelectedCategory';
const CONFLICT_STORAGE_KEY = 'pendingServerQuotes';

// Server simulation: using https://dummyjson.com/quotes (read-only public API)
const SERVER_URL = 'https://dummyjson.com/quotes?limit=50'; // Get 50 quotes for variety

// ---------- Web Storage ----------
function saveQuotes() {
  localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
}

function loadQuotes() {
  const stored = localStorage.getItem(QUOTES_STORAGE_KEY);
  if (stored) {
    try {
      quotes = JSON.parse(stored);
    } catch (e) {
      quotes = getDefaultQuotes();
    }
  } else {
    quotes = getDefaultQuotes();
  }
}

function saveLastFilter(category) {
  localStorage.setItem(FILTER_STORAGE_KEY, category);
}

function loadLastFilter() {
  return localStorage.getItem(FILTER_STORAGE_KEY) || 'all';
}

// Default local quotes
function getDefaultQuotes() {
  return [
    { text: "The only way to do great work is to love what you do.", category: "Motivational" },
    { text: "Life is what happens when you're busy making other plans.", category: "Life" }
  ];
}

// ---------- Category Management ----------
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort();
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
}

// ---------- Quote Display ----------
function displayQuotes(filteredQuotes) {
  quoteContainer.innerHTML = '';

  if (filteredQuotes.length === 0) {
    quoteContainer.innerHTML = '<div id="noQuotes">No quotes available for this category.</div>';
    return;
  }

  filteredQuotes.forEach(quote => {
    const card = document.createElement('div');
    card.className = 'quote-card';

    const text = document.createElement('div');
    text.className = 'quote-text';
    text.textContent = `"${quote.text}"`;
    if (quote.author) {
      text.textContent += ` — ${quote.author}`;
    }

    const category = document.createElement('div');
    category.className = 'quote-category';
    category.textContent = `Category: ${quote.category}`;

    card.appendChild(text);
    card.appendChild(category);
    quoteContainer.appendChild(card);
  });
}

function filterQuotes() {
  const selectedCategory = categoryFilter.value;
  saveLastFilter(selectedCategory);

  let filtered = quotes;
  if (selectedCategory !== 'all') {
    filtered = quotes.filter(q => q.category === selectedCategory);
  }
  displayQuotes(filtered);
}

function showRandomQuote() {
  if (quotes.length === 0) {
    quoteContainer.innerHTML = '<div id="noQuotes">No quotes available.</div>';
    return;
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  displayQuotes([quotes[randomIndex]]);
}

// ---------- Add Quote ----------
function addQuote() {
  const text = newQuoteText.value.trim();
  let category = newQuoteCategory.value.trim() || 'General';

  if (text === '') {
    alert('Please enter a quote text.');
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();

  const currentFilter = categoryFilter.value;
  if (currentFilter === 'all' || currentFilter === category) {
    filterQuotes();
  }

  newQuoteText.value = '';
  newQuoteCategory.value = '';
  setSyncStatus('Quote added locally.', 'sync-warning');
}

// ---------- Server Sync ----------
async function syncWithServer() {
  setSyncStatus('Syncing with server...', 'sync-warning');

  try {
    const response = await fetch(SERVER_URL);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();
    const serverQuotes = data.quotes.map(q => ({
      text: q.quote,
      category: 'Server', // All server quotes in one category for simplicity
      author: q.author
    }));

    // Simple merge: add any server quotes not already in local (by exact text match)
    let newAdded = 0;
    serverQuotes.forEach(sq => {
      if (!quotes.some(lq => lq.text === sq.text)) {
        quotes.push(sq);
        newAdded++;
      }
    });

    if (newAdded > 0) {
      saveQuotes();
      populateCategories();
      filterQuotes();
      setSyncStatus(`Sync complete: ${newAdded} new quote(s) added from server.`, 'sync-success');
    } else {
      setSyncStatus('Sync complete: No new quotes from server.', 'sync-success');
    }
  } catch (err) {
    setSyncStatus('Sync failed: ' + err.message, 'sync-error');
  }
}

// Simulated conflict resolution (server precedence for new quotes)
// In this read-only simulation, we only pull new quotes from server.
// For conflict demo: if server had overlapping edits, we'd overwrite, but here we just add unique.

function setSyncStatus(message, className) {
  syncStatus.textContent = message;
  syncStatus.className = className;
  setTimeout(() => {
    syncStatus.textContent = '';
    syncStatus.className = '';
  }, 8000);
}

// ---------- JSON Import/Export (Local) ----------
function exportQuotes() {
  if (quotes.length === 0) {
    alert('No quotes to export.');
    return;
  }
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-quotes.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const validQuotes = imported
        .filter(q => q && typeof q.text === 'string' && q.text.trim())
        .map(q => ({
          text: q.text.trim(),
          category: (q.category && typeof q.category === 'string') ? q.category.trim() : 'General',
          author: q.author || undefined
        }));

      if (validQuotes.length === 0) {
        alert('No valid quotes found.');
        return;
      }

      quotes.push(...validQuotes);
      saveQuotes();
      populateCategories();
      filterQuotes();
      alert(`Imported ${validQuotes.length} local quote(s)!`);
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}

// ---------- Initialization ----------
function init() {
  loadQuotes();
  populateCategories();

  const lastFilter = loadLastFilter();
  categoryFilter.value = lastFilter;
  filterQuotes();

  // Start periodic auto-sync
  syncWithServer(); // Initial sync
  setInterval(syncWithServer, 30000); // Every 30 seconds
}

// Event Listeners
categoryFilter.addEventListener('change', filterQuotes);
newQuoteBtn.addEventListener('click', showRandomQuote);
addQuoteBtn.addEventListener('click', addQuote);
manualSyncBtn.addEventListener('click', syncWithServer);
exportBtn.addEventListener('click', exportQuotes);
importFile.addEventListener('change', importFromJsonFile);

document.addEventListener('DOMContentLoaded', init);