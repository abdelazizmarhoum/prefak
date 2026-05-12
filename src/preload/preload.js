const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Materials
    getMaterials:       ()     => ipcRenderer.invoke('get-materials'),
    addMaterial:        (d)    => ipcRenderer.invoke('add-material', d),
    updateMaterial:     (d)    => ipcRenderer.invoke('update-material', d),
    deleteMaterial:     (id)   => ipcRenderer.invoke('delete-material', id),
    moveStock:          (d)    => ipcRenderer.invoke('move-stock', d),
    selectImage:        ()     => ipcRenderer.invoke('select-image'),

    // History
    getHistory:         (n)    => ipcRenderer.invoke('get-history', n),

    // Productions
    getProductions:     ()     => ipcRenderer.invoke('get-productions'),
    getProductionItems: (id)   => ipcRenderer.invoke('get-production-items', id),
    addProduction:      (d)    => ipcRenderer.invoke('add-production', d),
    updateProduction:   (d)    => ipcRenderer.invoke('update-production', d),
    deleteProduction:   (id)   => ipcRenderer.invoke('delete-production', id),

    // Clients
    getClients:         ()     => ipcRenderer.invoke('get-clients'),
    addClient:          (d)    => ipcRenderer.invoke('add-client', d),
    updateClient:       (d)    => ipcRenderer.invoke('update-client', d),
    deleteClient:       (id)   => ipcRenderer.invoke('delete-client', id),

    // Sales
    getSales:           ()     => ipcRenderer.invoke('get-sales'),
    addSale:            (d)    => ipcRenderer.invoke('add-sale', d),
    updateSale:         (d)    => ipcRenderer.invoke('update-sale', d),
    deleteSale:         (id)   => ipcRenderer.invoke('delete-sale', id),

    // Expenses
    getExpenses:        ()     => ipcRenderer.invoke('get-expenses'),
    addExpense:         (d)    => ipcRenderer.invoke('add-expense', d),
    updateExpense:      (d)    => ipcRenderer.invoke('update-expense', d),
    deleteExpense:      (id)   => ipcRenderer.invoke('delete-expense', id),

    // Analytics
    getFinancialReport: ()     => ipcRenderer.invoke('get-financial-report'),
    getStockAnalytics:  ()     => ipcRenderer.invoke('get-stock-analytics'),

    // QR & Files
    generateQR:         (t)    => ipcRenderer.invoke('generate-qr', t),
    saveFile:           (d)    => ipcRenderer.invoke('save-file', d),

    // Settings
    getCurrentPath:     ()     => ipcRenderer.invoke('get-current-path'),
    changeDataPath:     ()     => ipcRenderer.invoke('change-data-path'),
    seedDemoData:       ()     => ipcRenderer.invoke('seed-demo-data'),
});
