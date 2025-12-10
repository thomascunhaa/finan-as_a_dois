/**
 * Gestão Financeira para Casais - Backend (Google Apps Script)
 */

function doGet(e) {
  return ContentService.createTextOutput("O Backend está funcionando corretamente! (Método GET recebido)");
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = JSON.parse(e.postData.contents);
    const method = params.method;
    let result;

    switch (method) {
      case 'addTransacao':
        result = addTransacao(params);
        break;
      case 'deleteTransacao':
        result = deleteTransacao(params.id);
        break;
      case 'listTransacoes':
        result = listTransacoes();
        break;
      case 'addMeta':
        result = addMeta(params);
        break;
      case 'listMetas':
        result = listMetas();
        break;
      case 'updateMeta':
        result = updateMeta(params);
        break;
      case 'getDashboardData':
        result = getDashboardData();
        break;
      case 'saveSettings':
        result = saveSettings(params);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'resetData':
         result = resetData();
         break;
      default:
        result = { success: false, error: 'Método desconhecido' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Helpers
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'transacoes') {
      sheet.appendRow(['ID', 'Data', 'Descrição', 'Categoria', 'Valor', 'Tipo', 'Usuário', 'Timestamp']);
    } else if (name === 'metas') {
      sheet.appendRow(['ID', 'Nome', 'Alvo', 'Atual', 'Status', 'Timestamp']);
    } else if (name === 'config') {
      sheet.appendRow(['Key', 'Value', 'Timestamp']);
    }
  }
  return sheet;
}

// --- Transações ---

function addTransacao(data) {
  const sheet = getSheet('transacoes');
  const id = new Date().getTime().toString();
  const timestamp = new Date();
  
  sheet.appendRow([
    id,
    data.date,
    data.description,
    data.category,
    data.amount,
    data.type,
    data.user,
    timestamp
  ]);
  
  return { success: true, id: id };
}

function deleteTransacao(id) {
  const sheet = getSheet('transacoes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Transação não encontrada' };
}

function listTransacoes() {
  const sheet = getSheet('transacoes');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); 
  
  const transactions = data.map(row => ({
    id: row[0],
    date: row[1],
    description: row[2],
    category: row[3],
    amount: row[4],
    type: row[5],
    user: row[6]
  })).reverse(); 
  
  return { success: true, data: transactions };
}

// --- Metas ---

function addMeta(data) {
  const sheet = getSheet('metas');
  const id = new Date().getTime().toString();
  const timestamp = new Date();
  
  sheet.appendRow([
    id,
    data.name,
    data.target,
    data.current || 0,
    'active',
    timestamp
  ]);
  
  return { success: true, id: id };
}

function listMetas() {
  const sheet = getSheet('metas');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const metas = data.map(row => ({
    id: row[0],
    name: row[1],
    target: row[2],
    current: row[3],
    status: row[4]
  }));
  
  return { success: true, data: metas };
}

function updateMeta(data) {
  const sheet = getSheet('metas');
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      if (data.current !== undefined) sheet.getRange(i + 1, 4).setValue(data.current);
      if (data.target !== undefined) sheet.getRange(i + 1, 3).setValue(data.target);
      if (data.name !== undefined) sheet.getRange(i + 1, 2).setValue(data.name);
      return { success: true };
    }
  }
  return { success: false, error: 'Meta não encontrada' };
}

// --- Config / Settings ---

function saveSettings(data) {
  const sheet = getSheet('config');
  const timestamp = new Date();
  
  // Simple key-value store: remove old key if exists, add new
  const rows = sheet.getDataRange().getValues();
  
  // Data comes in { settings: { salary1: 1000, salary2: 2000 } }
  const settings = data.settings;
  
  for (const [key, value] of Object.entries(settings)) {
    let found = false;
    // Check if key exists and update
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === key) {
            sheet.getRange(i + 1, 2).setValue(value);
            found = true;
            break;
        }
    }
    // If not found, append
    if (!found) {
        sheet.appendRow([key, value, timestamp]);
    }
  }
  
  return { success: true };
}

function getSettings() {
  const sheet = getSheet('config');
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header
  
  const settings = {};
  data.forEach(row => {
    settings[row[0]] = row[1];
  });
  
  return { success: true, data: settings };
}

// --- Dashboard ---

function getDashboardData() {
  const tSheet = getSheet('transacoes');
  const tData = tSheet.getDataRange().getValues();
  tData.shift(); 
  
  let income = 0;
  let expense = 0;
  const categories = {};
  const userSplit = {};
  
  tData.forEach(row => {
    const amount = parseFloat(row[4]);
    const type = row[5];
    const category = row[3];
    const user = row[6] || 'Outros';

    if (type === 'income') {
      income += amount;
    } else if (type === 'expense') {
      expense += amount;
      
      if (!categories[category]) categories[category] = 0;
      categories[category] += amount;

      if (!userSplit[user]) userSplit[user] = 0;
      userSplit[user] += amount;
    }
  });

  const categoryList = Object.keys(categories).map(key => ({
    name: key,
    value: categories[key]
  })).sort((a, b) => b.value - a.value);

  const userList = Object.keys(userSplit).map(key => ({
    name: key,
    value: userSplit[key]
  }));
  
  // Get settings to check if we have salary info
  const config = getSettings().data;
  const salary1 = parseFloat(config['salary_user1']) || 0;
  const salary2 = parseFloat(config['salary_user2']) || 0;
  // If income from transactions is 0, usage expected monthly salary (optional logic)
  // For now, let's return total salary as 'projectedIncome'
  
  return {
    success: true,
    data: {
      income: income,
      expense: expense,
      balance: income - expense,
      categories: categoryList,
      userSplit: userList,
      projectedIncome: salary1 + salary2,
      salaries: { user1: salary1, user2: salary2 }
    }
  };
}

// --- Reset ---
function resetData() {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const tSheet = ss.getSheetByName('transacoes');
   const mSheet = ss.getSheetByName('metas');
   const cSheet = ss.getSheetByName('config');
   
   if(tSheet) { tSheet.clear(); tSheet.appendRow(['ID', 'Data', 'Descrição', 'Categoria', 'Valor', 'Tipo', 'Usuário', 'Timestamp']); }
   if(mSheet) { mSheet.clear(); mSheet.appendRow(['ID', 'Nome', 'Alvo', 'Atual', 'Status', 'Timestamp']); }
   if(cSheet) { cSheet.clear(); cSheet.appendRow(['Key', 'Value', 'Timestamp']); }
   
   return { success: true };
}
