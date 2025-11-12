// --- 1. CONEXIÓN CON SUPABASE ---
const SUPABASE_URL = 'https://ucqeciuhyuhbbpzngaxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcWVjaXVoeXVoYmJwem5nYXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzgzMDksImV4cCI6MjA3ODExNDMwOX0.KjmL3qKs0uLe0eNag82vejMTORlfQJFQhK492oDVHZE'; // Clave Anon (Pública)

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase conectado (Admin):', client);

let currentUser = null;
let allSolicitudes = []; // Guardaremos todas las solicitudes aquí

// ===========================================
// --- 4. LLAMAR A LAS FUNCIONES AL CARGAR ---
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    inicializarRespuestaModal();
    inicializarCustomAlert(); // Asegúrate de que la alerta funcione
});

// ===========================================
// --- LÓGICA DE ADMINISTRADOR ---
// ===========================================

async function inicializarAdmin() {
    // 1. Verificar sesión del usuario
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
        console.log("No hay usuario logueado. Redirigiendo a login.");
        // Guardar intención de ir al admin
        localStorage.setItem('redirectAfterLogin', 'admin.html');
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
    console.log("¡Bienvenido Admin!", currentUser.email);
    document.getElementById('admin-user-info').innerHTML = `<i class="fas fa-user-shield"></i> Admin: ${user.user_metadata?.username || user.email}`;
    
    await cargarTodasLasSolicitudes();
}

async function cargarTodasLasSolicitudes() {
    const container = document.getElementById('admin-solicitudes-container');
    container.innerHTML = '<p>Cargando todas las solicitudes...</p>';

    // Consultamos Solicitudes y traemos las Respuestas anidadas
    const { data, error } = await client
        .from('Solicitudes')
        .select(`
            *,
            Respuestas (
                *
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando solicitudes:', error);
        container.innerHTML = `<p style="text-align:center;">Error al cargar las solicitudes: ${error.message}</p>`;
        return;
    }

    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;">No hay ninguna solicitud creada.</p>';
        return;
    }

    allSolicitudes = data; // Guardamos los datos globalmente
    renderAdminSolicitudes(allSolicitudes);
}

function renderAdminSolicitudes(solicitudes) {
    const container = document.getElementById('admin-solicitudes-container');
    container.innerHTML = ''; // Limpiar "cargando..."

    solicitudes.forEach(solicitud => {
        const fecha = new Date(solicitud.created_at).toLocaleDateString('es-CL');
        
        let respuestasHTML = '';
        if (solicitud.Respuestas.length > 0) {
            solicitud.Respuestas.forEach(respuesta => {
                respuestasHTML += `
                    <div class="respuesta-item respuesta-admin">
                        <strong>Soporte MiTienda (Tú):</strong>
                        <p>${respuesta.cuerpo}</p>
                    </div>
                `;
            });
        }

        const solicitudHTML = `
            <div class="solicitud-item">
                <div class="solicitud-header">
                    <span class="solicitud-tipo">${solicitud.tipo_solicitud}</span>
                    <span class="solicitud-estado estado-${solicitud.estado}">${solicitud.estado}</span>
                    <span class="solicitud-fecha">${fecha}</span>
                </div>
                <div class="solicitud-body">
                    <p><strong>De:</strong> ${solicitud.email} (RUT: ${solicitud.rut})</p>
                    <p><strong>Comentario:</strong> ${solicitud.comentarios || 'No hay comentarios.'}</p>
                    ${solicitud.imagen_url ? `<a href="${solicitud.imagen_url}" target="_blank" class="solicitud-imagen-link"><img src="${solicitud.imagen_url}" alt="Imagen Adjunta" class="solicitud-imagen-preview"></a>` : ''}
                </div>
                <div class="comentarios-section">
                    ${respuestasHTML || '<p class="sin-respuesta">Aún no hay respuestas de soporte.</p>'}
                </div>
                
                <div class="admin-actions">
                    <button class="modal-button secondary" onclick="abrirModalRespuesta(${solicitud.id})">
                        <i class="fas fa-reply"></i> Responder
                    </button>
                    ${solicitud.estado === 'pendiente' ? 
                        `<button class="modal-button" onclick="marcarComoCerrada(${solicitud.id})">Marcar como Cerrada</button>` : 
                        `<button class="modal-button" onclick="marcarComoPendiente(${solicitud.id})">Marcar como Pendiente</button>`
                    }
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', solicitudHTML);
    });
}

