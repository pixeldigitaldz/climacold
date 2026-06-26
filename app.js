/* ==========================================================================
   Lógica de la Aplicación - Multiservicios ClimaCold (Multi-Equipos & Agenda)
   ========================================================================== */

const EQUIPMENT_LABELS = {
  split: '❄️ Split',
  ventana: '🔲 Ventana',
  nevera: '🥛 Nevera',
  fricer: '🧊 Fricer'
};

const VISIT_REASON_LABELS = {
  inspeccion: '🔍 Inspección',
  mantenimiento: '🔧 Mantenimiento',
  reparacion: '🩹 Reparación',
  presupuesto: '📋 Presupuesto',
  instalacion: '✨ Instalación'
};

const VISIT_REASON_COLORS = {
  inspeccion: '#f59e0b',  // Amber
  mantenimiento: '#10b981', // Emerald
  reparacion: '#ef4444',    // Red
  presupuesto: '#3b82f6',   // Blue
  instalacion: '#8b5cf6'    // Purple
};

// Variable global para rastrear si se está completando una cita desde detalles
let completingVisitClientId = null;

// --- 1. Estado de la Aplicación ---
let state = {
  clients: [],
  history: [],
  selectedClientId: null,
  filters: {
    status: 'all', // 'all', 'ok', 'pending', 'overdue'
    type: 'all',   // 'all', 'split', 'ventana', 'nevera', 'fricer'
    search: ''
  }
};

// --- 2. Inicialización y Carga de Datos ---
document.addEventListener('DOMContentLoaded', () => {
  initData();
  setupEventListeners();
  initNotifications();
  renderApp();
  
  // Iniciar temporizador en segundo plano para notificaciones (cada 60 segundos)
  setInterval(checkAndSendNotifications, 60000);
  // Ejecutar primera verificación inmediatamente después de cargar
  setTimeout(checkAndSendNotifications, 2000);

  // Registrar Service Worker para PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.error('Error al registrar Service Worker:', err));
  }
});

// Inicializar datos cargando desde localStorage o inyectando mock data
function initData() {
  const localClients = localStorage.getItem('climacold_clients');
  const localHistory = localStorage.getItem('climacold_history');

  if (localClients && localHistory) {
    state.clients = JSON.parse(localClients);
    state.history = JSON.parse(localHistory);
    migrateDataSchema();
  } else {
    // Si está vacío, cargar datos de prueba dinámicos
    const mock = generateMockData();
    state.clients = mock.clients;
    state.history = mock.history;
    saveToLocalStorage();
  }
}

// Migración automática de esquemas antiguos
function migrateDataSchema() {
  let migrated = false;
  state.clients = state.clients.map(client => {
    // 1. Migración antigua de equipo único a lista de equipos
    if (!client.equipments) {
      client.equipments = [
        {
          id: 'eq-' + Math.random().toString(36).substr(2, 9),
          type: client.airType || 'split',
          brand: client.airBrand || 'Equipo Registrado',
          interval: client.maintenanceInterval || 6,
          nextDate: client.nextMaintenanceDate || new Date().toISOString().split('T')[0]
        }
      ];
      delete client.airType;
      delete client.airBrand;
      delete client.maintenanceInterval;
      delete client.nextMaintenanceDate;
      migrated = true;
    }
    // 2. Asegurar que exista propiedad de citas
    if (client.scheduledVisit === undefined) {
      client.scheduledVisit = null;
      migrated = true;
    }
    // 3. Asegurar que exista propiedad de deuda
    if (client.totalDebt === undefined) {
      client.totalDebt = 0;
      migrated = true;
    }
    return client;
  });

  // Asegurar campos financieros en el historial
  state.history = state.history.map(record => {
    if (record.price === undefined) {
      record.price = 0;
      migrated = true;
    }
    if (record.amountPaid === undefined) {
      record.amountPaid = 0;
      migrated = true;
    }
    if (record.debt === undefined) {
      record.debt = 0;
      migrated = true;
    }
    if (record.paymentPromiseDate === undefined) {
      record.paymentPromiseDate = null;
      migrated = true;
    }
    return record;
  });

  if (migrated) {
    recalculateAllDebts();
    saveToLocalStorage();
  }
}

// Recalcular deuda acumulada de un cliente
function recalculateClientDebt(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return 0;
  
  const clientHistory = state.history.filter(h => h.clientId === clientId);
  let totalDebt = 0;
  clientHistory.forEach(record => {
    if (record.isPayment) {
      totalDebt -= parseFloat(record.amountPaid) || 0;
    } else {
      totalDebt += parseFloat(record.debt) || 0;
    }
  });
  
  client.totalDebt = Math.max(0, totalDebt);
  return client.totalDebt;
}

// Recalcular deudas para todos los clientes
function recalculateAllDebts() {
  state.clients.forEach(client => {
    recalculateClientDebt(client.id);
  });
}

// Guardar datos en localStorage
function saveToLocalStorage() {
  localStorage.setItem('climacold_clients', JSON.stringify(state.clients));
  localStorage.setItem('climacold_history', JSON.stringify(state.history));
}

