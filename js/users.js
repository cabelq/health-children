/* Módulo Users — gestión de usuarios familiares (solo admin) */
window.UsersModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  const ROLE_LABELS = {
    admin: { label: "Administrador", color: "#dc2626", desc: "Acceso total: gestiona usuarios, niños y datos" },
    member: { label: "Editor", color: "#2563eb", desc: "Puede registrar atenciones, vacunas, mediciones" },
    viewer: { label: "Solo lectura", color: "#6b7280", desc: "Puede ver la información pero no modificarla" },
  };

  function roleInfo(role) { return ROLE_LABELS[role] || ROLE_LABELS.viewer; }

  function renderList() {
    const me = Auth.getCurrentUser();
    if (!Auth.isAdmin()) {
      document.getElementById("users-content").innerHTML =
        `<div class="alert medium"><span class="ico">🔒</span><div>Solo los administradores pueden gestionar usuarios.</div></div>`;
      return;
    }

    const users = Storage.listUsers();

    document.getElementById("users-content").innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>Miembros de la familia (${users.length})</h3>
          <button class="btn primary" id="btn-new-user">+ Agregar miembro</button>
        </div>
        <div class="list">
          ${users.map(u => {
            const info = roleInfo(u.role);
            const isMe = u.id === me.userId;
            return `<div class="list-item">
              <div class="avatar" style="background:${info.color};color:#fff;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">${esc((u.displayName || u.username)[0].toUpperCase())}</div>
              <div class="grow">
                <div class="title">${esc(u.displayName)} ${isMe ? '<small style="color:var(--muted)">(vos)</small>' : ''}</div>
                <div class="sub">@${esc(u.username)} · <span class="badge" style="background:${info.color}22;color:${info.color}">${esc(info.label)}</span></div>
                <div class="sub" style="margin-top:4px">Último acceso: ${u.lastLogin ? new Date(u.lastLogin).toLocaleString("es-AR") : "Nunca"}</div>
              </div>
              <button class="btn sm" data-edit-user="${u.id}">Editar rol</button>
              ${!isMe ? `<button class="btn sm danger" data-del-user="${u.id}">Eliminar</button>` : ""}
            </div>`;
          }).join("")}
        </div>
        <p class="hint" style="margin-top:12px">
          🔒 Las contraseñas se guardan hasheadas (PBKDF2-SHA256 con 100k iteraciones) en la base local. No salen del dispositivo.
        </p>
      </div>
    `;

    document.getElementById("btn-new-user").onclick = () => openForm(null);
    document.querySelectorAll("[data-edit-user]").forEach(btn => {
      btn.onclick = () => openForm(Storage.getUser(btn.dataset.editUser));
    });
    document.querySelectorAll("[data-del-user]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("¿Eliminar este usuario? No se borran los datos de los niños.")) {
          Storage.deleteUser(btn.dataset.delUser);
          App.toast("Usuario eliminado");
          renderList();
        }
      };
    });
  }

  async function openForm(existing) {
    const isEdit = !!existing;
    const u = existing || { username: "", displayName: "", role: "member" };
    const me = Auth.getCurrentUser();
    const roles = Object.entries(ROLE_LABELS);

    App.openModal({
      title: isEdit ? "Editar miembro" : "Nuevo miembro",
      body: `
        <form id="user-form">
          <div class="field">
            <label>Nombre para mostrar *</label>
            <input type="text" name="displayName" required placeholder="Ej: Mamá, Papá, Abuela Marta..." value="${esc(u.displayName)}" />
          </div>
          ${isEdit ? "" : `
            <div class="field">
              <label>Usuario (para login) *</label>
              <input type="text" name="username" required placeholder="Sin espacios, todo minúscula" value="${esc(u.username)}" autocomplete="off" />
            </div>
          `}
          <div class="field">
            <label>${isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</label>
            <input type="password" name="password" ${isEdit ? "" : "required"} minlength="4" placeholder="${isEdit ? "Sin cambios" : "Mínimo 4 caracteres"}" autocomplete="new-password" />
          </div>
          <div class="field">
            <label>Rol *</label>
            <select name="role" required>
              ${roles.map(([val, info]) => `<option value="${val}" ${u.role === val ? "selected" : ""}>${esc(info.label)} — ${esc(info.desc)}</option>`).join("")}
            </select>
          </div>
          ${isEdit && u.id === me.userId ? `<p class="hint">⚠ Estás editando tu propio usuario. Si cambiás tu rol a algo que no sea admin, perderás la capacidad de gestionar usuarios.</p>` : ""}
        </form>
      `,
      footer: [
        { label: "Cancelar", class: "btn", action: "close" },
        { label: isEdit ? "Guardar" : "Crear", class: "btn primary", action: async () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("user-form")));
          if (!fd.displayName || (!isEdit && (!fd.username || !fd.password))) {
            App.toast("Faltan datos"); return;
          }
          try {
            if (isEdit) {
              const patch = { displayName: fd.displayName, role: fd.role };
              if (fd.password) {
                const salt = Auth.generateSalt();
                patch.passwordHash = await Auth.hashPassword(fd.password, salt);
                patch.salt = salt;
              }
              Storage.updateUser(u.id, patch);
              // También guardar rol explícito (no hay updateUser público, lo hago directo)
              Storage.updateUserRole(u.id, fd.role);
              App.toast("Usuario actualizado");
            } else {
              await Auth.register({ username: fd.username, displayName: fd.displayName, password: fd.password, role: fd.role });
              App.toast("Usuario creado");
            }
            App.closeModal();
            renderList();
          } catch (e) {
            App.toast("Error: " + e.message);
          }
        }},
      ],
    });
  }

  return { renderList, openForm, roleInfo };
})();