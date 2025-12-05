// --- 1. CONEXIÓN CON SUPABASE ---
const SUPABASE_URL = 'https://ucqeciuhyuhbbpzngaxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcWVjaXVoeXVoYmJwem5nYXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzgzMDksImV4cCI6MjA3ODExNDMwOX0.KjmL3qKs0uLe0eNag82vejMTORlfQJFQhK492oDVHZE'; // ESTA ES TU CLAVE PÚBLICA (ANON)

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase conectado:', client);

// --- VARIABLES GLOBALES ---
let carrito = []; // AHORA SERÁ: [{...producto, quantity: 1}, ...]
let productosGlobales = []; // Esta variable es clave para el filtro
let chatHistory = []; 
let currentUser = null; 

// =======================================================
// --- SECCIÓN DE PRODUCTOS Y CATEGORÍAS (MODIFICADA) ---
// =======================================================

// --- 2. FUNCIÓN PARA OBTENER PRODUCTOS (MODIFICADA) ---
async function obtenerProductos() {
    console.log('Obteniendo productos...');
    const productGrid = document.querySelector('.product-grid');
    // Si no existe, estamos en otra página (ej. mis-solicitudes), así que salimos.
    if (!productGrid) return; 
    
    productGrid.innerHTML = `<p>Cargando productos...</p>`;

    const { data: productos, error } = await client
        .from('Productos') 
        .select('*');

    if (error) {
        console.error('Error al obtener productos:', error);
        productGrid.innerHTML = `<p>Error al cargar productos. Revisa la consola para más detalles.</p>`;
        return;
    }

    console.log('Productos obtenidos:', productos);
    productosGlobales = productos;
    renderizarProductos(productosGlobales); // Llama a la función de renderizado
}

// --- 3. FUNCIÓN PARA "DIBUJAR" PRODUCTOS (CORREGIDA) ---
function renderizarProductos(productosAMostrar) {
    const productGrid = document.querySelector('.product-grid');
    if (!productGrid) return; // Seguridad
    productGrid.innerHTML = ''; 

    if (productosAMostrar.length === 0) {
        productGrid.innerHTML = `<p style="text-align:center;">No se encontraron productos.</p>`;
        return;
    }

    productosAMostrar.forEach(producto => {
        // Obtenemos la cantidad actual ANTES de dibujar
        const cantidadEnCarrito = getQuantityInCart(producto.id);

        const tarjetaHTML = `
            <div class="product-card">
                <div class="product-card-info"> 
                    <img src="${producto.imagen_url}" alt="${producto.nombre}">
                    <h3>${producto.nombre}</h3>
                    <p class="price">$${producto.precio.toLocaleString('es-CL')}</p>
                    <p class="stock">Stock disponible: ${producto.stock || 0}</p> 
                </div>
                
                <div class="product-card-actions" id="actions-${producto.id}">
                    ${generarHtmlBoton(producto.id, cantidadEnCarrito)}
                </div>
            </div>
        `;
        productGrid.insertAdjacentHTML('beforeend', tarjetaHTML);
    });
}

// --- 4. FUNCIÓN PARA FILTRAR PRODUCTOS (¡AHORA LA USA EL NAV Y LAS CATEGORÍAS!) ---
function filtrarPorCategoria(categoriaId, categoriaNombre) {
    // Si estamos en la página de solicitudes, redirigir al index
    if (!document.getElementById('product-grid-title')) {
        // Usamos un hash simple para que el index.html sepa qué filtrar (a futuro)
        // Por ahora, solo lo redirige a la página principal.
        window.location.href = `index.html`; 
        return;
    }
    
    console.log("Filtrando por:", categoriaNombre);
    const tituloProductos = document.getElementById('product-grid-title');
    if (tituloProductos) {
        tituloProductos.textContent = `Mostrando: ${categoriaNombre}`;
    }

    if (categoriaId === 0) {
        renderizarProductos(productosGlobales); 
        return;
    }

    const productosFiltrados = productosGlobales.filter(producto => producto.categoria_id === categoriaId);
    renderizarProductos(productosFiltrados);
}

// =======================================================
// --- 5. NUEVA LÓGICA DE BÚSQUEDA ---
// =======================================================

function inicializarBusqueda() {
    const searchBtn = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');

    if (!searchBtn || !searchInput) return; // No estamos en una pág. con búsqueda

    searchBtn.addEventListener('click', handleSearch);
    
    // Buscar al presionar "Enter"
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

function handleSearch() {
    // Si estamos en otra página, la búsqueda redirige al index
    if (!document.getElementById('product-grid-title')) {
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
        window.location.href = `index.html?search=${searchTerm}`;
        return;
    }

    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    if (searchTerm === "") {
        filtrarPorCategoria(0, 'Todos los Productos');
        return;
    }

    const productosFiltrados = productosGlobales.filter(producto => 
        producto.nombre.toLowerCase().includes(searchTerm)
    );
    
    document.getElementById('product-grid-title').textContent = `Resultados para: "${searchTerm}"`;
    renderizarProductos(productosFiltrados);
}


// =======================================================
// --- 6. LÓGICA DEL CARRITO (TOTALMENTE MODIFICADA) ---
// =======================================================

// --- NUEVO: Helper para generar el HTML del botón/selector ---
function generarHtmlBoton(id, cantidad) {
    if (cantidad === 0) {
        return `<button class="add-to-cart" onclick="agregarAlCarrito(${id})">Agregar al Carrito</button>`;
    } else {
        return `
            <div class="quantity-selector">
                <button class="quantity-btn" onclick="restarDelCarrito(${id})">-</button>
                <span>${cantidad}</span>
                <button class="quantity-btn" onclick="agregarAlCarrito(${id})">+</button>
            </div>
        `;
    }
}

// --- NUEVO: Helper para obtener la cantidad de un item en el carrito ---
function getQuantityInCart(idProducto) {
    const item = carrito.find(item => item.id === idProducto);
    return item ? item.quantity : 0;
}

// --- NUEVO: Helper para actualizar la UI de un solo botón ---
function actualizarBotonProducto(idProducto) {
    const actionContainer = document.getElementById(`actions-${idProducto}`);
    if (actionContainer) {
        const cantidad = getQuantityInCart(idProducto);
        actionContainer.innerHTML = generarHtmlBoton(idProducto, cantidad);
    }
}

// --- NUEVO ---
// Función para guardar el carrito en localStorage
function guardarCarritoEnStorage() {
    localStorage.setItem('miTiendaCarrito', JSON.stringify(carrito));
}

// --- NUEVO ---
// Función para cargar el carrito desde localStorage
function cargarCarritoDeStorage() {
    const carritoGuardado = localStorage.getItem('miTiendaCarrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        actualizarContadorCarrito(); // Actualiza el ícono del header al cargar
    }
}

function inicializarCarritoModal() {
    const cartModalOverlay = document.getElementById('cart-modal-overlay');
    const openCartBtn = document.getElementById('open-cart-modal-btn');
    const closeCartBtn = document.getElementById('cart-modal-close');

    if (!cartModalOverlay) return; // No estamos en una pág. con carrito

    openCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderizarItemsCarrito(); // Dibuja el carrito CADA VEZ que se abre
        cartModalOverlay.classList.add('open');
    });

    closeCartBtn.addEventListener('click', () => cartModalOverlay.classList.remove('open'));
    
    cartModalOverlay.addEventListener('click', (e) => {
        if (e.target === cartModalOverlay) {
            cartModalOverlay.classList.remove('open');
        }
    });
}