// --- 3. Generación de Datos de Prueba Dinámicos ---
function generateMockData() {
  const today = new Date();
  
  // Clientes con soporte de múltiples equipos, citas agendadas y deudas
  const clients = [
    {
      id: "client-1",
      name: "Carlos",
      surname: "Mendoza",
      phone: "+584125551234",
      address: "Av. Francisco de Miranda, Edificio Imperial, Apto 5B. Chacao",
      equipments: [
        {
          id: "eq-c1-1",
          type: "split",
          brand: "LG JetCool 12000 BTU",
          interval: 6,
          nextDate: offsetDate(today, -15) // Mantenimiento vencido hace 15 días
        },
        {
          id: "eq-c1-2",
          type: "ventana",
          brand: "Carrier 8000 BTU (Habitación)",
          interval: 6,
          nextDate: offsetDate(today, 60)
        }
      ],
      scheduledVisit: null,
      status: "active",
      notes: "Ubicado en la sala principal. Requiere escalera de 8 pasos.",
      createdAt: offsetDate(today, -200),
      totalDebt: 20.00
    },
    {
      id: "client-2",
      name: "María Alejandra",
      surname: "Gómez",
      phone: "+584241112233",
      address: "Urbanización Los Palos Grandes, Calle 3, Res. Altamira, PB-A",
      equipments: [
        {
          id: "eq-c2-1",
          type: "split",
          brand: "Samsung WindFree 18000 BTU (Sala)",
          interval: 6,
          nextDate: offsetDate(today, 10) // Próximo en 10 días
        },
        {
          id: "eq-c2-2",
          type: "split",
          brand: "Samsung Inverter 12000 BTU (Cuarto)",
          interval: 6,
          nextDate: offsetDate(today, 120)
        }
      ],
      scheduledVisit: {
        date: offsetDate(today, 1), // Cita Mañana
        time: "09:00",
        reason: "mantenimiento",
        notes: "Limpieza profunda de los dos aires."
      },
      status: "active",
      notes: "Condensadora en la platabanda. Acceso fácil por la cocina.",
      createdAt: offsetDate(today, -170),
      totalDebt: 0.00
    },
    {
      id: "client-3",
      name: "Héctor",
      surname: "Rodríguez",
      phone: "+584149998877",
      address: "Colinas de Bello Monte, Av. Principal, Quinta ClimaFeliz",
      equipments: [
        {
          id: "eq-c3-1",
          type: "ventana",
          brand: "Carrier 8000 BTU (Estudio)",
          interval: 6,
          nextDate: offsetDate(today, 90)
        }
      ],
      scheduledVisit: {
        date: offsetDate(today, 0), // Cita Hoy
        time: "15:30",
        reason: "inspeccion",
        notes: "Revisar ruido metálico al arrancar equipo de estudio."
      },
      status: "active",
      notes: "Hace ruidos raros al apagar. Revisar gomas.",
      createdAt: offsetDate(today, -90),
      totalDebt: 0.00
    },
    {
      id: "client-4",
      name: "Consultorio Dental",
      surname: "Dr. Luis Silva",
      phone: "+582129994455",
      address: "CCCT, Torre A, Piso 4, Ofic. 412",
      equipments: [
        {
          id: "eq-c4-1",
          type: "split",
          brand: "Panasonic Inverter 24000 BTU",
          interval: 3,
          nextDate: offsetDate(today, -5) // Mantenimiento vencido
        },
        {
          id: "eq-c4-2",
          type: "nevera",
          brand: "Nevera Ejecutiva Frigilux 90L",
          interval: 12,
          nextDate: offsetDate(today, 180)
        }
      ],
      scheduledVisit: null,
      status: "active",
      notes: "Horario comercial. Mantenimientos después de las 5:00 PM.",
      createdAt: offsetDate(today, -100),
      totalDebt: 0.00
    },
    {
      id: "client-5",
      name: "Juan",
      surname: "Pérez",
      phone: "+584167773322",
      address: "Sabana Grande, Calle Real, Edificio Royal, Piso 2, Apto 23",
      equipments: [
        {
          id: "eq-c5-1",
          type: "nevera",
          brand: "Nevera Mabe 14 Pies Sin Escarcha",
          interval: 12,
          nextDate: offsetDate(today, 25) // Próximo
        }
      ],
      scheduledVisit: null,
      status: "active",
      notes: "Nevera pegada a la pared. Limpiar condensador trasero.",
      createdAt: offsetDate(today, -340),
      totalDebt: 70.00
    },
    {
      id: "client-6",
      name: "Carnicería El Buen Corte",
      surname: "Geraldo",
      phone: "+584248889900",
      address: "Av. Baralt, Local 45, Planta Baja",
      equipments: [
        {
          id: "eq-c6-1",
          type: "fricer",
          brand: "Freezer Horizontal Frigilux 300L",
          interval: 6,
          nextDate: offsetDate(today, -3) // Mantenimiento vencido
        }
      ],
      scheduledVisit: {
        date: offsetDate(today, 3), // Cita en 3 días
        time: "10:30",
        reason: "reparacion",
        notes: "El freezer no congela bien. Verificar presión de gas."
      },
      status: "active",
      notes: "Freezer comercial de exhibición. Revisar empaques de puerta.",
      createdAt: offsetDate(today, -180),
      totalDebt: 150.00
    }
  ];

  // Historiales
  const history = [
    {
      id: "record-1",
      clientId: "client-1",
      equipmentId: "eq-c1-1",
      equipmentName: "LG JetCool 12000 BTU",
      date: offsetDate(today, -195),
      description: "Instalación del equipo Split LG JetCool. Vacío de tuberías. Carga completa R410A.",
      technicianNotes: "Presiones correctas.",
      price: 120.00,
      amountPaid: 120.00,
      debt: 0.00,
      paymentPromiseDate: null
    },
    {
      id: "record-2",
      clientId: "client-1",
      equipmentId: "eq-c1-1",
      equipmentName: "LG JetCool 12000 BTU",
      date: offsetDate(today, -180),
      description: "Primer mantenimiento preventivo. Limpieza profunda serpentines y turbina.",
      technicianNotes: "Filtros muy sucios. Avenida con mucho humo.",
      price: 60.00,
      amountPaid: 40.00,
      debt: 20.00,
      paymentPromiseDate: offsetDate(today, 5)
    },
    {
      id: "record-3",
      clientId: "client-2",
      equipmentId: "eq-c2-1",
      equipmentName: "Samsung WindFree 18000 BTU (Sala)",
      date: offsetDate(today, -170),
      description: "Mantenimiento preventivo completo. Desinfección química antibacterial.",
      technicianNotes: "Capacitor verificado OK.",
      price: 80.00,
      amountPaid: 80.00,
      debt: 0.00,
      paymentPromiseDate: null
    },
    {
      id: "record-4",
      clientId: "client-3",
      equipmentId: "eq-c3-1",
      equipmentName: "Carrier 8000 BTU (Estudio)",
      date: offsetDate(today, -90),
      description: "Instalación y adecuación de aire de ventana Carrier.",
      technicianNotes: "Gomas antivibrantes colocadas.",
      price: 100.00,
      amountPaid: 100.00,
      debt: 0.00,
      paymentPromiseDate: null
    },
    {
      id: "record-5",
      clientId: "client-5",
      equipmentId: "eq-c5-1",
      equipmentName: "Nevera Mabe 14 Pies Sin Escarcha",
      date: offsetDate(today, -340),
      description: "Mantenimiento preventivo. Soplado y limpieza profunda de condensador y motor inferior.",
      technicianNotes: "Amperajes correctos.",
      price: 100.00,
      amountPaid: 30.00,
      debt: 70.00,
      paymentPromiseDate: offsetDate(today, 0)
    },
    {
      id: "record-6",
      clientId: "client-6",
      equipmentId: "eq-c6-1",
      equipmentName: "Freezer Horizontal Frigilux 300L",
      date: offsetDate(today, -180),
      description: "Servicio de limpieza y cambio de relé térmico del compresor.",
      technicianNotes: "Se sugirió cambiar empaques desgastados.",
      price: 300.00,
      amountPaid: 150.00,
      debt: 150.00,
      paymentPromiseDate: offsetDate(today, 2)
    }
  ];

  return { clients, history };
}

// --- 4. Utilidades de Fechas ---
function offsetDate(baseDate, days) {
  const newDate = new Date(baseDate);
  newDate.setDate(newDate.getDate() + days);
  return newDate.toISOString().split('T')[0];
}

function addMonths(dateStr, months) {
  const date = new Date(dateStr + 'T12:00:00'); 
  date.setMonth(date.getMonth() + parseInt(months));
  return date.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysDifference(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = d1 - d2;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getEarliestMaintenanceEquipment(client) {
  if (!client.equipments || client.equipments.length === 0) {
    return { nextDate: '9999-12-31', type: 'split', brand: 'Sin equipo' };
  }
  const sorted = [...client.equipments].sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));
  return sorted[0];
}

function getClientMaintenanceStatus(client) {
  const earliestEq = getEarliestMaintenanceEquipment(client);
  const todayStr = new Date().toISOString().split('T')[0];
  const daysDiff = getDaysDifference(earliestEq.nextDate, todayStr);
  
  if (daysDiff < 0) {
    return 'overdue';
  } else if (daysDiff <= 30) {
    return 'pending';
  } else {
    return 'ok';
  }
}

// --- 5. Configuración de Eventos (Event Listeners) ---
function setupEventListeners() {
  // Manejador Global de Dialogs Nativos
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[commandfor]');
    if (!button) return;

    const targetId = button.getAttribute('commandfor');
    const dialog = document.getElementById(targetId);
    const command = button.getAttribute('command');

    if (dialog && dialog.tagName === 'DIALOG') {
      event.preventDefault();
      if (command === 'show-modal') {
        if (targetId === 'client-dialog' && !button.hasAttribute('data-edit')) {
          resetClientForm();
        }
        dialog.showModal();
      } else if (command === 'close') {
        dialog.close();
      }
    }
  });

  // Backdrop click dismiss dialogs
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        dialog.close();
      }
    });
  });

  // Botones principales
  document.getElementById('btn-add-client').addEventListener('click', () => {
    resetClientForm();
    document.getElementById('client-dialog').showModal();
  });

  document.getElementById('btn-open-backup').addEventListener('click', () => {
    document.getElementById('backup-dialog').showModal();
  });

  // Botón dinámico para filas de equipos
  document.getElementById('btn-add-eq-row').addEventListener('click', () => {
    addEquipmentRowField();
  });

  // Buscador y filtros de barra
  document.getElementById('input-search').addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase().trim();
    renderClientsGrid();
  });

  document.querySelectorAll('.btn-filter').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.filters.status = e.target.getAttribute('data-filter');
      renderClientsGrid();
    });
  });

  document.querySelectorAll('.btn-filter-type').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-filter-type').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.filters.type = e.target.getAttribute('data-type');
      renderClientsGrid();
    });
  });

  // Formularios
  document.getElementById('client-form').addEventListener('submit', handleClientSubmit);
  document.getElementById('maintenance-form').addEventListener('submit', handleMaintenanceSubmit);
  document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);

  // Lógica interactiva de cobro en modal
  const mPriceInput = document.getElementById('maintenance-price');
  const mPaidInput = document.getElementById('maintenance-paid');
  
  mPriceInput.addEventListener('input', updateMaintenanceDebt);
  mPaidInput.addEventListener('input', updateMaintenanceDebt);

  // Copias de seguridad
  document.getElementById('btn-export-data').addEventListener('click', exportBackup);
  document.getElementById('input-import-file').addEventListener('change', importBackup);
  document.getElementById('btn-reset-demo').addEventListener('click', resetDemoData);

  // Botón de activación manual de notificaciones
  document.getElementById('btn-request-notifications').addEventListener('click', requestNotificationPermissions);

  // Cerrar ficha lateral
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    closeDetailPanel();
  });

  // Modal de selector de WhatsApp
  const msgTypeSelect = document.getElementById('wa-msg-type');
  const serviceSelect = document.getElementById('wa-service-select');
  
  if (msgTypeSelect && serviceSelect) {
    msgTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      const followupDetails = document.getElementById('wa-followup-details');
      if (type === 'followup') {
        followupDetails.style.display = 'flex';
      } else {
        followupDetails.style.display = 'none';
      }
      generateWhatsAppPreview();
    });

    serviceSelect.addEventListener('change', () => {
      generateWhatsAppPreview();
    });
  }

  document.getElementById('whatsapp-form').addEventListener('submit', handleWhatsAppFormSubmit);
}

