# SIGTE - Sistema Integral de Gestión de Talleres Escolares

Sistema web completo para la gestión de talleres escolares, desarrollado con Next.js 15, Firebase y TypeScript.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Requisitos Previos](#requisitos-previos)
- [Instalación Local](#instalación-local)
- [Configuración de Firebase](#configuración-de-firebase)
- [Configuración de Cloudinary](#configuración-de-cloudinary)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Despliegue](#despliegue)
- [Solución de Problemas](#solución-de-problemas)

## ✨ Características

- **Gestión de Talleres**: Crear, editar y eliminar talleres con restricciones por sección
- **Sistema de Inscripciones**: Los estudiantes pueden inscribirse en talleres disponibles
- **Control de Asistencia**: Registro y seguimiento de asistencia
- **Roles de Usuario**: Admin, Profesor, Estudiante y Padre
- **Autenticación**: Sistema completo con Firebase Authentication
- **Mensajería**: Sistema de mensajes entre usuarios
- **Notificaciones**: Sistema de notificaciones en tiempo real
- **Responsive**: Diseño adaptable a todos los dispositivos

## 🔧 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (versión 18.x o superior)
  ```bash
  node --version  # Debe mostrar v18.x.x o superior
  ```

- **npm** (viene con Node.js) o **yarn**
  ```bash
  npm --version   # Debe mostrar 9.x.x o superior
  ```

- **Git**
  ```bash
  git --version
  ```

- Una cuenta de **Firebase** (gratuita)
- Una cuenta de **Cloudinary** (gratuita) para almacenamiento de imágenes

## 📦 Instalación Local

### 1. Clonar el Repositorio

```bash
# Clonar el proyecto
git clone https://github.com/Dontoti02/web-sigte.git

# Entrar al directorio
cd web-sigte
```

### 2. Instalar Dependencias

```bash
# Con npm
npm install

# O con yarn
yarn install
```

**Nota**: Si tienes XAMPP/LAMPP instalado y encuentras errores de librerías, usa:
```bash
LD_LIBRARY_PATH="" npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
touch .env.local
```

Agrega las siguientes variables (las completarás después de configurar Firebase y Cloudinary):

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset
```

## 🔥 Configuración de Firebase

### 1. Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Ingresa el nombre del proyecto (ej: "SIGTE-Produccion")
4. Desactiva Google Analytics (opcional)
5. Haz clic en "Crear proyecto"

### 2. Configurar Firebase Authentication

1. En el menú lateral, ve a **Authentication**
2. Haz clic en "Comenzar"
3. Habilita los siguientes métodos de inicio de sesión:
   - **Correo electrónico/contraseña**: Actívalo
   - **Google** (opcional): Configúralo si lo deseas

### 3. Configurar Firestore Database

1. En el menú lateral, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Selecciona el modo:
   - **Modo de producción** (recomendado para producción)
   - **Modo de prueba** (solo para desarrollo, expira en 30 días)
4. Selecciona la ubicación más cercana (ej: `southamerica-east1`)
5. Haz clic en "Habilitar"

### 4. Configurar Reglas de Seguridad de Firestore

En la pestaña **Reglas**, reemplaza el contenido con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función para verificar si el usuario está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Función para verificar el rol del usuario
    function hasRole(role) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
    
    // Función para verificar si es el mismo usuario
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Colección de usuarios
    match /users/{userId} {
      // Lectura: solo el propio usuario o admins
      allow read: if isOwner(userId) || hasRole('admin');
      // Escritura: solo admins pueden crear/actualizar usuarios
      allow write: if hasRole('admin');
    }
    
    // Colección de estudiantes (legacy)
    match /students/{studentId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('admin');
    }
    
    // Colección de talleres
    match /workshops/{workshopId} {
      // Lectura: todos los usuarios autenticados
      allow read: if isAuthenticated();
      // Escritura: solo admins y profesores
      allow create: if hasRole('admin') || hasRole('teacher');
      allow update: if hasRole('admin') || hasRole('teacher');
      allow delete: if hasRole('admin');
    }
    
    // Colección de asistencias
    match /attendances/{attendanceId} {
      // Lectura: todos los usuarios autenticados
      allow read: if isAuthenticated();
      // Escritura: solo admins y profesores
      allow write: if hasRole('admin') || hasRole('teacher');
    }
    
    // Colección de mensajes
    match /messages/{messageId} {
      // Lectura: solo el remitente o destinatario
      allow read: if isAuthenticated() && 
                     (resource.data.senderId == request.auth.uid || 
                      resource.data.recipientId == request.auth.uid);
      // Escritura: solo el remitente
      allow create: if isAuthenticated() && request.resource.data.senderId == request.auth.uid;
      allow update: if isAuthenticated() && 
                       (resource.data.senderId == request.auth.uid || 
                        resource.data.recipientId == request.auth.uid);
    }
    
    // Colección de notificaciones
    match /notifications/{notificationId} {
      // Lectura: solo el usuario destinatario
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      // Escritura: admins y el propio usuario (para marcar como leído)
      allow create: if hasRole('admin');
      allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }
  }
}
```

Haz clic en **Publicar** para guardar las reglas.

### 5. Obtener Credenciales de Firebase

1. Ve a **Configuración del proyecto** (ícono de engranaje)
2. En la sección "Tus apps", haz clic en el ícono web `</>`
3. Registra tu app con un nombre (ej: "SIGTE Web")
4. **NO** marques "Configurar Firebase Hosting"
5. Copia las credenciales que aparecen:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Pega estos valores en tu archivo `.env.local`

### 6. Crear Colecciones Iniciales en Firestore

1. Ve a **Firestore Database**
2. Haz clic en "Iniciar colección"
3. Crea las siguientes colecciones (solo crea la estructura, no agregues documentos aún):

   - `users` - Para almacenar usuarios
   - `workshops` - Para talleres
   - `attendances` - Para asistencias
   - `messages` - Para mensajes
   - `notifications` - Para notificaciones

### 7. Crear Usuario Administrador Inicial

**Opción A: Desde la aplicación (Recomendado)**

1. Inicia la aplicación localmente
2. Ve a la página de registro
3. Crea un usuario con tu correo
4. Ve a Firebase Console → Authentication
5. Copia el UID del usuario
6. Ve a Firestore Database → Colección `users`
7. Busca el documento con ese UID
8. Edita el campo `role` y cámbialo a `"admin"`

**Opción B: Manualmente en Firestore**

1. Ve a **Authentication** → **Users**
2. Haz clic en "Agregar usuario"
3. Ingresa email y contraseña
4. Copia el UID generado
5. Ve a **Firestore Database**
6. En la colección `users`, haz clic en "Agregar documento"
7. ID del documento: pega el UID copiado
8. Agrega los siguientes campos:

```javascript
{
  id: "el-mismo-uid",
  email: "admin@ejemplo.com",
  firstName: "Admin",
  lastName: "Sistema",
  name: "Admin Sistema",
  role: "admin",
  photoURL: "",
  createdAt: new Date().toISOString()
}
```

## 🖼️ Configuración de Cloudinary

### 1. Crear Cuenta en Cloudinary

1. Ve a [Cloudinary](https://cloudinary.com/)
2. Haz clic en "Sign Up for Free"
3. Completa el registro

### 2. Obtener Credenciales

1. En el Dashboard, encontrarás:
   - **Cloud Name**: Tu nombre de nube
   - **API Key**: Tu clave API
   - **API Secret**: Tu secreto API (no lo necesitas para el frontend)

### 3. Crear Upload Preset

1. Ve a **Settings** → **Upload**
2. Scroll hasta "Upload presets"
3. Haz clic en "Add upload preset"
4. Configura:
   - **Preset name**: `sigte_uploads` (o el nombre que prefieras)
   - **Signing mode**: **Unsigned**
   - **Folder**: `sigte` (opcional, para organizar)
5. Haz clic en "Save"

### 4. Agregar Credenciales al .env.local

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=sigte_uploads
```

## 🚀 Ejecutar el Proyecto

### Modo Desarrollo

```bash
# Con npm
npm run dev

# Con yarn
yarn dev

# Si tienes problemas con XAMPP/LAMPP
LD_LIBRARY_PATH="" npm run dev
```

La aplicación estará disponible en: **http://localhost:3000**

### Modo Producción

```bash
# Construir la aplicación
npm run build

# Iniciar en modo producción
npm start
```

## 📁 Estructura del Proyecto

```
web-sigte/
├── src/
│   ├── app/                    # Páginas de Next.js (App Router)
│   │   ├── (auth)/            # Rutas de autenticación
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── dashboard/         # Panel principal
│   │   │   ├── talleres/      # Gestión de talleres
│   │   │   ├── asistencia/    # Control de asistencia
│   │   │   ├── mensajes/      # Sistema de mensajes
│   │   │   └── perfil/        # Perfil de usuario
│   │   └── layout.tsx
│   ├── components/            # Componentes reutilizables
│   │   ├── ui/               # Componentes de UI (shadcn/ui)
│   │   └── dashboard/        # Componentes del dashboard
│   ├── firebase/             # Configuración de Firebase
│   │   ├── config.ts         # Credenciales
│   │   └── index.ts          # Hooks y utilidades
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilidades y tipos
│   │   ├── types.ts          # Tipos TypeScript
│   │   └── cloudinary.ts     # Configuración Cloudinary
│   └── styles/               # Estilos globales
├── public/                   # Archivos estáticos
├── .env.local               # Variables de entorno (NO subir a Git)
├── next.config.js           # Configuración de Next.js
├── package.json             # Dependencias
├── tailwind.config.ts       # Configuración de Tailwind
└── tsconfig.json            # Configuración de TypeScript
```

## 🌐 Despliegue

### Despliegue en Vercel (Recomendado)

1. Crea una cuenta en [Vercel](https://vercel.com)
2. Instala Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Desde la raíz del proyecto:
   ```bash
   vercel
   ```
4. Sigue las instrucciones
5. Agrega las variables de entorno en el dashboard de Vercel:
   - Ve a tu proyecto → Settings → Environment Variables
   - Agrega todas las variables de `.env.local`

### Despliegue en Netlify

1. Crea una cuenta en [Netlify](https://netlify.com)
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
4. Agrega las variables de entorno en Settings → Environment Variables

### Despliegue en Firebase Hosting

1. Instala Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Inicia sesión:
   ```bash
   firebase login
   ```
3. Inicializa Firebase Hosting:
   ```bash
   firebase init hosting
   ```
4. Construye el proyecto:
   ```bash
   npm run build
   ```
5. Despliega:
   ```bash
   firebase deploy
   ```

## 🔧 Solución de Problemas

### Error: "GLIBCXX not found" (Linux con XAMPP/LAMPP)

Si tienes XAMPP/LAMPP instalado, puede haber conflictos con las librerías. Solución:

```bash
# Para instalar dependencias
LD_LIBRARY_PATH="" npm install

# Para ejecutar el proyecto
LD_LIBRARY_PATH="" npm run dev

# Para comandos de Git
LD_LIBRARY_PATH="" git push origin main
```

### Error: "Firebase: Error (auth/configuration-not-found)"

Verifica que:
1. Las variables de entorno en `.env.local` estén correctas
2. El archivo `.env.local` esté en la raíz del proyecto
3. Hayas reiniciado el servidor de desarrollo después de crear `.env.local`

### Error: "Permission denied" en Firestore

Verifica que:
1. Las reglas de seguridad de Firestore estén configuradas correctamente
2. El usuario esté autenticado
3. El usuario tenga el rol correcto en la colección `users`

### Error al subir imágenes a Cloudinary

Verifica que:
1. El upload preset esté configurado como "Unsigned"
2. Las credenciales en `.env.local` sean correctas
3. El nombre del preset coincida con el configurado

### El puerto 3000 ya está en uso

```bash
# Encuentra el proceso usando el puerto
lsof -i :3000

# Mata el proceso (reemplaza PID con el número que aparece)
kill -9 PID

# O usa otro puerto
npm run dev -- -p 3001
```

### Problemas con TypeScript

```bash
# Limpia la caché de Next.js
rm -rf .next

# Reinstala dependencias
rm -rf node_modules package-lock.json
npm install
```

## 📝 Notas Importantes

1. **Seguridad**:
   - NUNCA subas el archivo `.env.local` a Git
   - Mantén las reglas de Firestore actualizadas
   - Usa variables de entorno para credenciales sensibles

2. **Base de Datos**:
   - Haz backups regulares de Firestore
   - Monitorea el uso para evitar costos inesperados
   - Usa índices compuestos cuando sea necesario

3. **Rendimiento**:
   - Optimiza las imágenes antes de subirlas
   - Usa paginación para listas grandes
   - Implementa caché cuando sea posible

## 🤝 Contribuir

Si deseas contribuir al proyecto:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 👥 Soporte

Si tienes problemas o preguntas:
- Abre un issue en GitHub
- Contacta al equipo de desarrollo

---

**Desarrollado con ❤️ para la gestión eficiente de talleres escolares**