# 🩺 SaludInfantil — Seguimiento pediátrico familiar (v2)

Aplicación web (PWA, sin backend) para registrar atenciones, vacunas, crecimiento, citas y medicación de los hijos de la familia. Todo se guarda **localmente en tu navegador**.

## ✨ Funcionalidades

### 👶 Ficha por niño
- Datos personales: nombre, apellido, fecha de nacimiento, sexo, grupo sanguíneo, pediatra.
- Color de perfil para identificar visualmente cada niño.
- Alergias y notas generales.
- **Registro de atenciones** con motivo (autocompletado: control sano, fiebre, tos, diarrea...), diagnóstico, tratamiento y notas.
- **Galería de fotos**: adjuntar fotos de erupciones, certificados de vacunas, análisis, etc.
- Badge de alerta clínica automático cuando la última medición está fuera de percentiles.

### 💉 Esquema de vacunación por país (19 países)
Incluye calendarios oficiales de:
- 🇦🇷 Argentina, 🇲🇽 México, 🇪🇸 España, 🇨🇱 Chile, 🇨🇴 Colombia, 🇵🇪 Perú, 🇧🇷 Brasil, 🇺🇾 Uruguay, 🇺🇸 EEUU
- 🇻🇪 Venezuela, 🇧🇴 Bolivia, 🇪🇨 Ecuador, 🇵🇾 Paraguay, 🇨🇷 Costa Rica, 🇵🇦 Panamá, 🇩🇴 Rep. Dominicana, 🇨🇺 Cuba, 🇬🇹 Guatemala, 🇭🇳 Honduras

Cada esquema muestra estado: pendiente / atrasada / aplicada, con fecha, lote y centro.

### 📅 Calendario de citas
- Vista mensual tipo calendario con eventos coloreados (vacunas, citas, medicación).
- Citas con tipo: control sano, vacuna, especialista, estudios, dentista, otro.
- Recordatorio por cita y por navegador.

### 📊 Crecimiento OMS completo
- **Curvas percentiladas** P3, P15, P50, P85, P97 oficiales (OMS 2006 + 2007):
  - Peso / Edad (0-10 años)
  - Talla / Edad (0-19 años)
  - IMC / Edad (0-19 años)
  - **Perímetro cefálico / Edad (0-5 años)** — crítico en menores de 2 años
- Cálculo de percentiles individuales con la fórmula LMS oficial.
- **Alertas clínicas automáticas** cuando peso, talla, IMC o PC salen de P3-P97.
- Historial con búsqueda.

### 💊 Medicación
- Registro por niño: nombre, dosis, frecuencia, desde/hasta.
- Activos vs histórico, marcar como finalizado.

### 🔔 Notificaciones del navegador
- Aviso de vacunas atrasadas.
- Aviso de citas próximas (hoy y mañana).
- Pide permiso una vez, después funciona solo.

### 📰 Noticias
- Feed de la **OMS** (internacional).
- Feed de la **sociedad pediátrica del país** (SAP, AEP, AAP, SBP, SOCHIPE, etc.).

### 🖨 Vista imprimible
- Botón "Imprimir ficha" → una página prolija con datos, curvas, historial, vacunas y medicación, lista para llevar al pediatra.

### 🌙 Modo oscuro
- Switch con un click. Las curvas y la UI se adaptan automáticamente.

### 📱 PWA instalable
- Funciona offline (service worker).
- Se puede "instalar" como app en el celular/escritorio (Chrome → "Instalar app").

### 💾 Privacidad
- **Todo queda en tu navegador** (localStorage).
- Exportar / Importar JSON para migrar entre dispositivos.
- Fotos se guardan como base64 local.

## 🚀 Cómo usar

1. Descargá la carpeta `health-children`.
2. Abrí el archivo **`index.html`** (landing) en cualquier navegador moderno y hacé click en "Abrir app".
   - Doble click y listo.
   - **O servila con `python -m http.server` para activar la PWA**.
3. (Opcional) En Chrome, hacé click en "Instalar app" para tenerla como aplicación nativa.

## 📂 Estructura

```
health-children/
├── index.html                  ← landing (entrada pública)
├── app.html                    ← aplicación (login + dashboards)
├── manifest.json               ← PWA manifest
├── sw.js                       ← service worker (cache offline)
├── README.md
├── css/styles.css              ← estilos + modo oscuro + print
├── icons/icon.svg              ← ícono de la PWA
├── data/
│   ├── vaccines.js             ← 19 calendarios nacionales
│   └── oms.js                  ← LMS OMS (peso, talla, IMC, PC)
└── js/
    ├── app.js                  ← orquestador
    ├── storage.js              ← persistencia
    ├── children.js             ← fichas, atenciones, fotos
    ├── vaccines.js             ← calendario de vacunación
    ├── appointments.js         ← citas + calendario mensual
    ├── medications.js          ← medicación
    ├── growth.js               ← mediciones + alertas
    ├── charts.js               ← gráficos en canvas
    ├── news.js                 ← RSS OMS + sociedades
    ├── print.js                ← vista imprimible
    ├── notifications.js        ← notificaciones del navegador
    └── theme.js                ← modo claro/oscuro
```

## ⚠️ Aviso médico
Aplicación **orientativa**. Los esquemas de vacunación y las curvas son herramientas de seguimiento; **no reemplazan el criterio del pediatra**. Ante cualquier duda, consultá con un profesional.

---

Hecho con cariño para familias que quieren llevar un registro claro del cuidado de sus hijos. 🧸