// --- 6. Manejo del Formulario Dinámico de Equipos ---

function resetClientForm() {
  document.getElementById('client-form').reset();
  document.getElementById('client-id').value = '';
  document.getElementById('client-dialog-title').textContent = 'Nuevo Cliente';
  
  const container = document.getElementById('equipments-form-container');
  container.innerHTML = '';
  addEquipmentRowField(); // Una fila inicial por defecto
}

function addEquipmentRowField(data = null) {
  const container = document.getElementById('equipments-form-container');
  const uniqueId = data ? data.id : 'eq-' + Math.random().toString(36).substr(2, 9);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultInterval = data ? data.interval : 6;
  const defaultNextDate = data ? data.nextDate : addMonths(todayStr, defaultInterval);
  const defaultType = data ? data.type : 'split';
  const defaultBrand = data ? data.brand : '';

  const row = document.createElement('div');
  row.className = 'equipment-row';
  row.setAttribute('data-id', uniqueId);

  row.innerHTML = `
    <input type="hidden" class="eq-id" value="${uniqueId}">
    
    <div class="eq-row-inputs">
      <div class="form-field">
        <label>Tipo de Equipo</label>
        <select class="eq-type" required>
          <option value="split" ${defaultType === 'split' ? 'selected' : ''}>Split</option>
          <option value="ventana" ${defaultType === 'ventana' ? 'selected' : ''}>Ventana</option>
          <option value="nevera" ${defaultType === 'nevera' ? 'selected' : ''}>Nevera</option>
          <option value="fricer" ${defaultType === 'fricer' ? 'selected' : ''}>Fricer</option>
        </select>
      </div>

      <div class="form-field">
        <label>Marca / Detalle</label>
        <input type="text" class="eq-brand" required placeholder="Ej: LG JetCool 12k BTU" value="${defaultBrand}">
      </div>

      <div class="form-field">
        <label>Frec. (Meses)</label>
        <input type="number" class="eq-interval" min="1" max="24" required value="${defaultInterval}">
      </div>

      <div class="form-field">
        <label>Próx. Mantenimiento</label>
        <input type="date" class="eq-next-date" required value="${defaultNextDate}">
      </div>
    </div>

    <button type="button" class="btn-remove-eq" title="Eliminar equipo">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      <span>Eliminar</span>
    </button>
  `;

  const intervalInput = row.querySelector('.eq-interval');
  const dateInput = row.querySelector('.eq-next-date');
  
  intervalInput.addEventListener('input', () => {
    const val = parseInt(intervalInput.value) || 6;
    dateInput.value = addMonths(new Date().toISOString().split('T')[0], val);
  });

  row.querySelector('.btn-remove-eq').addEventListener('click', () => {
    if (container.children.length > 1) {
      row.remove();
    } else {
      alert('El cliente debe tener al menos un equipo registrado.');
    }
  });

  container.appendChild(row);
}

// --- 7. Controladores de Envío de Formularios ---

// Guardar o Editar Cliente con sus equipos y cita programada
function handleClientSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const clientId = formData.get('id');

  // Recopilar equipos
  const equipments = [];
  const rows = document.querySelectorAll('#equipments-form-container .equipment-row');
  rows.forEach(row => {
    equipments.push({
      id: row.querySelector('.eq-id').value,
      type: row.querySelector('.eq-type').value,
      brand: row.querySelector('.eq-brand').value.trim() || 'Equipo',
      interval: parseInt(row.querySelector('.eq-interval').value) || 6,
      nextDate: row.querySelector('.eq-next-date').value
    });
  });

  if (equipments.length === 0) {
    alert('Por favor agrega al menos un equipo.');
    return;
  }

  // Recopilar cita programada
  const visitDate = formData.get('visitDate');
  const visitTime = formData.get('visitTime');
  const visitReason = formData.get('visitReason');
  const visitNotes = formData.get('visitNotes');

  let scheduledVisit = null;
  if (visitReason) {
    scheduledVisit = {
      date: visitDate || new Date().toISOString().split('T')[0],
      time: visitTime || '08:00',
      reason: visitReason,
      notes: visitNotes.trim()
    };
  }

  const clientData = {
    name: formData.get('name').trim(),
    surname: formData.get('surname').trim(),
    phone: formData.get('phone').trim(),
    address: formData.get('address').trim(),
    notes: formData.get('notes').trim(),
    equipments: equipments,
    scheduledVisit: scheduledVisit
  };

  if (clientId) {
    // Editar
    const index = state.clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      state.clients[index] = { ...state.clients[index], ...clientData };
    }
  } else {
    // Crear
    const newClient = {
      id: 'client-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active',
      ...clientData
    };
    state.clients.push(newClient);
  }

  saveToLocalStorage();
  document.getElementById('client-dialog').close();
  renderApp();

  if (state.selectedClientId === clientId) {
    showClientDetail(clientId);
  }
}

// Registrar servicio de mantenimiento
function handleMaintenanceSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const clientId = formData.get('clientId');
  const equipmentId = formData.get('equipmentId');
  const serviceDate = formData.get('date');
  const nextInterval = parseInt(formData.get('nextInterval')) || 6;

  const price = parseFloat(formData.get('price')) || 0;
  const amountPaid = parseFloat(formData.get('amountPaid')) || 0;
  const debt = Math.max(0, price - amountPaid);
  const paymentPromiseDate = debt > 0 ? formData.get('paymentPromiseDate') : null;

  const clientIndex = state.clients.findIndex(c => c.id === clientId);
  if (clientIndex === -1) return;

  const client = state.clients[clientIndex];

  if (equipmentId === 'all') {
    // Registrar mantenimiento para cada equipo (dividir costo y pagado equitativamente)
    const eqCount = client.equipments.length;
    const pricePerEq = parseFloat((price / eqCount).toFixed(2));
    const paidPerEq = parseFloat((amountPaid / eqCount).toFixed(2));
    
    let priceSum = 0;
    let paidSum = 0;

    client.equipments.forEach((eq, index) => {
      const isLast = index === eqCount - 1;
      const eqPrice = isLast ? (price - priceSum) : pricePerEq;
      const eqPaid = isLast ? (amountPaid - paidSum) : paidPerEq;
      priceSum += eqPrice;
      paidSum += eqPaid;
      
      const eqDebt = Math.max(0, eqPrice - eqPaid);

      const record = {
        id: 'record-' + Date.now() + Math.random().toString(36).substr(2, 5),
        clientId: clientId,
        equipmentId: eq.id,
        equipmentName: `${EQUIPMENT_LABELS[eq.type]} - ${eq.brand}`,
        date: serviceDate,
        description: formData.get('description').trim() + ' (Mantenimiento general en bloque)',
        technicianNotes: formData.get('technicianNotes').trim(),
        price: eqPrice,
        amountPaid: eqPaid,
        debt: eqDebt,
        paymentPromiseDate: eqDebt > 0 ? paymentPromiseDate : null
      };
      state.history.push(record);
      
      eq.nextDate = addMonths(serviceDate, nextInterval);
      eq.interval = nextInterval;
    });
  } else {
    // Un solo equipo específico
    const eq = client.equipments.find(e => e.id === equipmentId);
    if (!eq) return;

    const record = {
      id: 'record-' + Date.now(),
      clientId: clientId,
      equipmentId: eq.id,
      equipmentName: `${EQUIPMENT_LABELS[eq.type]} - ${eq.brand}`,
      date: serviceDate,
      description: formData.get('description').trim(),
      technicianNotes: formData.get('technicianNotes').trim(),
      price: price,
      amountPaid: amountPaid,
      debt: debt,
      paymentPromiseDate: paymentPromiseDate
    };
    state.history.push(record);

    eq.nextDate = addMonths(serviceDate, nextInterval);
    eq.interval = nextInterval;
  }

  // Si esta visita venía de "Completar Cita", limpiar la cita programada
  if (completingVisitClientId === clientId) {
    client.scheduledVisit = null;
    completingVisitClientId = null;
  }

  recalculateClientDebt(clientId);
  saveToLocalStorage();
  document.getElementById('maintenance-dialog').close();
  e.target.reset();

  renderApp();
  showClientDetail(clientId);
}

