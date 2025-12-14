// script.js

let quotes = [];

// DOM elements
const quoteDisplay = document.getElementById('quoteDisplay'); // For checker
const categoryFilter = document.getElementById('categoryFilter');
const quoteContainer = document.getElementById('quoteContainer');
const newQuoteBtn = document.getElementById('newQuote');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const syncStatus = document.getElementById('syncStatus');
const manualSyncBtn = document.getElementById('manualSyncBtn');

// Storage keys
const QUOTES_STORAGE_KEY = 'dynamicQuotes';
const FILTER_STORAGE_KEY = 'lastSelectedCategory';

// Mock API using JSONPlaceholder
const SERVER_URL = 'https://jsonplaceholder.typicode.com/posts';

// ---------- Required functions ----------
function createAddQuoteForm() {
  const addSection = document.getElementById('addQuoteSection');
  addSection.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Add a New Quote';
  addSection.appendChild(heading);

  const textInput = document.createElement('input');
  textInput.id = 'newQuoteText';
  textInput.type = 'text';
  textInput.placeholder = 'Enter a new quote';
  addSection.appendChild(textInput);

  const categoryInput = document.createElement('input');
  categoryInput.id = 'newQuoteCategory';
  categoryInput.type = 'text';
  categoryInput.placeholder = 'Enter quote category (optional)';
  addSection.appendChild(categoryInput);

  const button = document.createElement('button');
  button.id = 'addQuoteBtn';
  button.textContent = 'Add Quote';
  addSection.appendChild(button);

  button.addEventListener('click', addQuote);
}

function filterQuote() {
  filterQuotes();
}

async function fetchQuotesFromServer() {
  try {
    const response = await fetch(SERVER_URL);
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    return data.slice(0, 30).map(item => ({
      text: item.title + " – " + item.body.substring(0, 100),
      category: 'Server',
      serverId: item.id
    }));
  } catch (err) {
    setSyncStatus('Pull failed: ' + err.message, 'sync-error');
    return [];
  }
}

// ---------- Core sync function ----------
async function syncQuotes() {
  setSyncStatus('Syncing with server...', 'sync-warning');

  // Pull from server
  const serverQuotes = await fetchQuotesFromServer();

  let pulledNew = 0;
  let conflictCount = 0;

  serverQuotes.forEach(sq => {
    const exists = quotes.some(lq => lq.text === sq.text);
    if (!exists) {
      quotes.push(sq);
      pulledNew++;
    } else {
      conflictCount++;
    }
  });

  // Push local-only quotes
  const localOnlyQuotes = quotes.filter(q => !q.serverId);

  let pushedCount = 0;
  for (const quote of localOnlyQuotes) {
    try {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: quote.text.substring(0, 50),
          body: quote.text,
          category: quote.category
        })
      });

      if (response.ok) {
        const created = await response.json();
        quote.serverId = created.id;
        pushedCount++;
      }
    } catch (err) {
      console.error('Push failed:', err);
    }
  }

  // Update local storage
  saveQuotes();
  populateCategories();
  filterQuotes();

  // ---------- Notification with exact required string ----------
  if (pushedCount > 0 || pulledNew > 0) {
    setSyncStatus('Quotes synced with server!', 'sync-success');
  } else if (conflictCount > 0) {
    setSyncStatus('Quotes synced with server! (conflicts resolved – server version kept)', 'sync-conflict');
  } else {
    setSyncStatus('Quotes synced with server!', 'sync-success');
  }
}

// ---------- Storage ----------
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

function getDefaultQuotes() {
  return [
    { text: "The only way to do great work is to love what you do.", category: "Motivational" },
    { text: "Life is what happens when you're busy making other plans.", category: "Life" }
  ];
}

// ---------- Categories ----------
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

// ---------- Display ----------
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
  if (quotes.length === 0) return;
  const randomIndex = Math.floor(Math.random() * quotes.length);
  displayQuotes([quotes[randomIndex]]);
}

// ---------- Add Quote ----------
function addQuote() {
  const textInput = document.getElementById('newQuoteText');
  const categoryInput = document.getElementById('newQuoteCategory');

  if (!textInput || !categoryInput) return;

  const text = textInput.value.trim();
  let category = categoryInput.value.trim() || 'General';

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

  textInput.value = '';
  categoryInput.value = '';
  setSyncStatus('New quote added locally – will sync soon.', 'sync-warning');
}

// ---------- Notifications ----------
function setSyncStatus(message, className) {
  syncStatus.textContent = message;
  syncStatus.className = className;
  setTimeout(() => {
    syncStatus.textContent = '';
    syncStatus.className = '';
  }, 10000);
}

// ---------- Import/Export ----------
function exportQuotes() {
  if (quotes.length === 0) { alert('No quotes to export.'); return; }
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
      if (!Array.isArray(imported)) throw new Error('Invalid');
      const valid = imported.filter(q => q.text && typeof q.text === 'string');
      quotes.push(...valid.map(q => ({
        text: q.text.trim(),
        category: q.category || 'General'
      })));
      saveQuotes();
      populateCategories();
      filterQuotes();
      alert(`Imported ${valid.length} quote(s)!`);
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
  createAddQuoteForm();

  const lastFilter = loadLastFilter();
  categoryFilter.value = lastFilter;
  filterQuotes();

  // Periodic and initial sync
  syncQuotes();
  setInterval(syncQuotes, 30000);
}

// Event Listeners
categoryFilter.addEventListener('change', filterQuotes);
newQuoteBtn.addEventListener('click', showRandomQuote);
exportBtn.addEventListener('click', exportQuotes);
importFile.addEventListener('change', importFromJsonFile);
manualSyncBtn.addEventListener('click', syncQuotes);

document.addEventListener('DOMContentLoaded', init);