// --- MODIFICADO: Ahora solo añade 1 ---
function agregarAlCarrito(idProducto) {
    console.log('Agregando producto con ID:', idProducto);
    
    const itemExistente = carrito.find(item => item.id === idProducto);
    const productoAgregado = productosGlobales.find(producto => producto.id === idProducto);

    if (!productoAgregado) {
        console.error('No se pudo encontrar el producto con ID:', idProducto);
        return;
    }

    if (itemExistente) {
        // Validar stock
        if(itemExistente.quantity >= productoAgregado.stock) {
            showCustomAlert('Stock Agotado', `No puedes agregar más de ${productoAgregado.stock} unidades.`, 'error');
            return;
        }
        itemExistente.quantity++;
    } else {
        if(productoAgregado.stock > 0) {
            carrito.push({ ...productoAgregado, quantity: 1 });
        } else {
            showCustomAlert('Sin Stock', 'Este producto no tiene stock disponible.', 'error');
            return;
        }
    }
    
    actualizarContadorCarrito();
    guardarCarritoEnStorage();
    actualizarBotonProducto(idProducto); // Actualiza solo el botón de este producto
    renderizarItemsCarrito(); // Actualiza el modal (si está abierto)
    
    // Solo muestra la alerta la primera vez que se agrega
    if (getQuantityInCart(idProducto) === 1) {
        showCustomAlert('¡Agregado!', `"${productoAgregado.nombre}" se agregó al carrito.`, 'success');
    }
}

// --- NUEVO: Función para restar 1 ---
function restarDelCarrito(idProducto) {
    console.log('Restando producto con ID:', idProducto);
    
    const itemIndex = carrito.findIndex(item => item.id === idProducto);
    
    if (itemIndex > -1) {
        const item = carrito[itemIndex];
        item.quantity--;

        if (item.quantity === 0) {
            carrito.splice(itemIndex, 1);
        }
    }
    
    actualizarContadorCarrito();
    guardarCarritoEnStorage();
    actualizarBotonProducto(idProducto); // Actualiza solo el botón de este producto
    renderizarItemsCarrito(); // Actualiza el modal (si está abierto)
}

// --- NUEVO: Función para eliminar todo el item (para el modal) ---
function eliminarProductoDelCarrito(idProducto) {
    console.log('Eliminando producto con ID:', idProducto);
    
    const itemIndex = carrito.findIndex(item => item.id === idProducto);
    
    if (itemIndex > -1) {
        carrito.splice(itemIndex, 1);
    }
    
    actualizarContadorCarrito();
    guardarCarritoEnStorage();
    actualizarBotonProducto(idProducto); // Actualiza el botón en la página principal
    renderizarItemsCarrito(); // Vuelve a dibujar el modal
}