// Lógica interactiva de cobros y abonos en formularios
function updateMaintenanceDebt() {
  const mPriceInput = document.getElementById('maintenance-price');
  const mPaidInput = document.getElementById('maintenance-paid');
  const mDebtDisplay = document.getElementById('maintenance-debt-display');
  const mPromiseContainer = document.getElementById('maintenance-promise-container');
  const mPromiseDate = document.getElementById('maintenance-promise-date');

  if (!mPriceInput || !mPaidInput || !mDebtDisplay) return;

  const price = parseFloat(mPriceInput.value) || 0;
  const paid = parseFloat(mPaidInput.value) || 0;
  const debt = price - paid;
  
  mDebtDisplay.textContent = `$${Math.max(0, debt).toFixed(2)}`;
  
  if (debt > 0.01) {
    mPromiseContainer.style.display = 'flex';
    mPromiseDate.setAttribute('required', 'required');
  } else {
    mPromiseContainer.style.display = 'none';
    mPromiseDate.removeAttribute('required');
    mPromiseDate.value = '';
  }
}

function openPaymentModal(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  document.getElementById('payment-client-id').value = clientId;
  document.getElementById('payment-client-name').textContent = `${client.name} ${client.surname}`;
  document.getElementById('payment-current-debt').textContent = `$${client.totalDebt.toFixed(2)}`;
  
  // Autocompletar con la deuda restante
  document.getElementById('payment-amount').value = client.totalDebt.toFixed(2);
  document.getElementById('payment-amount').max = client.totalDebt;
  
  document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('payment-notes').value = '';

  document.getElementById('payment-dialog').showModal();
}

function handlePaymentSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const clientId = formData.get('clientId');
  const amount = parseFloat(formData.get('amount')) || 0;
  const date = formData.get('date');
  const notes = formData.get('notes').trim();

  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const record = {
    id: 'record-abono-' + Date.now(),
    clientId: clientId,
    equipmentId: 'all',
    equipmentName: 'Abono a Cuenta',
    date: date,
    description: `Abono / Pago registrado: $${amount.toFixed(2)}.${notes ? ' Nota: ' + notes : ''}`,
    price: 0,
    amountPaid: amount,
    debt: 0,
    isPayment: true
  };

  state.history.push(record);
  
  recalculateClientDebt(clientId);
  saveToLocalStorage();
  
  document.getElementById('payment-dialog').close();
  e.target.reset();
  
  renderApp();
  showClientDetail(clientId);
}

// Lógica para Selector y Personalización de Mensajes de WhatsApp
function openWhatsAppSelector(clientId, eqId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const eq = client.equipments.find(e => e.id === eqId);
  if (!eq) return;

  document.getElementById('wa-client-id').value = clientId;
  document.getElementById('wa-eq-id').value = eqId;
  document.getElementById('wa-client-name').textContent = `${client.name} ${client.surname}`;
  
  const eqLabel = EQUIPMENT_LABELS[eq.type] || 'Equipo';
  document.getElementById('wa-eq-name').textContent = `${eqLabel} - ${eq.brand}`;

  // Cargar historial de servicios de este equipo para el selector
  const eqHistory = state.history.filter(h => h.clientId === clientId && h.equipmentId === eqId && !h.isPayment);
  const serviceSelect = document.getElementById('wa-service-select');
  serviceSelect.innerHTML = '';
  
  if (eqHistory.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'default';
    opt.textContent = 'Ningún servicio previo registrado';
    serviceSelect.appendChild(opt);
  } else {
    eqHistory.forEach(record => {
      const opt = document.createElement('option');
      opt.value = record.id;
      const desc = record.description.length > 50 ? record.description.substring(0, 50) + '...' : record.description;
      opt.textContent = `${formatDate(record.date)} - ${desc}`;
      serviceSelect.appendChild(opt);
    });
  }

  // Reiniciar a tipo mantenimiento por defecto
  const msgTypeSelect = document.getElementById('wa-msg-type');
  msgTypeSelect.value = 'maintenance';
  document.getElementById('wa-followup-details').style.display = 'none';

  generateWhatsAppPreview();

  document.getElementById('whatsapp-dialog').showModal();
}

function generateWhatsAppPreview() {
  const clientId = document.getElementById('wa-client-id').value;
  const eqId = document.getElementById('wa-eq-id').value;
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const eq = client.equipments.find(e => e.id === eqId);
  if (!eq) return;

  const type = document.getElementById('wa-msg-type').value;
  const previewTextarea = document.getElementById('wa-message-preview');
  
  let message = '';
  
  if (type === 'maintenance') {
    const eqLabel = eq.type === 'split' ? 'Aire Acondicionado Split ❄️' : (eq.type === 'ventana' ? 'Aire Acondicionado de Ventana 🔲' : (eq.type === 'nevera' ? 'Nevera 🥛' : 'Freezer/Fricer 🧊'));
    const equipmentStr = `su *${eqLabel} (${eq.brand})* para el día *${formatDate(eq.nextDate)}*`;

    message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ Le escribimos para recordarle que ya le corresponde el mantenimiento preventivo de ${equipmentStr}.

Mantener sus equipos limpios optimiza el consumo eléctrico y alarga la vida útil de su motor.

¿Le gustaría coordinar una visita técnica para esta semana?

*¡Climatízate con nosotros!*`;
  } else {
    // Mensaje de Seguimiento Post-Servicio
    const serviceSelect = document.getElementById('wa-service-select');
    const selectedRecordId = serviceSelect.value;
    const record = state.history.find(h => h.id === selectedRecordId);
    
    let serviceDetail = 'mantenimiento / reparación';
    let serviceDateStr = '';
    
    if (record) {
      serviceDetail = record.description;
      serviceDateStr = ` el día *${formatDate(record.date)}*`;
    }

    const eqLabel = eq.type === 'split' ? 'Aire Split ❄️' : (eq.type === 'ventana' ? 'Aire Ventana 🔲' : (eq.type === 'nevera' ? 'Nevera 🥛' : 'Freezer 🧊'));

    message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ Esperamos que se encuentre muy bien.

Le escribimos para hacer un seguimiento cordial del servicio de *${serviceDetail}* realizado${serviceDateStr} a su equipo *${eqLabel} (${eq.brand})*.

Queríamos confirmar cómo ha estado funcionando el equipo desde entonces y si todo se encuentra enfriando de manera excelente. Su satisfacción y tranquilidad es lo primero para nosotros.

¡Quedamos atentos y a su entera disposición ante cualquier duda!

*¡Climatízate con nosotros!*`;
  }

  previewTextarea.value = message;
}

function handleWhatsAppFormSubmit(e) {
  e.preventDefault();
  const clientId = document.getElementById('wa-client-id').value;
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const rawPhone = client.phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
  let cleanPhone = rawPhone;
  if (rawPhone.length === 10 || rawPhone.length === 11) {
    if (rawPhone.startsWith('0')) {
      cleanPhone = '58' + rawPhone.substring(1);
    } else {
      cleanPhone = '58' + rawPhone;
    }
  }

  const message = document.getElementById('wa-message-preview').value;
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank');
  document.getElementById('whatsapp-dialog').close();
}

// --- 8. Renderizado del Tablero e Interfaces ---

function renderApp() {
  renderStats();
  renderAgendaList();
  renderClientsGrid();
}

// Estadísticas
function renderStats() {
  const stats = {
    total: state.clients.length,
    ok: 0,
    pending: 0,
    overdue: 0
  };

  let totalReceivables = 0;
  let debtorCount = 0;

  state.clients.forEach(client => {
    const status = getClientMaintenanceStatus(client);
    stats[status]++;
    
    if (client.totalDebt > 0) {
      totalReceivables += client.totalDebt;
      debtorCount++;
    }
  });

  document.getElementById('val-total-clients').textContent = stats.total;
  document.getElementById('val-ok-clients').textContent = stats.ok;
  document.getElementById('val-pending-clients').textContent = stats.pending;
  document.getElementById('val-overdue-clients').textContent = stats.overdue;

  // Actualizar métrica "Por Cobrar"
  const receivablesStr = debtorCount > 0 
    ? `$${totalReceivables.toFixed(2)} (${debtorCount} ${debtorCount === 1 ? 'deudor' : 'deudores'})` 
    : `$0.00`;
  document.getElementById('val-receivables').textContent = receivablesStr;
}

