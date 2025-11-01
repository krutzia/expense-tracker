// Expense Tracker with charts (dark only)
// Requirements: Chart.js loaded via CDN (index.html)

// DOM
const form = document.getElementById('form');
const textEl = document.getElementById('text');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const categoryEl = document.getElementById('category');
const dateEl = document.getElementById('date');
const listEl = document.getElementById('list');

const searchText = document.getElementById('searchText');
const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const resetFilters = document.getElementById('resetFilters');
const clearAllBtn = document.getElementById('clearAll');

const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');
const txCountEl = document.getElementById('txCount');
const catCountEl = document.getElementById('catCount');
const summaryEl = document.getElementById('summary');

const pieCtx = document.getElementById('pieChart').getContext('2d');
const barCtx = document.getElementById('barChart').getContext('2d');

const STORAGE_KEY = 'expenses_v3';
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// Chart instances
let pieChart = null;
let barChart = null;

// Utility
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const formatDate = iso => {
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString();
};

// Add transaction
form.addEventListener('submit', e => {
  e.preventDefault();
  if(!textEl.value.trim() || !amountEl.value || !dateEl.value) {
    alert('Please fill description, amount and date.');
    return;
  }

  let amt = parseFloat(amountEl.value);
  if(typeEl.value === 'expense') amt = -Math.abs(amt);
  else amt = Math.abs(amt);

  const tx = {
    id: uid(),
    text: textEl.value.trim(),
    amount: Math.round(amt * 100) / 100,
    category: categoryEl.value,
    date: dateEl.value
  };

  transactions.unshift(tx);
  saveAndRefresh();
  form.reset();
});

// Save
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// Remove
function removeTx(id){
  transactions = transactions.filter(t => t.id !== id);
  saveAndRefresh();
}

// Clear all
clearAllBtn.addEventListener('click', () => {
  if(!confirm('Clear all transactions?')) return;
  transactions = [];
  saveAndRefresh();
});

// Filters bindings
[searchText, filterType, filterCategory, fromDate, toDate].forEach(el => {
  el && el.addEventListener('input', applyFilters);
});
resetFilters.addEventListener('click', () => {
  searchText.value = '';
  filterType.value = 'all';
  filterCategory.value = 'all';
  fromDate.value = '';
  toDate.value = '';
  applyFilters();
});

// Apply filters and render
function applyFilters(){
  let filtered = [...transactions];

  const q = (searchText.value || '').toLowerCase();
  if(q) filtered = filtered.filter(t => t.text.toLowerCase().includes(q));

  const ft = filterType.value;
  if(ft === 'income') filtered = filtered.filter(t => t.amount > 0);
  if(ft === 'expense') filtered = filtered.filter(t => t.amount < 0);

  const fc = filterCategory.value;
  if(fc && fc !== 'all') filtered = filtered.filter(t => t.category === fc);

  if(fromDate.value) filtered = filtered.filter(t => t.date >= fromDate.value);
  if(toDate.value) filtered = filtered.filter(t => t.date <= toDate.value);

  renderList(filtered);
  updateSummary(filtered);
  updateCharts(filtered);
}

// Render transaction list
function renderList(list){
  listEl.innerHTML = '';
  if(list.length === 0){
    const li = document.createElement('li');
    li.className = 'tx-item muted';
    li.textContent = 'No transactions';
    listEl.appendChild(li);
    return;
  }

  list.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'tx-item ' + (tx.amount < 0 ? 'minus' : 'plus');

    li.innerHTML = `
      <div class="left">
        <strong>${tx.text}</strong>
        <div class="meta">${tx.category} • ${formatDate(tx.date)}</div>
      </div>
      <div class="right">
        <div><strong>${tx.amount < 0 ? '-' : '+'}₹${Math.abs(tx.amount).toFixed(2)}</strong></div>
        <div class="meta">
          <button onclick="removeTx('${tx.id}')">Delete</button>
        </div>
      </div>
    `;
    listEl.appendChild(li);
  });
}