// Dibuja los items dentro del modal del carrito
function renderizarItemsCarrito() {
    const cartContainer = document.getElementById('cart-items-container');
    if (!cartContainer) return; // No hay modal de carrito en esta pág.
    cartContainer.innerHTML = ''; 

    if (carrito.length === 0) {
        cartContainer.innerHTML = '<p class="cart-empty-msg">Tu carrito está vacío.</p>';
        actualizarTotalCarrito();
        return;
    }

    carrito.forEach(item => {
        const itemHTML = `
            <div class="cart-item">
                <img src="${item.imagen_url}" alt="${item.nombre}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>$${item.precio.toLocaleString('es-CL')}</p>
                    <div class="cart-item-details">
                        <div class="quantity-selector mini">
                            <button class="quantity-btn" onclick="restarDelCarrito(${item.id})">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="agregarAlCarrito(${item.id})">+</button>
                        </div>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button onclick="eliminarProductoDelCarrito(${item.id})" title="Eliminar producto">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        cartContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    actualizarTotalCarrito();
}

// Actualiza el contador de la burbuja (header)
function actualizarContadorCarrito() {
    const contador = document.querySelector('.cart-counter');
    if (!contador) return;
    const totalItems = carrito.reduce((sum, item) => sum + item.quantity, 0);
    
    if (contador) {
        contador.textContent = totalItems;
    }
}

// Actualiza el precio total DENTRO del modal del carrito
function actualizarTotalCarrito() {
    const totalElement = document.getElementById('cart-total');
    if (!totalElement) return;
    const totalPesos = carrito.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
    
    totalElement.textContent = `Total: $${totalPesos.toLocaleString('es-CL')}`;
}

// --- NUEVA FUNCIÓN PARA EL MENÚ DE CATEGORÍAS ---
function inicializarMenuCategorias() {
    const toggleBtn = document.getElementById('categories-toggle-btn');
    const navMenu = document.getElementById('main-nav-menu');

    if (!toggleBtn || !navMenu) return; // Seguridad

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        navMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('open') && !navMenu.contains(e.target)) {
            navMenu.classList.remove('open');
        }
    });
}


// --- 4. LLAMAR A LAS FUNCIONES CUANDO LA PÁGINA CARGUE ---
document.addEventListener('DOMContentLoaded', () => {
    
    cargarCarritoDeStorage(); // <-- Carga el carrito guardado
    
    inicializarCustomAlert(); // <-- MOVIDO ARRIBA
    obtenerProductos();
    inicializarChatbot();
    inicializarAuthModal();
    inicializarUserInfoModal(); 
    actualizarEstadoAuthChat();
    
    inicializarBusqueda();
    inicializarCarritoModal();
    inicializarMenuCategorias();
    inicializarSolicitudModal();
    
    // --- NUEVO: Carga las solicitudes si estamos en la página correcta ---
    if (document.getElementById('solicitudes-container')) {
        cargarMisSolicitudes();
    }
    
    // --- NUEVO: Maneja el login desde la URL ---
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'login') {
        abrirLoginModal();
    }
});


// ===========================================
// --- 8. LÓGICA DE AUTENTICACIÓN (MODIFICADA) ---
// ===========================================

// --- Variables de Autenticación y Modales ---
const loginModalOverlay = document.getElementById('login-modal-overlay');
const openLoginBtn = document.getElementById('open-login-modal-btn');
const closeLoginBtn = document.getElementById('login-modal-close');
const loginForm = document.getElementById('login-form');
const chatLoginBtn = document.getElementById('chat-login-btn');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const openRegisterBtn = document.getElementById('open-register-modal-btn'); 
const togglePasswordLoginBtn = document.getElementById('toggle-password-login');

const registerModalOverlay = document.getElementById('register-modal-overlay');
const registerModalCloseBtn = document.getElementById('register-modal-close');
const registerForm = document.getElementById('register-form');
const registerSubmitBtn = document.getElementById('register-submit-btn'); 
const usernameInput = document.getElementById('register-username');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const confirmPasswordInput = document.getElementById('register-password-confirm');
const togglePasswordRegisterBtn = document.getElementById('toggle-password-register');
const strengthBarFill = document.getElementById('password-strength-fill');
const strengthText = document.getElementById('password-strength-text');
const critLength = document.getElementById('crit-length');
const critUppercase = document.getElementById('crit-uppercase');
const critNumber = document.getElementById('crit-number');
const critSpecial = document.getElementById('crit-special');
const matchMsg = document.getElementById('password-match-msg');

const userInfoModalOverlay = document.getElementById('user-info-modal-overlay');
const closeUserInfoModalBtn = document.getElementById('user-info-modal-close');
const userInfoLogoutBtn = document.getElementById('user-info-logout-btn');
const userProfileImg = document.getElementById('user-profile-img');
const fileUploadInput = document.getElementById('file-upload');

// --- NUEVO: Variables para el modal de Solicitud ---
const solicitudModalOverlay = document.getElementById('solicitud-modal-overlay');
const solicitudModalCloseBtn = document.getElementById('solicitud-modal-close');
const openSolicitudLink = document.getElementById('open-solicitud-link');
const solicitudForm = document.getElementById('solicitud-form');
const solicitudSubmitBtn = document.getElementById('solicitud-submit-btn');
const solicitudFileUploadBtn = document.getElementById('solicitud-file-upload-btn');
const solicitudFileUpload = document.getElementById('solicitud-file-upload');
const solicitudFileName = document.getElementById('solicitud-file-name');


// --- Funciones del Modal de Perfil (ACTUALIZADAS) ---
async function uploadAvatar(file) {
    if (!file || !currentUser) {
        showCustomAlert('Error', 'No hay archivo o no has iniciado sesión.', 'error');
        return;
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
    const bucket = 'avatars';
    showCustomAlert('Subiendo Imagen', 'Espera un momento mientras subimos tu avatar...', 'info');
    const { data: uploadData, error: uploadError } = await client.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
        });
    if (uploadError) {
        showCustomAlert('Error', 'Error al subir la imagen: ' + uploadError.message, 'error');
        return;
    }
    const publicURL = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
    const { error: updateError } = await client.auth.updateUser({
        data: { avatar_url: publicURL }
    });
    if (updateError) {
        showCustomAlert('Error', 'Error al actualizar el perfil: ' + updateError.message, 'error');
        return;
    }
    const { data: newSessionData } = await client.auth.refreshSession();
    currentUser = newSessionData.user;
    renderUserInfoModal(currentUser);
    showCustomAlert('¡Éxito!', 'Tu foto de perfil se ha actualizado.', 'success');
}

// --- NUEVA FUNCIÓN GLOBAL PARA ABRIR EL LOGIN ---
function abrirLoginModal(e) {
    if (e) e.preventDefault();
    if (loginModalOverlay) {
        loginModalOverlay.classList.add('open');
    } else {
        // Si el modal no existe (ej. en mis-solicitudes.html), redirige
        window.location.href = 'index.html?action=login';
    }
}

function openUserInfoModal(e) {
    e.preventDefault();
    if (!currentUser) {
        abrirLoginModal(); // <-- MODIFICADO
        return;
    }
    if (currentUser) {
        renderUserInfoModal(currentUser);
        userInfoModalOverlay.classList.add('open');
    }
}
function renderUserInfoModal(user) {
    const username = user.user_metadata?.username || user.email.split('@')[0];
    const createdDate = new Date(user.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('user-info-username').textContent = `Usuario: ${username}`;
    document.getElementById('user-detail-email').textContent = user.email;
    document.getElementById('user-detail-id').textContent = user.id.substring(0, 8) + '...'; 
    document.getElementById('user-detail-since').textContent = createdDate;
    const avatarUrl = user.user_metadata?.avatar_url || 'data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2024%2024\'%20fill=\'gray\'%3E%3Cpath%20d=\'M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z\'/%3E%3C/svg%3E';
    userProfileImg.src = avatarUrl;
}
function inicializarUserInfoModal() {
    if (!userInfoModalOverlay) return; // No estamos en una pág. con este modal
    closeUserInfoModalBtn.addEventListener('click', () => userInfoModalOverlay.classList.remove('open'));
    userInfoLogoutBtn.addEventListener('click', handleLogout); 
    userInfoModalOverlay.addEventListener('click', (e) => {
        if (e.target === userInfoModalOverlay) userInfoModalOverlay.classList.remove('open');
    });
    const uploaderElement = document.getElementById('profile-pic-uploader');
    if (uploaderElement) {
        uploaderElement.addEventListener('click', () => {
            fileUploadInput.click(); 
        });
    }
    fileUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadAvatar(e.target.files[0]);
        }
    });
}
function inicializarAuthModal() {
    // --- MODIFICADO: Añadido chequeo de existencia ---
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', openUserInfoModal);
    }
    if(chatLoginBtn) { // chatLoginBtn solo existe en index.html
        chatLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginModalOverlay.classList.add('open');
            chatWindow.classList.remove('open'); 
        });
    }
    if (!loginModalOverlay) return; // Si no hay modal de login, salir

    closeLoginBtn.addEventListener('click', () => loginModalOverlay.classList.remove('open'));
    loginModalOverlay.addEventListener('click', (e) => {
        if (e.target === loginModalOverlay) loginModalOverlay.classList.remove('open');
    });
    loginSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogin();
    });
    openRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModalOverlay.classList.remove('open'); 
        registerModalOverlay.classList.add('open'); 
    });
    togglePasswordLoginBtn.addEventListener('click', () => {
        togglePasswordVisibility(document.getElementById('login-password'), togglePasswordLoginBtn);
    });
    registerModalCloseBtn.addEventListener('click', () => registerModalOverlay.classList.remove('open'));
    registerModalOverlay.addEventListener('click', (e) => {
        if (e.target === registerModalOverlay) registerModalOverlay.classList.remove('open');
    });
    togglePasswordRegisterBtn.addEventListener('click', () => {
        togglePasswordVisibility(registerPasswordInput, togglePasswordRegisterBtn);
        togglePasswordVisibility(confirmPasswordInput, null); 
    });
    registerPasswordInput.addEventListener('input', () => {
        validatePasswordCriteria(registerPasswordInput.value);
        checkPasswordMatch();
    });
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    registerSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleRegister();
    });
    const allFormInputs = document.querySelectorAll('.auth-modal-content .form-group input');
    allFormInputs.forEach(input => {
        const formGroup = input.closest('.form-group');
        input.addEventListener('focus', () => {
            formGroup.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            formGroup.classList.remove('focused');
        });
    });
}
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) {
        if (error.message === "Email not confirmed") {
            showCustomAlert('Error', "Debes confirmar tu correo (revisa spam).", 'error');
        } else {
            showCustomAlert('Error', error.message, 'error');
        }
    } else {
        console.log("Inicio de sesión exitoso:", data.user);
        // --- NUEVO: Redirigir si vienes de otra página ---
        const redirectUrl = localStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
            localStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
        }
    }
}
async function handleRegister() {
    const username = usernameInput.value;
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    const isPasswordValid = validatePasswordCriteria(password);
    const doPasswordsMatch = checkPasswordMatch();
    if (username.length < 3) {
        showCustomAlert('Error', 'El nombre de usuario debe tener al menos 3 caracteres.', 'error');
        return;
    }
    if (!isPasswordValid) {
        showCustomAlert('Error', 'La contraseña no cumple con todos los requisitos de seguridad.', 'error');
        return;
    }
    if (!doPasswordsMatch) {
        showCustomAlert('Error', 'Las contraseñas no coinciden.', 'error');
        return;
    }
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username 
            }
        }
    });
    if (error) {
        showCustomAlert('Error al registrarse', error.message, 'error');
    } else {
        console.log("Registro exitoso:", data.user);
        registerModalOverlay.classList.remove('open');
        registerForm.reset();
        validatePasswordCriteria(''); 
        checkPasswordMatch(); 
        showCustomAlert('¡Registro Exitoso!', "Revisa tu correo (y la carpeta de spam) para confirmar tu cuenta.", 'success');
    }
}

// --- MODIFICADO: Logout ahora limpia el carrito ---
async function handleLogout(e) {
    e.preventDefault();
    userInfoModalOverlay.classList.remove('open');
    const { error } = await client.auth.signOut();
    
    if (error) {
        showCustomAlert('Error', error.message, 'error');
    } else {
        // Limpiamos el carrito local al cerrar sesión
        carrito = [];
        guardarCarritoEnStorage();
        actualizarContadorCarrito();
        renderizarProductos(productosGlobales); // Re-renderiza los productos para resetear los botones
        
        showCustomAlert('Sesión Cerrada', 'Has cerrado sesión correctamente.', 'info');
        
        // --- NUEVO: Si estamos en mis-solicitudes, redirigimos al index ---
        if (document.getElementById('solicitudes-container')) {
            window.location.href = 'index.html';
        }
    }
}

// --- MODIFICADO: LÓGICA PARA MOSTRAR/OCULTAR BOTÓN ADMIN ---
function handleAuthSuccess(user) {
    currentUser = user;
    if(loginModalOverlay) loginModalOverlay.classList.remove('open');
    
    const username = user.user_metadata?.username || user.email.split('@')[0];
    const accountBtn = document.getElementById('open-login-modal-btn');
    const adminLink = document.getElementById('admin-panel-link');
    const dashboardLink = document.getElementById('dashboard-link'); 

    if (accountBtn) {
        accountBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${username}`; 
        accountBtn.classList.add('profile-btn'); 
        accountBtn.removeEventListener('click', openUserInfoModal); 
        accountBtn.addEventListener('click', openUserInfoModal); 
    }

    // --- ¡ESTA ES LA NUEVA LÓGICA! ---
    if (adminLink) {
        if (user.user_metadata?.role === 'admin') {
            adminLink.classList.remove('hidden');
            if (dashboardLink) dashboardLink.classList.remove('hidden'); // Muestra el botón de Admin
        } else {
            adminLink.classList.add('hidden');
            if (dashboardLink) dashboardLink.classList.add('hidden'); // Oculta el botón
        }
    }
    // --- FIN DE LA NUEVA LÓGICA ---

    actualizarEstadoAuthChat(); 
    if(loginForm) loginForm.reset();
}

// --- NUEVAS FUNCIONES DE VALIDACIÓN Y UI ---
function togglePasswordVisibility(inputElement, buttonElement) {
    if (!inputElement) return;
    const isPassword = inputElement.type === 'password';
    inputElement.type = isPassword ? 'text' : 'password';
    if (buttonElement) {
        buttonElement.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    }
}
function validatePasswordCriteria(password) {
    if (!strengthBarFill) return false; // Salir si no estamos en la pág. de registro
    let score = 0;
    const isLengthMet = password.length >= 8;
    updateCriteriaUI(critLength, isLengthMet);
    if (isLengthMet) score++;
    const isUppercaseMet = /[A-Z]/.test(password);
    updateCriteriaUI(critUppercase, isUppercaseMet);
    if (isUppercaseMet) score++;
    const isNumberMet = /[0-9]/.test(password);
    updateCriteriaUI(critNumber, isNumberMet);
    if (isNumberMet) score++;
    const isSpecialMet = /[^a-zA-Z0-9]/.test(password);
    updateCriteriaUI(critSpecial, isSpecialMet);
    if (isSpecialMet) score++;
    strengthBarFill.className = 'strength-fill'; 
    if (password.length === 0) {
        strengthBarFill.style.width = '0%';
        strengthText.textContent = '';
    } else {
        switch (score) {
            case 1:
                strengthBarFill.style.width = '25%';
                strengthBarFill.classList.add('weak');
                strengthText.textContent = 'Débil';
                break;
            case 2:
                strengthBarFill.style.width = '50%';
                strengthBarFill.classList.add('medium');
                strengthText.textContent = 'Media';
                break;
            case 3:
            case 4: 
                strengthBarFill.style.width = '100%';
                strengthBarFill.classList.add('strong');
                strengthText.textContent = 'Fuerte';
                break;
            default:
                strengthBarFill.style.width = '10%';
                strengthBarFill.classList.add('weak');
                strengthText.textContent = 'Muy Débil';
        }
    }
    return score === 4;
}
function updateCriteriaUI(element, isMet) {
    if (!element) return;
    if (isMet) {
        element.classList.add('text-success');
        element.classList.remove('text-danger');
    } else {
        element.classList.add('text-danger');
        element.classList.remove('text-success');
    }
}
function checkPasswordMatch() {
    if (!registerPasswordInput || !confirmPasswordInput) return false;
    const password = registerPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    if (confirmPassword.length === 0 && password.length === 0) {
        matchMsg.textContent = '';
        return false;
    }
    if (password === confirmPassword) {
        matchMsg.textContent = "✓ Las contraseñas coinciden";
        matchMsg.className = "password-helper-text text-success";
        return true;
    } else {
        matchMsg.textContent = "Las contraseñas no coinciden";
        matchMsg.className = "password-helper-text text-danger";
        return false;
    }
}

// --- LISTENER GLOBAL DE AUTENTICACIÓN ---
client.auth.onAuthStateChange((event, session) => {
    console.log(`Evento de Auth: ${event}`, session);
    if (event === 'INITIAL_SESSION' && session) {
        console.log("Sesión existente cargada.");
        handleAuthSuccess(session.user);
    } else if (event === 'SIGNED_IN') {
        console.log("Evento SIGNED_IN detectado.");
        const eraUnLoginNuevo = !currentUser;
        handleAuthSuccess(session.user); 
        if (eraUnLoginNuevo) { 
            console.log("Es un inicio de sesión nuevo. Mostrando bienvenida.");
            const username = session.user.user_metadata?.username || session.user.email.split('@')[0];
            showCustomAlert(`¡Bienvenido, ${username}!`, 'Has iniciado sesión.', 'success');
        } else {
            console.log("El usuario ya estaba logueado. Refrescando sesión en silencio.");
        }
    } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log("Email confirmado y token refrescado.");
        if (!currentUser) {
            handleAuthSuccess(session.user);
            showCustomAlert('¡Cuenta Confirmada!', 'Tu correo ha sido verificado. ¡Bienvenido!', 'success');
        } else {
            currentUser = session.user;
        }
    } else if (event === 'SIGNED_OUT') {
        console.log("Usuario cerró sesión.");
        currentUser = null;
        const accountBtn = document.getElementById('open-login-modal-btn'); 
        if (accountBtn) {
            accountBtn.innerHTML = `<i class="fas fa-user"></i> Mi Cuenta`;
            accountBtn.classList.remove('profile-btn'); 
            accountBtn.removeEventListener('click', openUserInfoModal); 
            accountBtn.addEventListener('click', openUserInfoModal); 
        }
        
        // --- ¡NUEVA LÓGICA DE LOGOUT! ---
        const adminLink = document.getElementById('admin-panel-link');
        const dashboardLink = document.getElementById('dashboard-link');
        if (adminLink) {
            adminLink.classList.add('hidden'); // Oculta el botón de admin
            if (dashboardLink) dashboardLink.classList.add('hidden');
        }
        // --- FIN DE LA NUEVA LÓGICA ---

        actualizarEstadoAuthChat();
    }
});