// Renderizar la agenda de citas y promesas de pago
function renderAgendaList() {
  const container = document.getElementById('agenda-list');
  container.innerHTML = '';

  const agendaItems = [];

  // Recopilar citas de clientes
  state.clients.forEach(client => {
    if (client.scheduledVisit) {
      agendaItems.push({
        type: 'visit',
        clientId: client.id,
        clientName: `${client.name} ${client.surname}`,
        date: client.scheduledVisit.date,
        time: client.scheduledVisit.time || '08:00',
        reason: client.scheduledVisit.reason,
        notes: client.scheduledVisit.notes,
        badgeText: VISIT_REASON_LABELS[client.scheduledVisit.reason] || client.scheduledVisit.reason,
        color: VISIT_REASON_COLORS[client.scheduledVisit.reason] || 'var(--border-color)'
      });
    }

    // Recopilar promesas de pago pendientes
    if (client.totalDebt > 0) {
      const recordsWithPromise = state.history
        .filter(h => h.clientId === client.id && h.paymentPromiseDate && h.debt > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (recordsWithPromise.length > 0) {
        const record = recordsWithPromise[0];
        agendaItems.push({
          type: 'promise',
          clientId: client.id,
          clientName: `${client.name} ${client.surname}`,
          date: record.paymentPromiseDate,
          time: '08:00',
          notes: `Pago pendiente de $${client.totalDebt.toFixed(2)}. (${record.equipmentName})`,
          badgeText: '💰 COBRO',
          color: 'var(--receivables-color)'
        });
      }
    }
  });

  if (agendaItems.length === 0) {
    container.innerHTML = `<div class="agenda-empty" style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; text-align: center; padding: 1rem 0;">No hay citas o cobros agendados</div>`;
    return;
  }

  // Ordenar cronológicamente
  agendaItems.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA - dateB;
  });

  agendaItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'agenda-item';
    el.style.setProperty('--reason-color', item.color);
    
    const badgeClass = item.type === 'visit' ? `badge-${item.reason}` : 'badge-promise';
    
    el.innerHTML = `
      <div class="agenda-item-header">
        <span class="agenda-item-name">${item.clientName}</span>
        <span class="agenda-item-badge ${badgeClass}">${item.badgeText}</span>
      </div>
      <div class="agenda-item-date">
        📅 ${formatDate(item.date)} ${item.type === 'visit' ? `- ⏰ ${item.time}` : ''}
      </div>
      ${item.notes ? `<div class="agenda-item-notes">${item.notes}</div>` : ''}
    `;

    el.addEventListener('click', () => {
      showClientDetail(item.clientId);
    });

    container.appendChild(el);
  });
}

// Rejilla de tarjetas de clientes
function renderClientsGrid() {
  const grid = document.getElementById('clients-grid');
  grid.innerHTML = '';

  const filteredClients = state.clients.filter(client => {
    const fullName = `${client.name} ${client.surname}`.toLowerCase();
    const phone = client.phone.toLowerCase();
    const address = (client.address || '').toLowerCase();
    const matchesEqBrand = client.equipments.some(e => e.brand.toLowerCase().includes(state.filters.search));
    const matchesSearch = fullName.includes(state.filters.search) || 
                          phone.includes(state.filters.search) ||
                          address.includes(state.filters.search) ||
                          matchesEqBrand;

    const matchesType = state.filters.type === 'all' || 
                        client.equipments.some(e => e.type === state.filters.type);

    const status = getClientMaintenanceStatus(client);
    const matchesStatus = state.filters.status === 'all' || 
                          (state.filters.status === 'debtors' ? client.totalDebt > 0 : status === state.filters.status);

    return matchesSearch && matchesType && matchesStatus;
  });

  if (filteredClients.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <h3>No se encontraron clientes</h3>
        <p>Ajusta los filtros o agrega un cliente nuevo.</p>
      </div>
    `;
    return;
  }

  filteredClients.forEach(client => {
    const status = getClientMaintenanceStatus(client);
    const earliestEq = getEarliestMaintenanceEquipment(client);
    const daysDiff = getDaysDifference(earliestEq.nextDate, new Date().toISOString().split('T')[0]);
    
    let statusText = 'Al Día';
    let statusCssColor = 'var(--status-ok-text)';
    
    if (status === 'overdue') {
      statusText = `Vencido (${Math.abs(daysDiff)} d)`;
      statusCssColor = 'var(--status-overdue-text)';
    } else if (status === 'pending') {
      statusText = `Próximo (${daysDiff} d)`;
      statusCssColor = 'var(--status-pending-text)';
    }

    const card = document.createElement('div');
    card.className = `client-card ${state.selectedClientId === client.id ? 'selected' : ''}`;
    card.style.setProperty('--status-color', statusCssColor);
    card.setAttribute('data-id', client.id);

    const uniqueTypes = [...new Set(client.equipments.map(e => e.type))];
    const badgesHtml = uniqueTypes.map(type => 
      `<span class="badge badge-${type}">${EQUIPMENT_LABELS[type]}</span>`
    ).join(' ');

    const eqSummary = client.equipments.map(e => 
      `${EQUIPMENT_LABELS[e.type]} (${e.brand})`
    ).join(', ');

    // Cita Agendada Badge si existe
    let visitBadgeHtml = '';
    if (client.scheduledVisit) {
      const v = client.scheduledVisit;
      visitBadgeHtml = `<div style="margin-top: 0.5rem; font-size: 0.72rem; font-weight: 700; color: ${VISIT_REASON_COLORS[v.reason]}; background-color: var(--border-color); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 0.25rem;">
        📅 Cita: ${VISIT_REASON_LABELS[v.reason]} (${formatDate(v.date)} - ${v.time})
      </div>`;
    }

    // Insignias financieras si debe dinero
    let debtBadgeHtml = '';
    let promiseBadgeHtml = '';
    if (client.totalDebt > 0) {
      debtBadgeHtml = `<div class="card-debt-highlight">
        ⚠️ Debe: $${client.totalDebt.toFixed(2)}
      </div>`;

      // Encontrar la última promesa de pago pendiente
      const recordsWithPromise = state.history
        .filter(h => h.clientId === client.id && h.paymentPromiseDate && h.debt > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      if (recordsWithPromise.length > 0) {
        promiseBadgeHtml = `<div class="card-promise-highlight">
          📅 Promesa: ${formatDate(recordsWithPromise[0].paymentPromiseDate)}
        </div>`;
      }
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="card-name">${client.name} ${client.surname}</span>
          <span class="card-phone">${client.phone}</span>
        </div>
        <div class="card-equipments-list">${badgesHtml}</div>
      </div>

      <div class="card-body">
        <div class="card-info-row">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          <span class="card-info-text">${client.address || 'Sin dirección'}</span>
        </div>
        <div class="card-info-row">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/></svg>
          <span class="card-info-text card-equipments-text" title="${eqSummary}">${client.equipments.length} Equipo(s): ${eqSummary}</span>
        </div>

        <div class="card-maintenance-highlight" style="--status-text: ${statusCssColor}">
          <span class="highlight-label">Próxima Visita (Urgente):</span>
          <span class="highlight-value" style="font-size: 0.85rem;">${formatDate(earliestEq.nextDate)}</span>
          <span class="badge status-dot-badge" style="--status-bg: var(--status-${status}-bg); --status-text: var(--status-${status}-text); margin-left: 0.35rem;">
            ${statusText}
          </span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            Equipo: <strong>${earliestEq.brand}</strong>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${visitBadgeHtml}
          ${debtBadgeHtml}
          ${promiseBadgeHtml}
        </div>
      </div>

      <div class="card-actions">
        <a href="${getWhatsAppUrl(client, client.totalDebt > 0 ? 'debt' : (client.scheduledVisit ? 'visit' : 'maintenance'))}" target="_blank" class="btn-icon-only btn-whatsapp" title="Enviar recordatorio de WhatsApp" aria-label="Enviar WhatsApp">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </a>
        <button class="btn btn-secondary btn-action-text btn-service-add" type="button">Servicio</button>
        <button class="btn btn-primary btn-action-text btn-view-detail" type="button">Detalles</button>
      </div>
    `;

    card.querySelector('.btn-view-detail').addEventListener('click', (e) => {
      e.stopPropagation();
      showClientDetail(client.id);
    });

    card.querySelector('.btn-service-add').addEventListener('click', (e) => {
      e.stopPropagation();
      openMaintenanceModal(client.id);
    });

    card.addEventListener('click', () => {
      showClientDetail(client.id);
    });

    grid.appendChild(card);
  });
}

