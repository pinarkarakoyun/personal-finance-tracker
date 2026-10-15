const API = '/api';

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authMessage = document.getElementById('auth-message');
const appMessage = document.getElementById('app-message');
const userName = document.getElementById('user-name');
const categorySelect = document.getElementById('transaction-category');
const transactionList = document.getElementById('transaction-list');
const dateInput = document.getElementById('transaction-date');

const summaryMonth = document.getElementById('summary-month');
const sumIncome = document.getElementById('sum-income');
const sumExpense = document.getElementById('sum-expense');
const sumBalance = document.getElementById('sum-balance');
const chartBox = document.getElementById('chart-box');
const chartEmpty = document.getElementById('chart-empty');
const chartCanvas = document.getElementById('expense-chart');

const money = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});
const typeLabel = { Income: 'Gelir', Expense: 'Gider' };
const chartColors = [
  '#2f6fed', '#e8590c', '#2f9e44', '#9c36b5', '#f08c00',
  '#0c8599', '#c2255c', '#5c7cfa', '#868e96', '#82c91e',
];

let expenseChart = null;
const transactionForm = document.getElementById('transaction-form');
const transactionTitle = document.getElementById('transaction-form-title');
const transactionSubmit = document.getElementById('transaction-submit');
const transactionCancel = document.getElementById('transaction-cancel');

let editingId = null;
const filterQ = document.getElementById('filter-q');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterMonth = document.getElementById('filter-month');
const pagination = document.getElementById('pagination');
const pageInfo = document.getElementById('page-info');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');

const PAGE_SIZE = 10;
let currentPage = 1;
let searchTimer = null;

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Today's date in the user's LOCAL time zone, as YYYY-MM-DD.
function todayLocal() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function startEdit(tx) {
  editingId = tx.TransactionId;
  categorySelect.value = String(tx.CategoryId);
  document.getElementById('transaction-amount').value = tx.Amount;
  document.getElementById('transaction-description').value = tx.Description || '';
  dateInput.value = tx.TransactionDate;

  transactionTitle.textContent = 'İşlemi düzenle';
  transactionSubmit.textContent = 'Güncelle';
  transactionCancel.hidden = false;
  transactionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetTransactionForm() {
  editingId = null;
  transactionForm.reset();
  dateInput.value = todayLocal();

  transactionTitle.textContent = 'İşlem ekle';
  transactionSubmit.textContent = 'İşlem ekle';
  transactionCancel.hidden = true;
}

function getToken() {
  return localStorage.getItem('token');
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(API + path, { ...options, headers });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    if (response.status === 401 && token) {
      logout();
    }
    throw new Error((data && data.message) || 'Bir hata oluştu');
  }
  return data;
}

function showApp(user) {
  userName.textContent = user.FullName;
  authSection.hidden = true;
  appSection.hidden = false;
  dateInput.value = todayLocal();
  summaryMonth.value = todayLocal().slice(0, 7);
  loadData();
}

function showAuth() {
  authSection.hidden = false;
  appSection.hidden = true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    resetTransactionForm();
    filterQ.value = '';
    filterType.value = '';
    filterCategory.value = '';
    filterMonth.value = '';
    currentPage = 1;  
    showAuth();
}

async function loadData() {
  appMessage.textContent = '';
  try {
    const [categories] = await Promise.all([
      api('/categories'),
      loadTransactions(),
    ]);
    renderCategories(categories);
    await loadSummary();
  } catch (err) {
    appMessage.textContent = err.message;
  }
}

async function loadTransactions() {
  const params = new URLSearchParams({ page: currentPage, pageSize: PAGE_SIZE });

  const q = filterQ.value.trim();
  if (q) params.set('q', q);
  if (filterType.value) params.set('type', filterType.value);
  if (filterCategory.value) params.set('categoryId', filterCategory.value);
  if (filterMonth.value) params.set('month', filterMonth.value);

  const data = await api(`/transactions?${params}`);

  // Deleted the last item on the last page? Go back one page.
  if (data.items.length === 0 && data.total > 0 && currentPage > 1) {
    currentPage = data.totalPages;
    return loadTransactions();
  }

  renderTransactions(data.items);
  renderPagination(data);
}

function renderPagination({ page, totalPages, total }) {
  pagination.hidden = totalPages <= 1;
  pageInfo.textContent = `Sayfa ${page} / ${totalPages} (${total} işlem)`;
  pagePrev.disabled = page <= 1;
  pageNext.disabled = page >= totalPages;
}

async function refreshTransactions() {
  appMessage.textContent = '';
  try {
    await loadTransactions();
  } catch (err) {
    appMessage.textContent = err.message;
  }
}

