/**
 * Main Application Logic
 */

// Toast Helper
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const className = type === 'error' ? 'toast error' : 'toast success';

    // Icons
    const icon = type === 'error' ? '❌' : '✅';

    toast.className = className;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let SETTINGS = {};

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    console.log('App Initialized');

    // Check if we are on a page that needs data
    if (document.getElementById('currentMonth')) {
        loadDashboard();
    }

    if (document.getElementById('transactionsList')) {
        loadTransactions();
    }

    if (document.getElementById('goalsList')) {
        loadMetas();
    }

    if (document.getElementById('securityForm')) {
        loadSecuritySettings();
    }

    if (document.getElementById('namesForm')) {
        loadNamesSettings();
    }

    // Always load settings to get names for other pages
    loadSettingsGlobal();
}

async function loadSettingsGlobal() {
    const result = await api.request('getSettings');
    if (result.success) {
        SETTINGS = result.data;
        // If we are on transaction page, update dropdown options
        updateTransactionUserOptions();
    }
}

function getUserName(userId) {
    if (userId === 'user1') return SETTINGS['user1_name'] || 'Pessoa 1';
    if (userId === 'user2') return SETTINGS['user2_name'] || 'Pessoa 2';
    if (userId === 'shared') return 'Ambos';
    return userId; // Fallback
}

function updateTransactionUserOptions() {
    const select = document.querySelector('select[name="user"]');
    if (select) {
        // Update options text but keep values
        for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.value === 'user1') opt.text = getUserName('user1');
            if (opt.value === 'user2') opt.text = getUserName('user2');
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const pinInput = document.getElementById('loginPin');
    const enteredPin = pinInput.value;
    const errorMsg = document.getElementById('loginError');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (enteredPin.length !== 4) {
        showToast('O PIN deve ter 4 dígitos.', 'error');
        return;
    }

    setLoading(submitBtn, true, 'Verificando...');
    errorMsg.style.display = 'none';

    // 1. Get settings from backend to check correct PIN
    // Uses global loadSettings mechanism or request directly.
    const result = await api.request('getSettings');

    setLoading(submitBtn, false, 'Entrar');

    if (result.success) {
        SETTINGS = result.data; // Update global
        const storedPin = SETTINGS['access_pin'];

        // If no PIN is set, allow access (fallback for first run)
        // Or if PIN matches
        if (!storedPin || String(storedPin) === String(enteredPin)) {
            window.location.href = 'dashboard.html';
        } else {
            errorMsg.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
        }
    } else {
        showToast('Erro ao verificar configurações: ' + (result.error || 'Erro de conexão'), 'error');
    }
}