// --- 9. Ficha Lateral de Detalles (Timeline & Citas) ---

function showClientDetail(clientId) {
  state.selectedClientId = clientId;

  document.querySelectorAll('.client-card').forEach(card => {
    if (card.getAttribute('data-id') === clientId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const clientHistory = state.history
    .filter(record => record.clientId === clientId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const detailPanel = document.getElementById('client-detail-panel');
  const panelBody = document.getElementById('detail-panel-body');

  const status = getClientMaintenanceStatus(client);
  const statusCssColor = status === 'ok' ? 'var(--status-ok-text)' : (status === 'pending' ? 'var(--status-pending-text)' : 'var(--status-overdue-text)');
  const earliestEq = getEarliestMaintenanceEquipment(client);

  const eqListHtml = client.equipments.map(eq => {
    const eqStatus = getDaysDifference(eq.nextDate, new Date().toISOString().split('T')[0]) < 0 ? 'overdue' : (getDaysDifference(eq.nextDate, new Date().toISOString().split('T')[0]) <= 30 ? 'pending' : 'ok');
    const eqStatusText = eqStatus === 'overdue' ? 'Vencido' : (eqStatus === 'pending' ? 'Próximo' : 'Al Día');
    
    return `
      <div style="background-color: var(--bg-input); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge badge-${eq.type}">${EQUIPMENT_LABELS[eq.type]}</span>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <a href="${getWhatsAppUrl(client, 'maintenance', eq.id)}" target="_blank" class="btn-whatsapp-sm" title="Recordatorio por WhatsApp para este equipo" style="color: var(--text-whatsapp); display: inline-flex; align-items: center; justify-content: center; padding: 2px;">
              <svg class="icon" style="width: 15px; height: 15px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </a>
            <span class="badge status-dot-badge" style="--status-bg: var(--status-${eqStatus}-bg); --status-text: var(--status-${eqStatus}-text); font-size: 0.65rem;">
              ${eqStatusText}
            </span>
          </div>
        </div>
        <div style="font-weight: 700; font-size: 0.85rem; margin-top: 2px;">${eq.brand}</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
          <span>Frecuencia: ${eq.interval} meses</span>
          <span>Próximo: <strong>${formatDate(eq.nextDate)}</strong></span>
        </div>
      </div>
    `;
  }).join('');

  // Estructura de Cita Programada si existe
  let scheduledVisitHtml = '';
  if (client.scheduledVisit) {
    const v = client.scheduledVisit;
    scheduledVisitHtml = `
      <div style="background: linear-gradient(135deg, var(--status-pending-bg), var(--border-color)); padding: 1rem; border-radius: var(--radius-md); border: 1px solid ${VISIT_REASON_COLORS[v.reason]}; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 0.8rem; text-transform: uppercase; color: var(--text-main);">📅 Cita Programada</span>
          <span class="badge status-dot-badge" style="--status-bg: ${VISIT_REASON_COLORS[v.reason]}; --status-text: #fff; font-size: 0.65rem;">
            ${VISIT_REASON_LABELS[v.reason]}
          </span>
        </div>
        <div style="font-size: 0.85rem; font-weight: 700;">Fecha: ${formatDate(v.date)} a las ${v.time} hs</div>
        ${v.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">Detalles: ${v.notes}</div>` : ''}
        
        <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
          <button class="btn btn-primary" id="btn-complete-visit" style="flex: 1; min-block-size: auto; padding: 0.4rem; font-size: 0.75rem;">Visita Realizada</button>
          <button class="btn btn-secondary" id="btn-reprogram-visit" style="flex: 1; min-block-size: auto; padding: 0.4rem; font-size: 0.75rem;">Reprogramar</button>
          <a href="${getWhatsAppUrl(client, 'visit')}" target="_blank" class="btn btn-secondary btn-whatsapp" style="min-block-size: auto; padding: 0.4rem; font-size: 0.75rem; border-color: var(--text-whatsapp); color: var(--text-whatsapp); display: inline-flex; align-items: center; justify-content: center; width: 38px;" title="Confirmar cita por WhatsApp">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </a>
        </div>
      </div>
    `;
  }

  panelBody.innerHTML = `
    <div class="detail-client-info">
      <div class="detail-header-card">
        <h3 class="detail-name">${client.name} ${client.surname}</h3>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">${client.equipments.length} Equipo(s) Registrado(s)</span>
          ${client.totalDebt > 0 ? `<span class="badge badge-debt">⚠️ Debe $${client.totalDebt.toFixed(2)}</span>` : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Teléfono</span>
          <span class="detail-value">${client.phone}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Dirección</span>
          <span class="detail-value">${client.address || 'No registrada'}</span>
        </div>
        
        <div class="detail-item full-width" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem;">
          <span class="detail-label">Equipos del Cliente</span>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${eqListHtml}
          </div>
        </div>

        <!-- Renderizar Cita Programada -->
        ${client.scheduledVisit ? `
        <div class="detail-item full-width">
          ${scheduledVisitHtml}
        </div>
        ` : ''}

        <div class="detail-item" style="margin-top: 0.5rem;">
          <span class="detail-label" style="color: ${statusCssColor}">Próximo Servicio Recomendado (Urgente)</span>
          <span class="detail-value" style="color: ${statusCssColor}; font-weight: 800;">${formatDate(earliestEq.nextDate)} (${earliestEq.brand})</span>
        </div>
        ${client.notes ? `
        <div class="detail-item full-width">
          <span class="detail-label">Notas Especiales</span>
          <span class="detail-value" style="font-style: italic;">${client.notes}</span>
        </div>
        ` : ''}
      </div>

      <!-- Acciones de Ficha -->
      <div class="card-actions" style="margin-top: 0.5rem; justify-content: stretch; flex-wrap: wrap;">
        ${client.totalDebt > 0 ? `
        <button class="btn btn-primary btn-full bg-receivables-subtle text-receivables" id="btn-detail-add-payment" style="flex: 1 1 100%; border-color: var(--receivables-color); margin-bottom: 0.5rem;">
          💵 Registrar Pago (Debe $${client.totalDebt.toFixed(2)})
        </button>
        <a href="${getWhatsAppUrl(client, 'debt')}" target="_blank" class="btn btn-secondary btn-whatsapp btn-full" style="flex: 1 1 100%; border-color: var(--receivables-color); color: var(--receivables-color); margin-bottom: 0.5rem;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Recordatorio de Cobro (WhatsApp)
        </a>
        ` : ''}
        <a href="${getWhatsAppUrl(client, 'maintenance')}" target="_blank" class="btn btn-secondary btn-whatsapp btn-full" style="flex: 1 1 100%; border-color: var(--text-whatsapp);">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Recordatorio Mantenimiento (WhatsApp)
        </a>
        <button class="btn btn-primary" id="btn-detail-add-service" style="flex: 1 1 45%;">Registrar Visita</button>
        <button class="btn btn-secondary" id="btn-detail-edit" style="flex: 1 1 45%;">Editar Ficha</button>
        <button class="btn btn-secondary text-danger" id="btn-detail-delete" style="flex: 1 1 100%;">Eliminar Cliente</button>
      </div>
    </div>

    <!-- Historial -->
    <div class="detail-history-section">
      <h3 class="detail-section-title">Historial de Mantenimientos y Pagos</h3>
      
      <div class="timeline">
        ${clientHistory.length === 0 ? `
          <div class="timeline-empty">Sin servicios registrados. Haz clic en "Registrar Visita" para añadir uno.</div>
        ` : clientHistory.map(record => `
          <div class="timeline-item">
            <div class="timeline-dot" style="${record.isPayment ? 'background-color: var(--receivables-color);' : ''}"></div>
            <div class="timeline-header">
              <span class="timeline-date">${formatDate(record.date)}</span>
            </div>
            <div class="timeline-body">
              ${record.isPayment ? `
                <div style="font-size: 0.72rem; font-weight: 700; color: var(--receivables-color); margin-bottom: 2px;">
                  💵 ${record.equipmentName || 'Abono'}
                </div>
                <p>${record.description}</p>
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--receivables-color); margin-top: 4px;">
                  Monto Recibido: $${(record.amountPaid || 0).toFixed(2)}
                </div>
              ` : `
                <div style="font-size: 0.72rem; font-weight: 700; color: var(--primary); margin-bottom: 2px;">
                  Servicio a: ${record.equipmentName || 'Equipo General'}
                </div>
                <p>${record.description}</p>
                ${record.technicianNotes ? `<p class="timeline-obs"><strong>Observación:</strong> ${record.technicianNotes}</p>` : ''}
                ${(record.price || 0) > 0 ? `
                  <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                    <span>Costo: $${record.price.toFixed(2)}</span>
                    <span style="color: var(--status-ok-text)">Pagado: $${record.amountPaid.toFixed(2)}</span>
                    ${record.debt > 0 ? `
                      <span style="color: var(--status-overdue-text); font-weight: 700;">Debe: $${record.debt.toFixed(2)}</span>
                      ${record.paymentPromiseDate ? `<span style="color: var(--receivables-color)">Promesa: ${formatDate(record.paymentPromiseDate)}</span>` : ''}
                    ` : ''}
                  </div>
                ` : ''}
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Registrar eventos citas programadas
  if (client.scheduledVisit) {
    document.getElementById('btn-complete-visit').addEventListener('click', () => {
      completingVisitClientId = client.id;
      openMaintenanceModal(client.id);
    });

    document.getElementById('btn-reprogram-visit').addEventListener('click', () => {
      openEditClientModal(client);
    });
  }

  // Evento Registrar Pago si aplica
  if (client.totalDebt > 0) {
    document.getElementById('btn-detail-add-payment').addEventListener('click', () => {
      openPaymentModal(client.id);
    });
  }

  document.getElementById('btn-detail-add-service').addEventListener('click', () => {
    openMaintenanceModal(client.id);
  });

  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    openEditClientModal(client);
  });

  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    confirmDeleteClient(client.id);
  });

  // Eventos para botones de WhatsApp específicos de equipo
  document.querySelectorAll('.btn-whatsapp-eq-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const eqId = btn.getAttribute('data-eq-id');
      openWhatsAppSelector(client.id, eqId);
    });
  });

  detailPanel.hidden = false;
  setTimeout(() => {
    detailPanel.classList.add('open');
  }, 10);
}