// ===========================================
// --- 9. LÓGICA DEL CHATBOT (MODIFICADA) ---
// ===========================================

// --- NUEVA FUNCIÓN DE BÚSQUEDA (MEJORADA Y CORREGIDA) ---
function findRelevantProducts(message) {
    // --- MODIFICADO: Añadimos saludos y palabras comunes a la lista de ignorados ---
    const stopWords = new Set([
        'hola', 'alo', 'gracias', 'adios', 'chao', 'buenas', 'buenos', 'dias', 'tardes', 'noches',
        'que', 'hay', 'disponibles', 'tienes', 'para', 'con', 'de', 'la', 'el', 'los', 'las', 
        'un', 'una', 'unos', 'unas', 'mi', 'es', 'son', 'precio', 'valor', 'cuanto', 'cuesta',
        'busco', 'buscar', 'comprar', 'vende', 'vendes', 'vender', 'deseo', 
        'quiero', 'quisiera', 'necesito', 'requiero', 'ayuda', 'mostrar', 'muéstrame',
        'producto', 'productos', 'articulo', 'artículo', 'solicitud', 'solicitudes', 'generar'
    ]);
    
    // Limpia la pregunta del usuario y la divide en palabras clave
    const queryWords = message.toLowerCase()
        .replace(/[?¿!¡,.]/g, '') // Quita puntuación
        .split(' ')
        .filter(w => w.length > 2 && !stopWords.has(w)); // Quita palabras cortas y stop-words

    if (productosGlobales.length === 0 || queryWords.length === 0) {
        return [];
    }

    console.log("Buscando con palabras clave:", queryWords);

    const relevantProducts = productosGlobales.filter(producto => {
        const productWords = producto.nombre.toLowerCase().split(' ');
        
        // Compara cada palabra de la consulta con cada palabra del producto
        return queryWords.some(qWord => 
            productWords.some(pWord => 
                pWord.includes(qWord) || qWord.includes(pWord) // La magia: "refrigerantes" incluye "refrigerante"
            )
        );
    });

    console.log("Productos encontrados:", relevantProducts.map(p => p.nombre));
    return relevantProducts;
}