async function handleSecuritySubmit(event) {
    event.preventDefault();
    const form = event.target;
    const pin = form.querySelector('input[name="access_pin"]').value;

    if (pin.length !== 4) {
        showToast('O PIN deve ter 4 dígitos.', 'error');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setLoading(submitBtn, true, 'Salvando...');

    // We need to fetch existing settings first to merge, or use a specific update endpoint.
    // Our 'saveSettings' implementation in GAS takes { settings: { ... } } and merges keys.
    // So we can just send the new PIN.

    // Note: In a real app we would hash this. Here we store plain text for simplicity as per GAS constraints.
    const result = await api.request('saveSettings', {
        settings: { access_pin: pin }
    });

    setLoading(submitBtn, false, 'Salvar PIN');

    if (result.success) {
        showToast('PIN de segurança salvo com sucesso!');
        form.reset();
        // Update global settings
        SETTINGS['access_pin'] = pin;
    } else {
        showToast('Erro ao salvar: ' + result.error, 'error');
    }
}

async function handleNamesSubmit(event) {
    event.preventDefault();
    const form = event.target;
    // const formData = new FormData(form); // API logic uses manual object
    const user1 = form.querySelector('input[name="user1_name"]').value;
    const user2 = form.querySelector('input[name="user2_name"]').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    setLoading(submitBtn, true, 'Salvando...');

    const result = await api.request('saveSettings', {
        settings: {
            user1_name: user1,
            user2_name: user2
        }
    });

    setLoading(submitBtn, false, 'Salvar Nomes');

    if (result.success) {
        showToast('Nomes salvos com sucesso!');
        SETTINGS['user1_name'] = user1;
        SETTINGS['user2_name'] = user2;
    } else {
        showToast('Erro ao salvar: ' + result.error, 'error');
    }
}

async function loadNamesSettings() {
    const result = await api.request('getSettings'); // Or use global SETTINGS if already loaded, but safe to fetch
    if (result.success) {
        const data = result.data;
        if (data['user1_name']) document.querySelector('input[name="user1_name"]').value = data['user1_name'];
        if (data['user2_name']) document.querySelector('input[name="user2_name"]').value = data['user2_name'];
    }
}

async function loadSecuritySettings() {
    // Optional: Check if PIN is already set to show "PIN Configurado" placeholder?
    // For specific security reasons, maybe we don't show the old PIN.
    const result = await api.request('getSettings');
    if (result.success && result.data['access_pin']) {
        const input = document.querySelector('input[name="access_pin"]');
        if (input) input.placeholder = "PIN já definido (****)";
    }
}

async function loadMetas() {
    const list = document.getElementById('goalsList');
    if (!list) return;

    list.innerHTML = '<p class="text-center">Carregando metas...</p>';

    const result = await api.request('listMetas');

    if (result.success && result.data && result.data.length > 0) {
        list.style.display = 'grid';
        list.innerHTML = result.data.map(meta => {
            const percent = Math.min(100, Math.round((meta.current / meta.target) * 100));
            return `
            <div class="card">
                <div class="flex justify-between items-center" style="margin-bottom: var(--spacing-md);">
                    <h3 style="font-weight: 600; font-size: 1.2rem;">${meta.name}</h3>
                    <button class="btn-outline" style="padding: 2px 6px; font-size: 0.7rem;" onclick="updateMetaPrompt('${meta.id}', '${meta.current}')">Atualizar</button>
                </div>
                <p class="text-muted" style="margin-bottom: var(--spacing-sm);">Alvo: ${formatCurrency(meta.target)}</p>
                <div class="flex justify-between items-center">
                    <span style="font-weight: 700; font-size: 1.5rem;">${formatCurrency(meta.current)}</span>
                    <span style="font-weight: 600; color: var(--color-green-soft);">${percent}%</span>
                </div>
                <div class="progress-bar-bg" style="width: 100%; height: 12px; background-color: #eee; border-radius: 6px; overflow: hidden; margin-top: 8px;">
                    <div class="progress-bar-fill" style="width: ${percent}%; height: 100%; background-color: var(--color-green-soft);"></div>
                </div>
            </div>`;
        }).join('');
    } else {
        list.style.display = 'block';
        list.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <p class="text-muted">Nenhuma meta cadastrada ainda.</p>
            </div>`;
    }
}

async function handleMetaSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        target: formData.get('target'),
        current: formData.get('current')
    };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    setLoading(submitBtn, true, 'Salvando...');

    const result = await api.request('addMeta', data);

    setLoading(submitBtn, false, originalText);

    if (result.success) {
        showToast('Meta criada com sucesso!');
        closeModal('metaModal');
        event.target.reset();
        loadMetas();
    } else {
        showToast('Erro: ' + result.error, 'error');
    }
}

async function updateMetaPrompt(id, currentVal) {
    const newVal = prompt("Novo valor atual:", currentVal);
    if (newVal !== null) {
        const result = await api.request('updateMeta', { id: id, current: newVal });
        if (result.success) {
            loadMetas();
        } else {
            showToast('Erro ao atualizar', 'error');
        }
    }
}

async function loadDashboard() {
    const result = await api.request('getDashboardData');
    if (result.success) {
        console.log('Dashboard data loaded', result.data);

        // Update DOM
        updateElement('valReceitas', result.data.income);
        updateElement('valDespesas', result.data.expense);
        updateElement('valSaldo', result.data.balance);

        // Update Splits & Chart
        updateExpenseSplit(result.data.userSplit);
    }
}

function updateExpenseSplit(userSplit) {
    if (!userSplit) return;

    // Convert list to object for easier access if it came as array or map
    // Backend `userSplit` is Array of {name: 'user1', value: 300}

    // SORT userSplit: user1, user2, shared, others
    userSplit.sort((a, b) => {
        const order = { 'user1': 1, 'user2': 2, 'shared': 3 };
        return (order[a.name] || 99) - (order[b.name] || 99);
    });

    const splitList = document.getElementById('splitList');
    const chart = document.querySelector('.donut-chart');
    const chartLabel = document.querySelector('.donut-center span');

    if (!splitList) return;
    splitList.innerHTML = ''; // Clear loading

    let total = 0;
    const colors = ['#6246ea', '#e45858', '#2b2c34', '#ffb703', '#2cb67d'];
    // user1: primary (purple), user2: secondary (red/pink), shared: dark or other

    const mappedData = userSplit.map((item, index) => {
        total += item.value;
        return {
            ...item,
            displayName: getUserName(item.name),
            color: colors[index % colors.length]
        };
    });

    if (total === 0) {
        if (chart) chart.style.background = '#eee';
        if (chartLabel) chartLabel.textContent = 'Sem dados';
        splitList.innerHTML = '<li class="text-center text-muted">Nenhum dado encontrado.</li>';
        return;
    }

    // Render List
    splitList.innerHTML = mappedData.map(item => `
        <li class="flex justify-between items-center">
            <div style="display: flex; align-items: center;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${item.color}; margin-right: 8px;"></span>
                <span>${item.displayName}</span>
            </div>
            <span class="text-bold">${formatCurrency(item.value)}</span>
        </li>
    `).join('');

    // Render Chart (Conic Gradient)
    // Example: conic-gradient(red 0% 30%, blue 30% 70%, green 70% 100%)
    let gradientStr = '';
    let currentDeg = 0;
    mappedData.forEach((item, index) => {
        const percent = (item.value / total) * 100;
        gradientStr += `${item.color} 0 ${percent}%`;
        if (index < mappedData.length - 1) gradientStr += ', ';
    });

    // CSS Conic Gradient syntax is tricky for multi-stops without cumulative.
    // Correct syntax: color start% end%, color next_start% next_end%
    // Let's create cumulative percentages.

    let chartGradient = [];
    let cumulativePercent = 0;
    mappedData.forEach(item => {
        const percent = (item.value / total) * 100;
        const start = cumulativePercent;
        const end = cumulativePercent + percent;
        chartGradient.push(`${item.color} ${start}% ${end}%`);
        cumulativePercent += percent;
    });

    if (chart) {
        chart.style.background = `conic-gradient(${chartGradient.join(', ')})`;
    }

    if (chartLabel) {
        chartLabel.textContent = 'Total\n' + formatCurrency(total);
        chartLabel.style.whiteSpace = 'pre-wrap';
        chartLabel.style.textAlign = 'center';
        chartLabel.style.fontSize = '0.7rem';
        chartLabel.style.fontWeight = '600';
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = formatCurrency(value);
        // Optional: Add color class for balance if needed, but basic color is already in HTML
    }
}

async function loadTransactions() {
    const tbody = document.getElementById('transactionsList');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px;">Carregando transações...</td></tr>';
    }

    const result = await api.request('listTransacoes');
    if (result.success) {
        renderTransactions(result.data);
    } else {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Erro ao carregar transações.</td></tr>';
    }
}

function renderTransactions(transactions) {
    const tbody = document.getElementById('transactionsList');
    if (!tbody) return;

    tbody.innerHTML = transactions.map(tx => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 16px;">${formatDate(tx.date)}</td>
            <td style="padding: 16px;">${tx.description}</td>
            <td style="padding: 16px;"><span style="background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${tx.category}</span></td>
            <td style="padding: 16px;">${getUserName(tx.user)}</td>
            <td style="padding: 16px; text-align: right; color: ${tx.type === 'expense' ? 'var(--color-danger)' : 'var(--color-success)'}; font-weight: 600;">
                ${tx.type === 'expense' ? '-' : '+'} ${formatCurrency(tx.amount)}
            </td>
            <td style="padding: 16px; text-align: center;">
                <button class="btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: var(--color-danger); border-color: var(--color-danger);" onclick="deleteTransaction('${tx.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    // Convert FormData to object
    const formData = new FormData(event.target);
    const data = {
        type: formData.get('type'),
        amount: formData.get('amount'), // Backend expects string/number
        description: formData.get('description'),
        category: formData.get('category'),
        date: new Date().toISOString().split('T')[0], // Default to today if not specified
        user: 'Pessoa 1' // TODO: Get from settings
    };

    // Add date field if it exists in form (it was missing in html but good to have)
    // For now we hardcode date to today in the form or add input

    // Improved form data gathering
    const form = event.target;
    data.amount = form.querySelector('input[type="number"]').value;
    data.description = form.querySelector('input[type="text"]').value;
    data.category = form.querySelector('select[name="category"]').value;
    data.user = form.querySelector('select[name="user"]').value; // New user field
    data.type = form.querySelector('input[name="type"]:checked').value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    setLoading(submitBtn, true, 'Salvando...');

    const result = await api.request('addTransacao', data);

    setLoading(submitBtn, false, originalText);

    if (result.success) {
        showToast('Transação adicionada com sucesso!');
        closeModal('transactionModal');
        form.reset();
        loadTransactions(); // Reload list
        // Also reload dashboard if we were there? No we are on transactions page.
    } else {
        showToast('Erro ao adicionar: ' + result.error, 'error');
    }
}

async function deleteTransaction(id, btnElement) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    // We can't easily pass the button element from the onclick string specificially without changing the HTML generation
    // So we will just show a global loading or look for the button.
    // Actually, let's just assume we make the UI update optimistically or use a simple alert for now as per plan?
    // Plan said verify visual feedback.
    // Let's reload list immediately with a visual indicator?

    // Better: Helper can find button if we passed `this` in HTML.
    // But changing HTML generation is cleaner. 
    // For now, let's just do `api.request` and reload.
    // Or we can manipulate the DOM to remove the row immediately (optimistic UI).

    // Optimistic UI approach:
    const row = document.querySelector(`button[onclick="deleteTransaction('${id}')"]`).closest('tr');
    if (row) row.style.opacity = '0.5';

    const result = await api.request('deleteTransacao', { id: id });
    if (result.success) {
        loadTransactions();
    } else {
        if (row) row.style.opacity = '1';
        showToast('Erro ao excluir: ' + (result.error || 'Erro desconhecido'), 'error');
    }
}

// Utils
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    // Create date from value. Handles ISO strings from API
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Fallback

    // Adjust for timezone offset if necessary or use UTC
    // Simple formatting:
    return date.toLocaleDateString('pt-BR');
}

function setLoading(btn, isLoading, text) {
    if (isLoading) {
        btn.classList.add('btn-loading'); // Use spinner style
        // btn.textContent = text; // CSS hides text, so we just show spinner.
        // If we want text "Salvando...", we should NOT use .btn-loading style that hides text.
        // Let's use the spinner style as it looks premium (consistent with "WOW" factor).
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}