function closeDetailPanel() {
  const detailPanel = document.getElementById('client-detail-panel');
  detailPanel.classList.remove('open');
  state.selectedClientId = null;
  document.querySelectorAll('.client-card').forEach(card => card.classList.remove('selected'));
  
  setTimeout(() => {
    if (!state.selectedClientId) {
      detailPanel.hidden = true;
    }
  }, 300);
}

// Abrir modal de registrar mantenimiento
function openMaintenanceModal(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  document.getElementById('maintenance-client-id').value = clientId;
  document.getElementById('maintenance-client-name').textContent = `${client.name} ${client.surname}`;
  
  const select = document.getElementById('maintenance-equipment-select');
  select.innerHTML = '';
  
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = `Todos los equipos (${client.equipments.length})`;
  select.appendChild(allOpt);

  client.equipments.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq.id;
    opt.textContent = `${EQUIPMENT_LABELS[eq.type]} - ${eq.brand}`;
    select.appendChild(opt);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('maintenance-date').value = todayStr;
  document.getElementById('maintenance-next-interval').value = 6;
  
  // Si venimos de completar una cita programada, rellenar la descripción
  if (completingVisitClientId === clientId && client.scheduledVisit) {
    document.getElementById('maintenance-desc').value = `Servicio realizado con motivo de cita programada: ${VISIT_REASON_LABELS[client.scheduledVisit.reason]}. ${client.scheduledVisit.notes || ''}`;
  } else {
    document.getElementById('maintenance-desc').value = '';
  }
  document.getElementById('maintenance-notes').value = '';

  // Inicializar inputs de cobro
  document.getElementById('maintenance-price').value = '0.00';
  document.getElementById('maintenance-paid').value = '0.00';
  updateMaintenanceDebt();

  document.getElementById('maintenance-dialog').showModal();
}

// Abrir modal de edición
function openEditClientModal(client) {
  document.getElementById('client-id').value = client.id;
  document.getElementById('client-name').value = client.name;
  document.getElementById('client-surname').value = client.surname;
  document.getElementById('client-phone').value = client.phone;
  document.getElementById('client-address').value = client.address || '';
  document.getElementById('client-notes').value = client.notes || '';

  // Rellenar cita si existe
  if (client.scheduledVisit) {
    document.getElementById('client-visit-date').value = client.scheduledVisit.date;
    document.getElementById('client-visit-time').value = client.scheduledVisit.time;
    document.getElementById('client-visit-reason').value = client.scheduledVisit.reason;
    document.getElementById('client-visit-notes').value = client.scheduledVisit.notes || '';
  } else {
    document.getElementById('client-visit-date').value = '';
    document.getElementById('client-visit-time').value = '';
    document.getElementById('client-visit-reason').value = '';
    document.getElementById('client-visit-notes').value = '';
  }

  // Rellenar equipos
  const container = document.getElementById('equipments-form-container');
  container.innerHTML = '';
  client.equipments.forEach(eq => {
    addEquipmentRowField(eq);
  });

  document.getElementById('client-dialog-title').textContent = 'Editar Cliente';
  document.getElementById('client-dialog').showModal();
}

// Eliminar cliente
function confirmDeleteClient(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente a ${client.name} ${client.surname}? Se borrarán todos sus equipos e historial.`;
  if (confirm(confirmMsg)) {
    state.clients = state.clients.filter(c => c.id !== clientId);
    state.history = state.history.filter(h => h.clientId !== clientId);
    
    saveToLocalStorage();
    closeDetailPanel();
    renderApp();
  }
}

// --- 10. WhatsApp Link Builder ---
function getWhatsAppUrl(client, type = 'maintenance', targetId = null) {
  const rawPhone = client.phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
  let cleanPhone = rawPhone;
  if (rawPhone.length === 10 || rawPhone.length === 11) {
    if (rawPhone.startsWith('0')) {
      cleanPhone = '58' + rawPhone.substring(1);
    } else {
      cleanPhone = '58' + rawPhone;
    }
  }

  let message = '';

  if (type === 'debt') {
    // 1. Recordatorio de Cobro (Deuda)
    const debtRecords = state.history
      .filter(h => h.clientId === client.id && h.debt > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let eqMention = '';
    let promiseMention = '';
    if (debtRecords.length > 0) {
      const rec = debtRecords[0];
      eqMention = ` por el servicio realizado a su equipo *${rec.equipmentName || 'registrado'}*`;
      if (rec.paymentPromiseDate) {
        promiseMention = ` (pautada para el ${formatDate(rec.paymentPromiseDate)})`;
      }
    }

    message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ Esperamos que se encuentre bien. Le escribimos para recordarle amablemente que posee un saldo pendiente de *$${client.totalDebt.toFixed(2)}*${eqMention}.
    
La fecha promesa de pago estaba agendada para el${promiseMention || ' día acordado'}.

¿Podría indicarnos cuándo podríamos pasar a recibir el pago, o si prefiere que le enviemos los datos para una transferencia bancaria o pago móvil?

*¡Muchas gracias por su confianza y preferencia!*`;

  } else if (type === 'visit') {
    // 2. Recordatorio de Cita Programada (Revisiones, Instalaciones, Reparaciones)
    if (client.scheduledVisit) {
      const visit = client.scheduledVisit;
      const reasonText = VISIT_REASON_LABELS[visit.reason] || visit.reason;
      
      message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ Le escribimos para confirmar y recordarle la visita técnica programada para:
      
📅 *Fecha:* ${formatDate(visit.date)}
⏰ *Hora aprox:* ${visit.time} hs
📝 *Motivo:* ${reasonText}
${visit.notes ? `💬 *Detalle:* ${visit.notes}\n` : ''}
Agradecemos nos confirme si se mantiene la cita para coordinar la ruta de nuestros técnicos.

*¡Climatízate con nosotros!*`;
    } else {
      message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ ¿Cómo se encuentra? Nos gustaría saber si requiere agendar alguna visita o servicio de mantenimiento para sus equipos.`;
    }

  } else {
    // 3. Recordatorio de Mantenimiento Preventivo (por defecto)
    let eq = null;
    if (targetId) {
      eq = client.equipments.find(e => e.id === targetId);
    }
    
    // Si no se especifica el equipo, usar el más urgente (próximo mantenimiento)
    if (!eq) {
      eq = getEarliestMaintenanceEquipment(client);
    }

    const eqLabel = eq.type === 'split' ? 'Aire Acondicionado Split ❄️' : (eq.type === 'ventana' ? 'Aire Acondicionado de Ventana 🔲' : (eq.type === 'nevera' ? 'Nevera 🥛' : 'Freezer/Fricer 🧊'));
    const equipmentStr = `su *${eqLabel} (${eq.brand})* para el día *${formatDate(eq.nextDate)}*`;

    message = `Hola *${client.name} ${client.surname}*, le saluda el equipo de *Multiservicios ClimaCold*. ❄️ Le escribimos para recordarle que ya le corresponde el mantenimiento preventivo de ${equipmentStr}.

Mantener sus equipos limpios optimiza el consumo eléctrico y alarga la vida útil de su motor.

¿Le gustaría coordinar una visita técnica para esta semana?

*¡Climatízate con nosotros!*`;
  }

  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}