async function loadSummary() {
  const month = summaryMonth.value;
  if (!month) {
    return;
  }

  const summary = await api(`/summary?month=${encodeURIComponent(month)}`);

  sumIncome.textContent = money.format(summary.totalIncome);
  sumExpense.textContent = money.format(summary.totalExpense);
  sumBalance.textContent = money.format(summary.balance);
  sumBalance.className = summary.balance >= 0 ? 'income' : 'expense';

  if (expenseChart) {
    expenseChart.destroy();
    expenseChart = null;
  }

  const expenses = summary.byCategory.filter((row) => row.type === 'Expense');
  chartBox.hidden = expenses.length === 0;
  chartEmpty.hidden = expenses.length > 0;

  if (expenses.length === 0) {
    return;
  }
  if (typeof Chart === 'undefined') {
    appMessage.textContent = 'Grafik kütüphanesi yüklenemedi (internet bağlantını kontrol et).';
    return;
  }
Chart.defaults.color = cssVar('--muted');
  expenseChart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels: expenses.map((row) => row.name),
      datasets: [
        {
          data: expenses.map((row) => row.total),
          backgroundColor: expenses.map((_, i) => chartColors[i % chartColors.length]), 
          borderColor: cssVar('--surface'),
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${money.format(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderCategories(categories) {
  categorySelect.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Kategori seç';
  placeholder.disabled = true;
  placeholder.selected = true;
  categorySelect.append(placeholder);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.CategoryId;
    option.textContent = `${category.Name} (${typeLabel[category.Type]})`;
    categorySelect.append(option);
  }

  const selected = filterCategory.value;
  filterCategory.replaceChildren(new Option('Tüm kategoriler', ''));
  for (const category of categories) {
    filterCategory.append(
      new Option(`${category.Name} (${typeLabel[category.Type]})`, category.CategoryId)
    );
  }
  filterCategory.value = selected;
}

function renderTransactions(transactions) {
  transactionList.replaceChildren();

  if (transactions.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Kayıt bulunamadı.';
    transactionList.append(empty);
    return;
  }

  for (const tx of transactions) {
    const li = document.createElement('li');
    li.className = 'tx';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = tx.Description || tx.CategoryName;
    const meta = document.createElement('small');
    meta.textContent = `${tx.TransactionDate} · ${tx.CategoryName}`;
    info.append(title, document.createElement('br'), meta);

    const isIncome = tx.Type === 'Income';
    const amount = document.createElement('span');
    amount.className = isIncome ? 'income' : 'expense';
    amount.textContent = (isIncome ? '+' : '-') + money.format(tx.Amount);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Sil';
    deleteButton.addEventListener('click', async () => {
      if (!confirm('Bu işlem silinsin mi?')) {
        return;
      }
      try {
        await api(`/transactions/${tx.TransactionId}`, { method: 'DELETE' });
        if (editingId === tx.TransactionId) {
          resetTransactionForm();
        }
        await loadData();
      } catch (err) {
        appMessage.textContent = err.message;
      }
    });

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.textContent = 'Düzenle';
    editButton.addEventListener('click', () => startEdit(tx));

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(editButton, deleteButton);

    li.append(info, amount, actions);
    transactionList.append(li);
  }
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      }),
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    event.target.reset();
    showApp(data.user);
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: document.getElementById('register-name').value,
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value,
      }),
    });
    event.target.reset();
    authMessage.textContent = 'Kayıt başarılı, şimdi giriş yapabilirsin.';
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

document.getElementById('category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  appMessage.textContent = '';

  try {
    await api('/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('category-name').value,
        type: document.getElementById('category-type').value,
      }),
    });
    event.target.reset();
    await loadData();
  } catch (err) {
    appMessage.textContent = err.message;
  }
});

transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  appMessage.textContent = '';

  const payload = {
    categoryId: Number(categorySelect.value),
    amount: Number(document.getElementById('transaction-amount').value),
    description: document.getElementById('transaction-description').value,
    date: dateInput.value,
  };

  try {
    if (editingId === null) {
      await api('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/transactions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }
    resetTransactionForm();
    await loadData();
  } catch (err) {
    appMessage.textContent = err.message;
  }
});

transactionCancel.addEventListener('click', resetTransactionForm);

summaryMonth.addEventListener('change', async () => {
  appMessage.textContent = '';
  try {
    await loadSummary();
  } catch (err) {
    appMessage.textContent = err.message;
  }
});

async function applyFilters() {
  currentPage = 1;
  await refreshTransactions();
}

filterQ.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 300);
});

for (const element of [filterType, filterCategory, filterMonth]) {
  element.addEventListener('change', applyFilters);
}

document.getElementById('filter-clear').addEventListener('click', () => {
  filterQ.value = '';
  filterType.value = '';
  filterCategory.value = '';
  filterMonth.value = '';
  applyFilters();
});

pagePrev.addEventListener('click', () => {
  currentPage -= 1;
  refreshTransactions();
});

pageNext.addEventListener('click', () => {
  currentPage += 1;
  refreshTransactions();
});

document.getElementById('logout-button').addEventListener('click', logout);

const savedUser = localStorage.getItem('user');
if (getToken() && savedUser) {
  showApp(JSON.parse(savedUser));
} else {
  showAuth();
}