// --- MODIFICADO ---
// El prompt del sistema ahora sabe que recibirá contexto Y cómo pedir soporte.
const systemPrompt = `
Eres un asistente virtual de 'MiTienda', una tienda de implementos para camiones y vehículos pesados. Eres amigable, servicial y hablas español.

IMPORTANTE: Antes de la pregunta del usuario, a veces recibirás un bloque de 'CONTEXTO DE PRODUCTOS'. DEBES usar ese contexto para responder la pregunta del usuario. 
- Si el contexto está vacío o no es relevante, simplemente di que no encontraste productos que coincidan. 
- Si no hay contexto, responde normalmente.

REGLAS DE RESPUESTA FIJA:
1. Si el usuario pregunta por 'estado de mi pedido', DEBES responder con el siguiente texto y NADA MÁS: 
   '¡Claro! Puedes revisar el estado de tu pedido en tu panel de usuario: [Ver estado de mi pedido](/estado-pedido)'.

2. Si el usuario quiere 'crear una solicitud', 'generar un ticket', 'helpdesk', 'soporte', o 'ayuda', DEBES responder con el siguiente texto y NADA MÁS: 
   'Entendido, puedes crear una solicitud de soporte aquí: [Crear una solicitud de soporte](/crear-solicitud)'
`;

