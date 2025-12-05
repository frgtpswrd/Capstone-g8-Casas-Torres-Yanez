// --- 1. CONEXIÓN CON SUPABASE ---
const SUPABASE_URL = 'https://ucqeciuhyuhbbpzngaxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcWVjaXVoeXVoYmJwem5nYXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzgzMDksImV4cCI6MjA3ODExNDMwOX0.KjmL3qKs0uLe0eNag82vejMTORlfQJFQhK492oDVHZE'; // Clave Anon (Pública)

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase conectado (Dashboard):', client);

let currentUser = null;

// ===========================================
// --- 4. LLAMAR A LAS FUNCIONES AL CARGAR ---
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarDashboard();
    inicializarCustomAlert();
});

// ===========================================
// --- LÓGICA DEL DASHBOARD ---
// ===========================================

async function inicializarDashboard() {
    // 1. Verificar sesión del usuario
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
        console.log("No hay usuario logueado. Redirigiendo a login.");
        localStorage.setItem('redirectAfterLogin', 'dashboard.html');
        window.location.href = 'index.html?action=login';
        return;
    }

    // 2. Verificar si el usuario es "admin"
    const userRole = user.user_metadata?.role;
    if (userRole !== 'admin') {
        console.error("Acceso denegado. El usuario no es admin.");
        alert("Acceso denegado. Debes ser administrador para ver esta página.");
        window.location.href = 'index.html';
        return;
    }

    // 3. Si es admin, cargar todo
    currentUser = user;
    console.log("¡Bienvenido Admin al Dashboard!", currentUser.email);
    document.getElementById('admin-user-info').innerHTML = `<i class="fas fa-user-shield"></i> Admin: ${user.user_metadata?.username || user.email}`;
    
    await fetchDashboardData();
}

async function fetchDashboardData() {
    try {
        // Usamos una sola consulta para traer todos los datos
        const { data, error } = await client
            .from('Solicitudes')
            .select('estado, tipo_solicitud');

        if (error) throw error;

        // Procesar los datos
        const total = data.length;
        let pendientes = 0;
        let cerrados = 0;
        const tipos = {};
        const estados = {};

        data.forEach(solicitud => {
            // Contar estados
            const estado = solicitud.estado || 'desconocido';
            estados[estado] = (estados[estado] || 0) + 1;
            
            if (estado === 'pendiente') {
                pendientes++;
            } else {
                cerrados++; // Incluye 'respondido' y 'cerrado'
            }
            
            // Contar tipos
            const tipo = solicitud.tipo_solicitud || 'Otro';
            tipos[tipo] = (tipos[tipo] || 0) + 1;
        });

        // Renderizar todo
        renderKpis(total, pendientes, cerrados);
        renderStatusChart(estados);
        renderTypeChart(tipos);

    } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
        document.getElementById('kpi-container').innerHTML = `<p>Error al cargar datos.</p>`;
    }
}

function renderKpis(total, pendientes, cerrados) {
    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-pendiente').textContent = pendientes;
    document.getElementById('kpi-cerrado').textContent = cerrados;
}

function renderStatusChart(estadosData) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const labels = Object.keys(estadosData);
    const counts = Object.values(estadosData);

    new Chart(ctx, {
        type: 'bar', // Gráfico de Barras
        data: {
            labels: labels,
            datasets: [{
                label: 'N° de Solicitudes',
                data: counts,
                backgroundColor: [
                    'rgba(255, 206, 86, 0.6)', // Pendiente (Amarillo)
                    'rgba(75, 192, 192, 0.6)', // Respondido (Verde)
                    'rgba(255, 99, 132, 0.6)'  // Cerrado (Rojo)
                ],
                borderColor: [
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Asegura que solo muestre números enteros
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // No necesitamos leyenda para un solo set de datos
                }
            }
        }
    });
}

function renderTypeChart(tiposData) {
    const ctx = document.getElementById('typeChart').getContext('2d');
    const labels = Object.keys(tiposData);
    const counts = Object.values(tiposData);

    new Chart(ctx, {
        type: 'doughnut', // Gráfico de Dona
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)'
                ],
                hoverOffset: 4
            }]
        }
    });
}


// ==================================================
// --- 10. CUSTOM ALERT MODAL (Copiado de admin.js) ---
// ==================================================
const alertModal = document.getElementById('custom-alert-modal');
const alertContent = alertModal.querySelector('.alert-modal-content');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const alertIconSuccess = document.getElementById('alert-icon-success');
const alertIconError = document.getElementById('alert-icon-error');
const alertIconInfo = document.getElementById('alert-icon-info');

function showCustomAlert(title, message, type = 'info') {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertContent.classList.remove('success', 'error', 'info');
    alertIconSuccess.style.display = 'none';
    alertIconError.style.display = 'none';
    alertIconInfo.style.display = 'none';
    if (type === 'success') {
        alertContent.classList.add('success');
        alertIconSuccess.style.display = 'block';
    } else if (type === 'error') {
        alertContent.classList.add('error');
        alertIconError.style.display = 'block';
    } else {
        alertContent.classList.add('info');
        alertIconInfo.style.display = 'block';
    }
    alertModal.classList.add('open');
}
function inicializarCustomAlert() {
    if (!alertModal) return;
    alertOkBtn.addEventListener('click', () => {
        alertModal.classList.remove('open');
    });
    alertModal.addEventListener('click', (e) => {
        if (e.target === alertModal) {
            alertModal.classList.remove('open');
        }
    });
}