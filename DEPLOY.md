# Guía de Despliegue e Instalación: Multiservicios ClimaCold

Esta guía detalla los pasos para subir la aplicación a un servidor gratuito de GitHub Pages y configurarla como una aplicación nativa (PWA) en tu tableta **Redmi Pad 2**.

---

## ☁️ Paso 1: Subir la Aplicación a GitHub (Servidor Gratis)

GitHub Pages es un servicio gratuito que te permite hospedar páginas web estáticas directamente desde un repositorio de GitHub.

1. **Crea una cuenta en GitHub**:
   Si aún no tienes una, regístrate en [github.com](https://github.com).
2. **Crea un nuevo repositorio**:
   - Ve a tu perfil y haz clic en **New** (Nuevo Repositorio).
   - Nómbralo como quieras (ej: `climacold`).
   - Elige la opción **Public** (Público).
   - Haz clic en **Create repository**.
3. **Sube tus archivos**:
   - Puedes arrastrar y soltar todos los archivos del proyecto directamente en la página de GitHub, o usar comandos Git si los manejas:
     - `index.html`
     - `styles.css`
     - `app.js`
     - `sw.js`
     - `manifest.json`
     - `icon-192.png`
     - `icon-512.png`
   - Confirma los cambios (Commit).

---

## 🚀 Paso 2: Activar GitHub Pages (Publicación Online)

Una vez subido el código, actívalo para que esté en línea de inmediato:

1. Ve a la pestaña **Settings** (Configuración) de tu repositorio en GitHub.
2. En la barra lateral izquierda, busca la sección **Code and automation** y haz clic en **Pages**.
3. En la sección **Build and deployment**:
   - En *Source*, selecciona **Deploy from a branch**.
   - En *Branch*, cambia `-- None --` a **main** (o la rama en la que subiste los archivos, usualmente `main` o `master`).
   - Deja la carpeta en `/ (root)`.
4. Haz clic en **Save** (Guardar).
5. Espera de 1 a 2 minutos. GitHub generará un enlace público que se verá así:
   👉 `https://tu-usuario.github.io/climacold/`

---

## 📱 Paso 3: Instalar como App Nativa en la Redmi Pad 2 (Tablet Android)

Gracias a que hemos configurado la aplicación como una **PWA (Progressive Web App)**, puedes instalarla en tu tableta para usarla sin conexión y verla como una aplicación nativa.

1. Abre el navegador **Google Chrome** en tu tableta Redmi Pad 2.
2. Ingresa a la dirección URL de GitHub Pages que se generó en el Paso 2:
   `https://tu-usuario.github.io/climacold/`
3. Al cargar la página por primera vez:
   - Aparecerá un aviso en la parte inferior que dice **"Agregar ClimaCold a la pantalla de inicio"** o **"Instalar aplicación"**. Haz clic en él.
   - Si no sale el aviso, presiona el botón de **los tres puntos verticales** en la esquina superior derecha de Google Chrome y selecciona **Agregar a la pantalla principal** (o **Instalar aplicación**).
4. Confirma la instalación.
5. ¡Listo! Verás un ícono de **ClimaCold** (el copo de nieve azul) en la pantalla de inicio de tu tableta.
6. Al abrir el ícono, la app se iniciará a pantalla completa, sin la barra de direcciones del navegador, viéndose y sintiéndose como una app nativa de Android.

---

## ⚠️ NOTA CRÍTICA SOBRE LOS DATOS (LocalStorage y Respaldos)

Como esta es una aplicación web sin base de datos centralizada, todos los datos (clientes, equipos, deudas e historial) se guardan **localmente en la memoria del navegador de la tableta (LocalStorage)**.

* **¿Qué significa esto?**
  Si usas la app en la tableta, todos los cambios se guardarán únicamente en esa tableta. No se sincronizan automáticamente con otros teléfonos u ordenadores.
* **Seguridad de los datos**:
  Si la tableta se formatea, se daña, o si borras el caché y datos del navegador Chrome, **se perderán todos tus datos registrados**.
* **Cómo proteger tus datos (¡Muy importante!)**:
  Hemos implementado un sistema de **Copias de Seguridad** integrado:
  1. Regularmente (semanalmente o tras registrar muchos datos), abre el menú **Respaldar Datos** en la esquina inferior izquierda.
  2. Haz clic en **Descargar Respaldo (.json)**.
  3. Guarda ese archivo JSON descargado en tu cuenta de **Google Drive**, envíatelo por correo, o compártelo por WhatsApp.
  4. Si alguna vez cambias de tableta o se borran tus datos, simplemente ve a la app, haz clic en **Respaldar Datos** -> **Importar Datos** (Seleccionar Archivo) y selecciona tu archivo JSON guardado para recuperar toda tu información de inmediato.