// --- Variables del Chatbot ---
// ⚠️ ALERTA DE SEGURIDAD ⚠️
const apiKey = "AIzaSyA4dlvzEAgIfMtmDR4aSSw5jnra9Obk5jQ"; // Reemplaza esto

const chatBubble = document.getElementById('chat-bubble');
const chatWindow = document.getElementById('chat-window');
const chatClose = document.getElementById('chat-close');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

function inicializarChatbot() {
    if (!chatBubble) return; // No estamos en una pág. con chatbot
    chatBubble.addEventListener('click', () => {
        actualizarEstadoAuthChat(); 
        chatWindow.classList.toggle('open');
    });
    chatClose.addEventListener('click', () => {
        chatWindow.classList.remove('open');
    });
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        handleUserMessage();
    });
    const welcomeMessage = "¡Hola! Soy tu asistente de MiTienda. ¿En qué puedo ayudarte hoy?";
    displayBotMessage(welcomeMessage, false); 
    chatHistory.push({
        role: "model",
        parts: [{ text: welcomeMessage }]
    });
}
function actualizarEstadoAuthChat() {
    if (!chatWindow) return;
    if (currentUser) {
        chatWindow.classList.add('chat-authenticated');
        chatWindow.classList.remove('chat-guest');
    } else {
        chatWindow.classList.add('chat-guest');
        chatWindow.classList.remove('chat-authenticated');
    }
}

// --- MODIFICADO ---
// Ahora busca contexto ANTES de enviar el mensaje
async function handleUserMessage() {
    if (!currentUser) {
        showCustomAlert('Atención', "Por favor, inicia sesión para chatear.", 'info');
        return;
    }
    const userMessage = chatInput.value.trim();
    if (userMessage === "") return; 

    displayUserMessage(userMessage); 
    chatInput.value = ''; 

    // Solo añadimos la pregunta REAL del usuario al historial
    chatHistory.push({
        role: "user",
        parts: [{ text: userMessage }]
    });

    const typingIndicator = displayBotMessage("Escribiendo...", true);

    try {
        // Pasamos la pregunta actual y los productos encontrados
        const contextProducts = findRelevantProducts(userMessage);
        const botResponse = await askGemini(userMessage, contextProducts); 
        
        chatMessages.removeChild(typingIndicator);
        displayBotMessage(botResponse.text, false); // Muestra la respuesta de texto

        // NUEVO: Si la respuesta de la IA trajo productos, los muestra
        if (botResponse.products && botResponse.products.length > 0) {
            displayBotProductsInChat(botResponse.products);
        }
        
        chatHistory.push({
            role: "model",
            parts: [{ text: botResponse.text }] // Solo guarda el texto en el historial
        });
        
    } catch (error) {
        console.error("Error al llamar a Gemini:", error);
        chatMessages.removeChild(typingIndicator);
        displayBotMessage("Lo siento, tengo problemas para conectarme. Intenta de nuevo.", false);
    }
}

function displayUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    scrollToBottom();
}

// --- MODIFICADO ---
// Reemplazamos el SVG por un ícono de Font Awesome
function displayBotMessage(message, isTyping = false) {
    const messageElement = document.createElement('div');
    
    // Reemplaza [texto](link) por un botón/enlace
    let processedMessage = message.replace(
        /\[(.*?)\]\((.*?)\)/g, 
        '<a href="$2" target="_blank" class="chat-link-button">$1</a>'
    );
    
    
    if (isTyping) {
        messageElement.className = 'message bot-message typing-indicator'; 
        messageElement.innerHTML = `
            <div class="bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-bubble">${processedMessage}</div>
        `;
    } else {
        messageElement.className = 'message bot-message'; 
        messageElement.innerHTML = `
            <div class="bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-bubble">${processedMessage}</div>
        `;
    }
    
    chatMessages.appendChild(messageElement);

    // --- NUEVO: Hook para el botón de solicitud ---
    const solicitudLink = messageElement.querySelector('a[href="/crear-solicitud"]');
    if (solicitudLink) {
        solicitudLink.href = '#'; // Previene que el link navegue
        solicitudLink.addEventListener('click', (e) => {
            e.preventDefault();
            openSolicitudModal();
            chatWindow.classList.remove('open'); // Cierra el chat
        });
    }

    scrollToBottom();
    return messageElement; 
}

