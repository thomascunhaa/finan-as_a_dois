/**
 * API Service for Gestão Financeira para Casais
 * Handles communication with Google Apps Script
 */

const MOCK_MODE = false; // Set to false when backend is ready
let API_URL = localStorage.getItem('api_url') || '';

if (!MOCK_MODE && !API_URL) {
    API_URL = prompt("Por favor, insira a URL do Backend (Google Apps Script):");
    if (API_URL) {
        localStorage.setItem('api_url', API_URL);
    }
}

const mockData = {
    transactions: [
        { id: 1, date: '2023-12-01', description: 'Salário', category: 'Salário', amount: 5000, type: 'income', user: 'Pessoa 1' },
        { id: 2, date: '2023-12-05', description: 'Aluguel', category: 'Moradia', amount: 2000, type: 'expense', user: 'Compartilhado' },
        { id: 3, date: '2023-12-06', description: 'Supermercado', category: 'Alimentação', amount: 450, type: 'expense', user: 'Pessoa 2' }
    ],
    goals: [
        { id: 1, name: 'Viagem Fim de Ano', target: 5000, current: 3500 },
        { id: 2, name: 'Reserva de Emergência', target: 20000, current: 8000 }
    ]
};

const api = {
    async request(method, params = {}) {
        if (MOCK_MODE) {
            console.log(`[MOCK API] ${method}`, params);
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(this.mockResponse(method, params));
                }, 500);
            });
        }

        if (!API_URL) {
            console.error('API URL not configured');
            return { error: 'API URL not configured' };
        }

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ method, ...params }),
                headers: { "Content-Type": "text/plain;charset=utf-8" } // text/plain avoids CORS preflight issues with GAS
            });
            return await response.json();
        } catch (error) {
            console.error('API Request Failed', error);
            return { error: error.message };
        }
    },

    mockResponse(method, params) {
        switch (method) {
            case 'getDashboardData':
                return {
                    success: true,
                    data: {
                        income: 8500,
                        expense: 3200,
                        balance: 5300,
                        recentTransactions: mockData.transactions.slice(0, 5)
                    }
                };
            case 'listTransacoes':
                return { success: true, data: mockData.transactions };
            case 'addTransacao':
                const newTx = { id: Date.now(), ...params };
                mockData.transactions.push(newTx);
                return { success: true, data: newTx };
            default:
                return { success: false, error: 'Method not found' };
        }
    }
};