// ===========================================
// --- LÓGICA DEL MODAL DE RESPUESTA ---
// ===========================================

const respuestaModalOverlay = document.getElementById('respuesta-modal-overlay');
const respuestaModalCloseBtn = document.getElementById('respuesta-modal-close');
const respuestaForm = document.getElementById('respuesta-form');
const respuestaSubmitBtn = document.getElementById('respuesta-submit-btn');

function inicializarRespuestaModal() {
    if (!respuestaModalOverlay) return;

    respuestaModalCloseBtn.addEventListener('click', () => {
        respuestaModalOverlay.classList.remove('open');
    });
    respuestaModalOverlay.addEventListener('click', (e) => {
        if (e.target === respuestaModalOverlay) {
            respuestaModalOverlay.classList.remove('open');
        }
    });

    respuestaForm.addEventListener('submit', handleRespuestaSubmit);
}

function abrirModalRespuesta(solicitudId) {
    // Buscar la solicitud en los datos que ya cargamos
    const solicitud = allSolicitudes.find(s => s.id === solicitudId);
    if (!solicitud) {
        alert("Error: No se encontró la solicitud.");
        return;
    }

    // Rellenar el formulario
    document.getElementById('respuesta-solicitud-id').value = solicitud.id;
    document.getElementById('respuesta-email').value = solicitud.email;
    document.getElementById('respuesta-comentario-cliente').value = solicitud.comentarios;
    document.getElementById('respuesta-cuerpo').value = ''; // Limpiar respuesta anterior

    respuestaModalOverlay.classList.add('open');
}

async function handleRespuestaSubmit(e) {
    e.preventDefault();
    respuestaSubmitBtn.disabled = true;
    respuestaSubmitBtn.textContent = "Enviando...";

    const solicitudId = document.getElementById('respuesta-solicitud-id').value;
    const cuerpoRespuesta = document.getElementById('respuesta-cuerpo').value;

    // 1. Insertar la respuesta en la tabla 'Respuestas'
    const { error: insertError } = await client
        .from('Respuestas')
        .insert({
            solicitud_id: solicitudId,
            user_id: currentUser.id, // El ID del admin
            cuerpo: cuerpoRespuesta
        });

    if (insertError) {
        console.error('Error al guardar respuesta:', insertError);
        showCustomAlert('Error', 'No se pudo guardar la respuesta.', 'error');
        respuestaSubmitBtn.disabled = false;
        respuestaSubmitBtn.textContent = "Enviar Respuesta";
        return;
    }

    // 2. Actualizar el estado de la solicitud original a 'respondido'
    const { error: updateError } = await client
        .from('Solicitudes')
        .update({ estado: 'respondido' })
        .eq('id', solicitudId);

    if (updateError) {
        console.error('Error al actualizar estado:', updateError);
        showCustomAlert('Error', 'Se guardó la respuesta, pero no se pudo actualizar el estado.', 'error');
    } else {
        showCustomAlert('¡Enviado!', 'Respuesta enviada y solicitud marcada como respondida.', 'success');
    }

    // 3. Recargar todo
    respuestaModalOverlay.classList.remove('open');
    respuestaSubmitBtn.disabled = false;
    respuestaSubmitBtn.textContent = "Enviar Respuesta";
    await cargarTodasLasSolicitudes(); // Recarga la lista
}

// --- Funciones para cambiar estado ---

async function marcarComoCerrada(solicitudId) {
    const { error } = await client
        .from('Solicitudes')
        .update({ estado: 'cerrado' })
        .eq('id', solicitudId);
    
    if (error) {
        showCustomAlert('Error', 'No se pudo actualizar el estado.', 'error');
    } else {
        await cargarTodasLasSolicitudes(); // Recarga la lista
    }
}

async function marcarComoPendiente(solicitudId) {
    const { error } = await client
        .from('Solicitudes')
        .update({ estado: 'pendiente' })
        .eq('id', solicitudId);
    
    if (error) {
        showCustomAlert('Error', 'No se pudo actualizar el estado.', 'error');
    } else {
        await cargarTodasLasSolicitudes(); // Recarga la lista
    }
}


// ==================================================
// --- 10. CUSTOM ALERT MODAL (Copiado de app.js) ---
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