// --- NUEVA FUNCIÓN ---
// Dibuja las tarjetas de producto en el chat
function displayBotProductsInChat(products) {
    const productListElement = document.createElement('div');
    // Usamos las mismas clases de mensaje para que se alinee a la izquierda
    productListElement.className = 'message bot-message chat-product-list';

    products.forEach(producto => {
        const productCardHTML = `
            <div class="chat-product-card">
                <img src="${producto.imagen_url}" alt="${producto.nombre}" class="chat-product-img">
                <div class="chat-product-info">
                    <h4>${producto.nombre}</h4>
                    <p class="price">$${producto.precio.toLocaleString('es-CL')}</p>
                </div>
                <button class="add-to-cart-chat" onclick="agregarAlCarrito(${producto.id})" title="Agregar al Carrito">
                    <i class="fas fa-cart-plus"></i>
                </button>
            </div>
        `;
        productListElement.innerHTML += productCardHTML;
    });

    chatMessages.appendChild(productListElement);
    scrollToBottom();
}


function scrollToBottom() {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- MODIFICADO ---
// Ahora construye un historial temporal con el contexto
async function askGemini(currentUserQuery, contextProducts = []) {
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // 1. Construye el mensaje de contexto
    let contextMessage = "";
    if (contextProducts.length > 0) {
        contextMessage = "CONTEXTO DE PRODUCTOS (Usa esto para responder la siguiente pregunta):\n";
        contextProducts.forEach(p => {
            // Le damos a la IA el nombre, precio y (si existe) la descripción
            contextMessage += `- ${p.nombre} (Precio: $${p.precio.toLocaleString('es-CL')})${p.descripcion ? ' Desc: ' + p.descripcion : ''}\n`;
        });
        // NUEVA INSTRUCCIÓN: Le pedimos a la IA que NO liste los productos
        contextMessage += `\n(Responde al usuario confirmando que encontraste ${contextProducts.length} producto(s) relevante(s) sobre '${currentUserQuery}', pero NO los listes en tu respuesta de texto. El sistema los mostrará automáticamente.)`;
    }

    // 2. Construye el historial para la API
    const apiHistory = chatHistory.map(item => ({
        role: item.role,
        parts: item.parts
    }));
    
    // 3. INYECTA el contexto
    if (contextMessage !== "") {
        apiHistory.splice(apiHistory.length - 1, 0, { // Inserta ANTES de la pregunta del usuario
            role: "user",
            parts: [{ text: contextMessage }]
        });
    }

    const payload = {
        contents: apiHistory, // Ahora contiene [historia..., CONTEXTO, pregunta_actual]
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 256,
        }
    };

    let response;
    let retries = 0;
    const maxRetries = 3;
    let delay = 1000; 
    while (retries < maxRetries) {
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    // Devuelve el texto Y los productos que se usaron como contexto
                    return { text: text, products: contextProducts }; 
                } else {
                    return { text: "No puedo responder a esa pregunta en este momento.", products: [] };
                }
            } else if (response.status === 429 || response.status >= 500) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; 
                retries++;
            } else {
                console.error("Error en la API de Gemini:", response.status, await response.text());
                return { text: "Hubo un error al procesar tu solicitud.", products: [] };
            }
        } catch (error) {
            console.error("Error de red al llamar a Gemini:", error);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            retries++;
        }
    }
    return { text: "Lo siento, estoy teniendo problemas de conexión. Por favor, intenta más tarde.", products: [] };
}

// ==================================================
// --- 10. CUSTOM ALERT MODAL (Sin cambios) ---
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
    if (!alertModal) return; // Si no hay modal de alerta, salir
    alertOkBtn.addEventListener('click', () => {
        alertModal.classList.remove('open');
    });
    alertModal.addEventListener('click', (e) => {
        if (e.target === alertModal) {
            alertModal.classList.remove('open');
        }
    });
}


// ==================================================
// --- 11. LÓGICA DEL MODAL DE SOLICITUD (NUEVO) ---
// ==================================================