// --- 11. Motor de Notificaciones Nativas del Navegador ---

function initNotifications() {
  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones de escritorio");
    return;
  }

  updateNotificationButtonState();
}

function updateNotificationButtonState() {
  const btn = document.getElementById('btn-request-notifications');
  if (Notification.permission === 'default') {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

function requestNotificationPermissions() {
  if (!("Notification" in window)) return;
  
  Notification.requestPermission().then(permission => {
    updateNotificationButtonState();
    if (permission === "granted") {
      new Notification("ClimaCold Alertas Activas", {
        body: "¡Listo! Te notificaremos un día antes a las 6pm y el mismo día a las 6am de tus citas y mantenimientos.",
        icon: "favicon.ico"
      });
    }
  });
}

// Verifica fechas y envía alertas del navegador
function checkAndSendNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = offsetDate(now, 1);
  const currentHour = now.getHours();

  // Cargar registro de alertas ya enviadas para no repetir
  let sentNotifications = {};
  const localSent = localStorage.getItem('climacold_notifications_sent');
  if (localSent) {
    sentNotifications = JSON.parse(localSent);
  }

  // Bandera para saber si guardamos de vuelta en localStorage
  let updatedSent = false;

  state.clients.forEach(client => {
    // 1. Verificar notificaciones para Mantenimientos Preventivos
    client.equipments.forEach(eq => {
      const eqLabel = `${EQUIPMENT_LABELS[eq.type]} (${eq.brand})`;
      
      // REGLA 1: 1 día antes a las 6:00 PM (18:00 hs)
      if (eq.nextDate === tomorrowStr && currentHour >= 18) {
        const key = `eq-tomorrow-${client.id}-${eq.id}`;
        if (!sentNotifications[key]) {
          sendBrowserNotification(
            "Recordatorio de Mantenimiento Mañana ❄️",
            `Mañana le corresponde servicio al equipo "${eqLabel}" de ${client.name} ${client.surname}.`
          );
          sentNotifications[key] = true;
          updatedSent = true;
        }
      }

      // REGLA 2: El mismo día a las 6:00 AM (6:00 hs)
      if (eq.nextDate === todayStr && currentHour >= 6) {
        const key = `eq-today-${client.id}-${eq.id}`;
        if (!sentNotifications[key]) {
          sendBrowserNotification(
            "Mantenimiento Programado Hoy 🔧",
            `Hoy le corresponde mantenimiento al equipo "${eqLabel}" de ${client.name} ${client.surname}.`
          );
          sentNotifications[key] = true;
          updatedSent = true;
        }
      }
    });

    // 2. Verificar notificaciones para Citas Programadas (Revisiones, Reparaciones)
    if (client.scheduledVisit) {
      const visit = client.scheduledVisit;
      const reasonLabel = VISIT_REASON_LABELS[visit.reason] || 'Visita';
      
      // REGLA 1: Cita un día antes a las 6:00 PM (18:00 hs)
      if (visit.date === tomorrowStr && currentHour >= 18) {
        const key = `visit-tomorrow-${client.id}-${visit.date}`;
        if (!sentNotifications[key]) {
          sendBrowserNotification(
            `Cita Mañana: ${reasonLabel} 📅`,
            `Mañana tienes cita con ${client.name} ${client.surname} a las ${visit.time} hs.`
          );
          sentNotifications[key] = true;
          updatedSent = true;
        }
      }

      // REGLA 2: Cita el mismo día a las 6:00 AM (6:00 hs)
      if (visit.date === todayStr && currentHour >= 6) {
        const key = `visit-today-${client.id}-${visit.date}`;
        if (!sentNotifications[key]) {
          sendBrowserNotification(
            `Cita Hoy a las ${visit.time} hs 📅`,
            `Hoy corresponde: ${reasonLabel} para ${client.name} ${client.surname} (${visit.notes || 'Sin detalles'}).`
          );
          sentNotifications[key] = true;
          updatedSent = true;
        }
      }
    }

    // 3. Verificar notificaciones para Promesas de Pago (Deudas)
    if (client.totalDebt > 0) {
      const recordsWithPromise = state.history
        .filter(h => h.clientId === client.id && h.paymentPromiseDate && h.debt > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (recordsWithPromise.length > 0) {
        const record = recordsWithPromise[0];
        const promiseDate = record.paymentPromiseDate;

        // REGLA 1: Un día antes a las 6:00 PM (18:00 hs)
        if (promiseDate === tomorrowStr && currentHour >= 18) {
          const key = `cobro-tomorrow-${client.id}-${promiseDate}`;
          if (!sentNotifications[key]) {
            sendBrowserNotification(
              "Cobro Pendiente Mañana 💰",
              `${client.name} ${client.surname} debe $${client.totalDebt.toFixed(2)} mañana (Promesa de pago).`
            );
            sentNotifications[key] = true;
            updatedSent = true;
          }
        }

        // REGLA 2: El mismo día a las 6:00 AM (6:00 hs)
        if (promiseDate === todayStr && currentHour >= 6) {
          const key = `cobro-today-${client.id}-${promiseDate}`;
          if (!sentNotifications[key]) {
            sendBrowserNotification(
              "Cobro Pendiente Hoy 💰",
              `${client.name} ${client.surname} debe $${client.totalDebt.toFixed(2)} hoy (Promesa de pago).`
            );
            sentNotifications[key] = true;
            updatedSent = true;
          }
        }
      }
    }
  });

  if (updatedSent) {
    localStorage.setItem('climacold_notifications_sent', JSON.stringify(sentNotifications));
  }
}

function sendBrowserNotification(title, body) {
  try {
    new Notification(title, {
      body: body,
      icon: "favicon.ico"
    });
  } catch (err) {
    console.error("Error al enviar notificación:", err);
  }
}

// --- 12. Importación y Exportación de Respaldos (Backup) ---

function exportBackup() {
  const backupData = {
    clients: state.clients,
    history: state.history,
    exportedAt: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `climacold_respaldo_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  document.getElementById('backup-dialog').close();
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedData = JSON.parse(event.target.result);
      
      if (Array.isArray(importedData.clients) && Array.isArray(importedData.history)) {
        if (confirm('¿Estás seguro de importar este archivo? Se reemplazarán todos tus clientes y mantenimientos actuales.')) {
          state.clients = importedData.clients;
          state.history = importedData.history;
          
          migrateDataSchema(); 
          recalculateAllDebts();
          saveToLocalStorage();
          closeDetailPanel();
          renderApp();
          
          alert('¡Importación completada con éxito!');
          document.getElementById('backup-dialog').close();
        }
      } else {
        alert('El archivo seleccionado no tiene el formato de respaldo válido de ClimaCold.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al leer el archivo. Asegúrate de seleccionar un archivo JSON válido.');
    }
  };
  
  reader.readAsText(file);
  e.target.value = '';
}

function resetDemoData() {
  if (confirm('¿Estás seguro de que deseas restablecer la aplicación con los datos de demostración? Se perderán todos tus datos actuales.')) {
    const mock = generateMockData();
    state.clients = mock.clients;
    state.history = mock.history;
    
    // Limpiar también log de notificaciones enviadas al reiniciar demo
    localStorage.removeItem('climacold_notifications_sent');
    
    saveToLocalStorage();
    closeDetailPanel();
    renderApp();
    alert('¡Datos de demostración restablecidos con éxito!');
    document.getElementById('backup-dialog').close();
  }
}