// Update numeric summary
function updateSummary(filtered){
  const amounts = filtered.map(t => t.amount);
  const total = (amounts.reduce((a,b) => a + b, 0) || 0).toFixed(2);
  const inc = (amounts.filter(a=>a>0).reduce((a,b)=>a+b,0) || 0).toFixed(2);
  const exp = (Math.abs(amounts.filter(a=>a<0).reduce((a,b)=>a+b,0)) || 0).toFixed(2);

  balanceEl.textContent = `₹${total}`;
  incomeEl.textContent = `₹${inc}`;
  expenseEl.textContent = `₹${exp}`;
  txCountEl.textContent = filtered.length;
  const categories = new Set(filtered.map(t=>t.category));
  catCountEl.textContent = categories.size;
  summaryEl.textContent = `${transactions.length} total • showing ${filtered.length}`;
}

// Charts helpers
function getCategoryExpenseTotals(data){
  const totals = {};
  data.filter(t=>t.amount<0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });
  return totals;
}

function getMonthlyTotals(data, months = 6){
  // produce last `months` month labels (YYYY-MM)
  const now = new Date();
  const arr = [];
  for(let i = months-1; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const label = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    arr.push({ key, label, income:0, expense:0 });
  }

  data.forEach(t => {
    const key = t.date.slice(0,7);
    const idx = arr.findIndex(x => x.key === key);
    if(idx !== -1){
      if(t.amount > 0) arr[idx].income += t.amount;
      else arr[idx].expense += Math.abs(t.amount);
    }
  });

  return arr;
}

// Update Chart.js charts
function updateCharts(filtered){
  // Pie chart: category expense breakdown
  const catTotals = getCategoryExpenseTotals(filtered);
  const pieLabels = Object.keys(catTotals);
  const pieData = pieLabels.map(l => +catTotals[l].toFixed(2));

  // If no expense data, show placeholder small slice to avoid errors
  const pieConfig = {
    type: 'pie',
    data: {
      labels: pieLabels.length ? pieLabels : ['No expenses'],
      datasets: [{
        data: pieData.length ? pieData : [1],
        backgroundColor: generateColors(pieLabels.length || 1),
        borderWidth: 0
      }]
    },
    options: {
      plugins:{legend:{position:'bottom',labels:{color:'#cfd8e3'}}}
    }
  };

  if(pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, pieConfig);

  // Bar chart: monthly income vs expense (last 6 months)
  const months = getMonthlyTotals(transactions, 6);
  const barLabels = months.map(m => m.label);
  const barIncome = months.map(m => +(m.income.toFixed(2)));
  const barExpense = months.map(m => +(m.expense.toFixed(2)));

  const barConfig = {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [
        { label:'Income', data: barIncome, backgroundColor: 'rgba(76, 217, 100, 0.9)' },
        { label:'Expense', data: barExpense, backgroundColor: 'rgba(255, 99, 132, 0.9)' }
      ]
    },
    options: {
      scales:{
        x:{ stacked: false, ticks:{color:'#cfd8e3'} },
        y:{ ticks:{color:'#cfd8e3'} }
      },
      plugins:{legend:{position:'bottom',labels:{color:'#cfd8e3'}}}
    }
  };

  if(barChart) barChart.destroy();
  barChart = new Chart(barCtx, barConfig);
}

// small palette generator
function generateColors(n){
  const base = ['#7c5cff','#5aa3ff','#4ade80','#ffb86b','#ff6b6b','#a78bfa','#60a5fa','#f472b6'];
  const out = [];
  for(let i=0;i<n;i++) out.push(base[i % base.length]);
  return out;
}

// Render full UI (default: apply filters which updates list, summary, charts)
function saveAndRefresh(){
  save();
  applyFilters();
}

// Initial render on load
function init(){
  applyFilters();
}
init();

// Expose removeTx to window for inline onclick buttons
window.removeTx = removeTx;