// --- NUEVO: Función para formatear el RUT ---
function formatearRUT(rut) {
    // Limpia el RUT de todo excepto números y k
    let valor = rut.replace(/[^\dkK]/g, '');
    
    // No hacer nada si está vacío
    if (valor.length === 0) return '';

    // Separa el cuerpo del dígito verificador
    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1).toUpperCase();

    // Aplica formato de puntos al cuerpo
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${cuerpo}-${dv}`;
}

function inicializarSolicitudModal() {
    if (!solicitudModalOverlay) return; // Si el modal no existe, no hagas nada

    const rutInput = document.getElementById('solicitud-rut');

    // --- NUEVO: Listener para formatear el RUT mientras se escribe ---
    if(rutInput) {
        rutInput.addEventListener('input', (e) => {
            // No formatear mientras se borra para evitar saltos
            if (e.inputType === 'deleteContentBackward') {
                return;
            }
            e.target.value = formatearRUT(e.target.value);
        });
    }

    // Abrir modal
    if(openSolicitudLink) {
        openSolicitudLink.addEventListener('click', (e) => {
            e.preventDefault();
            openSolicitudModal();
        });
    }

    // Cerrar modal
    solicitudModalCloseBtn.addEventListener('click', () => {
        solicitudModalOverlay.classList.remove('open');
    });
    solicitudModalOverlay.addEventListener('click', (e) => {
        if (e.target === solicitudModalOverlay) {
            solicitudModalOverlay.classList.remove('open');
        }
    });

    // Botón de subir archivo
    solicitudFileUploadBtn.addEventListener('click', () => {
        solicitudFileUpload.click();
    });
    solicitudFileUpload.addEventListener('change', () => {
        if (solicitudFileUpload.files.length > 0) {
            solicitudFileName.textContent = solicitudFileUpload.files[0].name;
        } else {
            solicitudFileName.textContent = 'Ningún archivo seleccionado.';
        }
    });

    // Enviar formulario
    solicitudForm.addEventListener('submit', handleSolicitudSubmit);
}

function openSolicitudModal() {
    // Si el usuario está logueado, pre-llena su email
    if (currentUser && currentUser.email) {
        document.getElementById('solicitud-email').value = currentUser.email;
    }
    solicitudModalOverlay.classList.add('open');
}

async function handleSolicitudSubmit(e) {
    e.preventDefault();
    solicitudSubmitBtn.disabled = true; // Deshabilita el botón
    solicitudSubmitBtn.textContent = "Enviando...";

    let imageUrl = null;
    const file = solicitudFileUpload.files[0];
    
    // 1. Verificar si hay un usuario logueado
    if (!currentUser) {
        showCustomAlert('Error', 'Debes iniciar sesión para enviar una solicitud.', 'error');
        solicitudSubmitBtn.disabled = false;
        solicitudSubmitBtn.textContent = "Enviar Solicitud";
        return;
    }

    // 2. Subir la imagen (si existe)
    if (file) {
        const fileExt = file.name.split('.').pop();
        // --- RUTA DE ARCHIVO CORREGIDA ---
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        
        const { data, error } = await client.storage
            .from('solicitudes') // Nombre del bucket que creaste
            .upload(fileName, file);

        if (error) {
            console.error('Error subiendo imagen:', error);
            showCustomAlert('Error', 'No se pudo subir la imagen: ' + error.message, 'error');
            solicitudSubmitBtn.disabled = false;
            solicitudSubmitBtn.textContent = "Enviar Solicitud";
            return;
        }
        
        // Obtenemos la URL pública
        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/solicitudes/${fileName}`;
    }

    // 3. Recolectar datos del formulario
    const solicitudData = {
        user_id: currentUser.id,
        rut: document.getElementById('solicitud-rut').value,
        email: document.getElementById('solicitud-email').value,
        tipo_solicitud: document.getElementById('solicitud-tipo').value,
        comentarios: document.getElementById('solicitud-comentarios').value,
        imagen_url: imageUrl,
        estado: 'pendiente'
    };

    // 4. Insertar en la tabla 'Solicitudes'
    const { error: insertError } = await client
        .from('Solicitudes')
        .insert(solicitudData);

    if (insertError) {
        console.error('Error insertando solicitud:', insertError);
        showCustomAlert('Error', 'No se pudo enviar la solicitud: ' + insertError.message, 'error');
        solicitudSubmitBtn.disabled = false;
        solicitudSubmitBtn.textContent = "Enviar Solicitud";
        return;
    }

    // 5. Éxito
    showCustomAlert('¡Enviado!', 'Tu solicitud ha sido enviada. Te contactaremos pronto.', 'success');
    solicitudModalOverlay.classList.remove('open');
    solicitudForm.reset();
    solicitudFileName.textContent = 'Ningún archivo seleccionado.';
    solicitudSubmitBtn.disabled = false;
    solicitudSubmitBtn.textContent = "Enviar Solicitud";
}

// --- NUEVO: FUNCIONES PARA LA PÁGINA 'solicitudes.html' ---

async function cargarMisSolicitudes() {
    const container = document.getElementById('solicitudes-container');
    if (!container) return; // No estamos en la página correcta

    const { data: { user } } = await client.auth.getUser();

    if (!user) {
        container.innerHTML = '<p style="text-align:center;">Debes <a href="index.html?action=login" id="login-link-solicitudes">iniciar sesión</a> para ver tus solicitudes.</p>';
        
        // --- NUEVO: Manejador para el link de login ---
        const loginLink = document.getElementById('login-link-solicitudes');
        if(loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Guarda la intención de ir a solicitudes
                localStorage.setItem('redirectAfterLogin', 'solicitudes.html');
                // Redirige al index para el login
                window.location.href = 'index.html?action=login';
            });
        }
        return;
    }

    // --- MODIFICADO: AHORA INCLUYE LA CLAVE FORÁNEA EXPLÍCITA ---
    const { data, error } = await client
        .from('Solicitudes')
        .select(`
            *,
            Respuestas!Respuestas_solicitud_id_fkey (
                *
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando solicitudes:', error);
        container.innerHTML = `<p style="text-align:center;">Error al cargar tus solicitudes: ${error.message}</p>`;
        return;
    }

    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;">No tienes ninguna solicitud creada.</p>';
        return;
    }

    renderMisSolicitudes(data);
}

function renderMisSolicitudes(solicitudes) {
    const container = document.getElementById('solicitudes-container');
    container.innerHTML = ''; // Limpiar "cargando..."

    solicitudes.forEach(solicitud => {
        const fecha = new Date(solicitud.created_at).toLocaleDateString('es-CL');
        
        // --- MODIFICADO: Ahora SÍ renderiza las Respuestas ---
        let respuestasHTML = '';
        if (solicitud.Respuestas.length > 0) {
            solicitud.Respuestas.forEach(respuesta => {
                // Aquí asumimos que CUALQUIER respuesta es de un admin.
                // A futuro, podríamos filtrar por `respuesta.user_id`
                respuestasHTML += `
                    <div class="respuesta-item respuesta-admin">
                        <strong>Soporte MiTienda:</strong>
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
                    <p><strong>Tu comentario:</strong> ${solicitud.comentarios || 'No hay comentarios.'}</p>
                    ${solicitud.imagen_url ? `
                        <a href="${solicitud.imagen_url}" target="_blank" class="solicitud-imagen-link">
                            <img src="${solicitud.imagen_url}" alt="Imagen Adjunta" class="solicitud-imagen-preview">
                        </a>
                    ` : ''}
                </div>
                <div class="comentarios-section">
                    ${respuestasHTML || '<p class="sin-respuesta">Aún no hay respuestas de soporte.</p>'}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', solicitudHTML);
    });
}