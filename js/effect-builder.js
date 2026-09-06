// Constructor compartido de "Gatillo -> Condición -> Acción" y "Bono Pasivo".
// Usado por admin/characters.html y admin/equipment.html para que ambas herramientas
// apunten exactamente a la misma estructura de datos y a la misma base de Gatillos/Condiciones.

const NexoStatOptions = [
  { id: 'danoFisico', nombre: 'Daño Físico' },
  { id: 'danoElemental', nombre: 'Daño Elemental' },
  { id: 'danoEspecial', nombre: 'Daño Especial' },
  { id: 'defensa', nombre: 'Defensa' },
  { id: 'sabiduria', nombre: 'Sabiduría' },
  { id: 'roboDeVida', nombre: 'Robo de Vida' },
  { id: 'hp', nombre: 'HP' },
  { id: 'regeneracion', nombre: 'Regeneración' },
  { id: 'velocidad', nombre: 'Velocidad' },
  { id: 'esquivar', nombre: 'Esquivar' },
  { id: 'critico', nombre: 'Crítico' },
  { id: 'bloqueo', nombre: 'Bloqueo' },
  { id: 'resHielo', nombre: 'Res. Hielo' },
  { id: 'resVeneno', nombre: 'Res. Veneno' },
  { id: 'resFuego', nombre: 'Res. Fuego' },
  { id: 'resRayo', nombre: 'Res. Rayo' },
  { id: 'resEspecial', nombre: 'Res. Especial' },
  { id: 'armadura', nombre: 'Armadura' },
];

const NexoMoveTargetOptions = [
  { id: 'st', nombre: 'ST (un enemigo objetivo)' },
  { id: 'aoe', nombre: 'AOE (todos los enemigos)' },
  { id: 'mt', nombre: 'MT (varios enemigos)' },
  { id: 'self', nombre: 'SELF (a sí mismo)' },
  { id: 'aliado_1', nombre: '1 Aliado Objetivo' },
  { id: 'aliado_2', nombre: '2 Aliados Objetivo' },
  { id: 'todos_aliados', nombre: 'Todos los Aliados' },
  { id: 'aliado_aleatorio_1', nombre: '1 Aliado Aleatorio' },
  { id: 'aliado_aleatorio_2', nombre: '2 Aliados Aleatorios' },
];

const NexoTargetOptions = [
  { id: 'portador', nombre: 'El propio personaje' },
  { id: 'objetivo', nombre: 'El objetivo del ataque' },
  { id: 'aliadoAleatorio', nombre: 'Un aliado aleatorio' },
  { id: 'todosAliados', nombre: 'Todos los aliados' },
  { id: 'todosEnemigos', nombre: 'Todos los enemigos' },
];

let _effectRegistryCache = null;
async function loadEffectRegistries() {
  if (_effectRegistryCache) return _effectRegistryCache;
  const [effectsData, triggers, conditions] = await Promise.all([
    NexoData.effects(), NexoData.triggers(), NexoData.conditions()
  ]);
  _effectRegistryCache = {
    estadoOpts: effectsData.efectosDeEstado,
    buffOpts: effectsData.buffs,
    debuffOpts: effectsData.debuffs,
    triggers, conditions,
  };
  return _effectRegistryCache;
}

// Construye UN bloque editable de Gatillo->Condición->Acción / Bono Pasivo, ya cableado
// con sus listeners. Lo usan tanto las 5 pasivas (cantidad fija por rareza) como los
// efectos adicionales de los movimientos (lista libre, se puede agregar/quitar).
function buildEffectSlotNode(reg, data, headerHtml) {
  const { estadoOpts, buffOpts, debuffOpts, triggers, conditions } = reg;
  const slot = document.createElement('div');
  slot.className = 'effect-slot';
  slot.innerHTML = `
    ${headerHtml || ''}
    <div class="block-box" style="margin:6px 0 14px;">
      <div class="row">
        <div class="field">
          <label>Modo</label>
          <select class="f-modo">
            <option value="pasivo">Bono pasivo de estadística (siempre activo)</option>
            <option value="tce">Gatillo → Condición → Acción</option>
          </select>
        </div>
      </div>
      <div class="modo-pasivo">
        <div class="row">
          <div class="field">
            <label>Estadística</label>
            <select class="f-stat">${NexoStatOptions.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Valor (%, o puntos si aplica)</label>
            <input type="number" class="f-valor" value="10" />
          </div>
        </div>
      </div>
      <div class="modo-tce" style="display:none;">
        <div class="row">
          <div class="field">
            <label>Gatillo</label>
            <select class="f-gatillo">${triggers.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Condición</label>
            <select class="f-condicion">${conditions.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Acción</label>
            <select class="f-accion">
              <option value="efectoEstado">Aplicar Efecto de Estado</option>
              <option value="buff">Aplicar Buff</option>
              <option value="debuff">Aplicar Debuff</option>
              <option value="dano">Infligir Daño</option>
              <option value="cargas">Generar Cargas</option>
              <option value="curar">Curar</option>
            </select>
          </div>
          <div class="field">
            <label>Objetivo</label>
            <select class="f-objetivo">${NexoTargetOptions.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}</select>
          </div>
        </div>
        <div class="row accion-params"></div>
      </div>
    </div>
  `;

  const modoSel = slot.querySelector('.f-modo');
  const pasivoBox = slot.querySelector('.modo-pasivo');
  const tceBox = slot.querySelector('.modo-tce');
  modoSel.addEventListener('change', () => {
    pasivoBox.style.display = modoSel.value === 'pasivo' ? '' : 'none';
    tceBox.style.display = modoSel.value === 'tce' ? '' : 'none';
  });

  const accionSel = slot.querySelector('.f-accion');
  const paramsBox = slot.querySelector('.accion-params');
  function renderAccionParams() {
    const tipo = accionSel.value;
    if (tipo === 'efectoEstado') {
      paramsBox.innerHTML = `
        <div class="field"><label>Efecto</label><select class="f-efecto-id">${estadoOpts.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}</select></div>
        <div class="field"><label>% (si aplica)</label><input type="number" class="f-pct" value="10" /></div>`;
    } else if (tipo === 'buff') {
      paramsBox.innerHTML = `
        <div class="field"><label>Buff</label><select class="f-efecto-id">${buffOpts.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}</select></div>
        <div class="field"><label>% de incremento</label><input type="number" class="f-pct" value="10" /></div>`;
    } else if (tipo === 'debuff') {
      paramsBox.innerHTML = `
        <div class="field"><label>Debuff</label><select class="f-efecto-id">${debuffOpts.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}</select></div>
        <div class="field"><label>% de reducción</label><input type="number" class="f-pct" value="10" /></div>`;
    } else if (tipo === 'dano') {
      paramsBox.innerHTML = `
        <div class="field"><label>Tipo de Daño</label><select class="f-tipodano"><option value="fisico">Físico</option><option value="elemental">Elemental</option><option value="especial">Especial</option></select></div>
        <div class="field"><label>Sub-tipo elemental (opcional)</label><select class="f-subtipo"><option value="">—</option><option value="hielo">Hielo</option><option value="veneno">Veneno</option><option value="fuego">Fuego</option><option value="rayo">Rayo</option></select></div>
        <div class="field"><label>% del stat de daño</label><input type="number" class="f-pct" value="100" /></div>`;
    } else if (tipo === 'cargas') {
      paramsBox.innerHTML = `<div class="field"><label>Cantidad de Cargas</label><input type="number" class="f-pct" value="5" /></div>`;
    } else if (tipo === 'curar') {
      paramsBox.innerHTML = `<div class="field"><label>% de curación (sobre HP máximo)</label><input type="number" class="f-pct" value="10" /></div>`;
    }
  }
  accionSel.addEventListener('change', renderAccionParams);
  renderAccionParams();

  if (data) {
    modoSel.value = data.modo || 'pasivo';
    modoSel.dispatchEvent(new Event('change'));
    if (data.modo === 'pasivo') {
      slot.querySelector('.f-stat').value = data.stat || 'danoFisico';
      slot.querySelector('.f-valor').value = data.valor ?? 10;
    } else if (data.modo === 'tce') {
      slot.querySelector('.f-gatillo').value = data.gatillo || '';
      slot.querySelector('.f-condicion').value = data.condicion || 'siempre';
      accionSel.value = data.accion?.tipo || 'efectoEstado';
      accionSel.dispatchEvent(new Event('change'));
      slot.querySelector('.f-objetivo').value = data.objetivo || 'objetivo';
      const idSel = slot.querySelector('.f-efecto-id');
      if (idSel && data.accion?.id) idSel.value = data.accion.id;
      const pctInput = slot.querySelector('.f-pct');
      if (pctInput && data.accion?.pct != null) pctInput.value = data.accion.pct;
      const tipoDanoSel = slot.querySelector('.f-tipodano');
      if (tipoDanoSel && data.accion?.tipoDano) tipoDanoSel.value = data.accion.tipoDano;
      const subtipoSel = slot.querySelector('.f-subtipo');
      if (subtipoSel && data.accion?.subtipo) subtipoSel.value = data.accion.subtipo;
    }
  }
  return slot;
}

// Lista fija de N slots (usada por las 5 pasivas, desbloqueo por rareza).
async function renderEffectSlots(container, { count = 5, unlockCounts, initial = [] } = {}) {
  const reg = await loadEffectRegistries();
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const rarezaQueDesbloquea = unlockCounts ? Object.entries(unlockCounts).find(([r, n]) => n === i + 1) : null;
    const header = `<div class="tag">Efecto ${i + 1} ${rarezaQueDesbloquea ? `— se desbloquea en rareza ${rarezaQueDesbloquea[0]}` : ''}</div>`;
    const slot = buildEffectSlotNode(reg, initial[i], header);
    slot.dataset.index = i;
    container.appendChild(slot);
  }
}

// Lista libre (agregar/quitar) de efectos adicionales. Usada por cada Movimiento, para
// que un movimiento pueda, además de su daño base, aplicar efectos de estado/buffs/debuffs
// bajo el mismo sistema universal de Gatillo->Condición->Acción que ya usan pasivas y equipo.
async function renderEffectList(container, initial = []) {
  const reg = await loadEffectRegistries();
  container.innerHTML = '';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn secondary';
  addBtn.textContent = '+ Agregar Efecto';

  function addSlot(data) {
    const idx = container.querySelectorAll('.effect-slot').length;
    const header = `<div class="tag">Efecto adicional ${idx + 1}
      <button type="button" class="btn danger" style="float:right;padding:2px 10px;font-size:11px;">Quitar</button>
    </div>`;
    const slot = buildEffectSlotNode(reg, data, header);
    slot.querySelector('.tag button').addEventListener('click', () => {
      slot.remove();
      renumber();
    });
    container.insertBefore(slot, addBtn);
  }

  function renumber() {
    container.querySelectorAll('.effect-slot .tag').forEach((tag, i) => {
      tag.childNodes[0].textContent = `Efecto adicional ${i + 1} `;
    });
  }

  addBtn.addEventListener('click', () => { addSlot(); renumber(); });
  container.appendChild(addBtn);
  initial.forEach(addSlot);
}

// Todo personaje tiene exactamente 4 movimientos, en este orden fijo:
// 1 Básico, 2 y 3 Especiales, 4 Ultimate.
const NexoMoveRoles = [
  { rol: 'basico', etiqueta: 'Movimiento 1 — Básico', costoDefault: 0 },
  { rol: 'especial', etiqueta: 'Movimiento 2 — Especial', costoDefault: 3 },
  { rol: 'especial', etiqueta: 'Movimiento 3 — Especial', costoDefault: 3 },
  { rol: 'ultimate', etiqueta: 'Movimiento 4 — Ultimate', costoDefault: 6 },
];

async function renderMovimientoSlots(container, initial = []) {
  container.innerHTML = '';
  for (let i = 0; i < NexoMoveRoles.length; i++) {
    const info = NexoMoveRoles[i];
    const data = initial[i];
    const slot = document.createElement('div');
    slot.className = 'block-box';
    slot.dataset.movIndex = i;
    slot.innerHTML = `
      <h4>${info.etiqueta}</h4>
      <div class="row">
        <div class="field"><label>Nombre</label><input class="mv-nombre" value="${data?.nombre || ''}" /></div>
        <div class="field"><label>Tipo de Objetivo</label>
          <select class="mv-objetivo">${NexoMoveTargetOptions.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div class="field"><label>Costo de Cargas</label><input type="number" class="mv-costo" value="${data?.costoCargas ?? info.costoDefault}" /></div>
        <div class="field"><label>Cargas Generadas al usarlo</label><input type="number" class="mv-genera" value="${data?.cargasGeneradas ?? 0}" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Tipo de Daño</label>
          <select class="mv-tipo">
            <option value="fisico">Físico</option>
            <option value="elemental">Elemental</option>
            <option value="especial">Especial</option>
          </select>
        </div>
        <div class="field"><label>% del stat de daño</label><input type="number" class="mv-pct" value="${data?.porcentaje ?? 100}" /></div>
      </div>
      <div class="field">
        <label>Efectos adicionales (Gatillo → Condición → Acción, opcional)</label>
        <div class="effects-list mv-efectos"></div>
      </div>
    `;
    if (data?.objetivo) slot.querySelector('.mv-objetivo').value = data.objetivo;
    if (data?.tipoDano) slot.querySelector('.mv-tipo').value = data.tipoDano;
    container.appendChild(slot);
    await renderEffectList(slot.querySelector('.mv-efectos'), data?.efectos || []);
  }
}

function serializeMovimientoSlots(container) {
  return Array.from(container.querySelectorAll('[data-mov-index]')).map((slot, i) => ({
    rol: NexoMoveRoles[i].rol,
    nombre: slot.querySelector('.mv-nombre').value,
    objetivo: slot.querySelector('.mv-objetivo').value,
    costoCargas: Number(slot.querySelector('.mv-costo').value) || 0,
    cargasGeneradas: Number(slot.querySelector('.mv-genera').value) || 0,
    tipoDano: slot.querySelector('.mv-tipo').value,
    porcentaje: Number(slot.querySelector('.mv-pct').value) || 0,
    efectos: serializeEffectSlots(slot.querySelector('.mv-efectos')),
  }));
}

function serializeEffectSlots(container) {
  return Array.from(container.querySelectorAll('.effect-slot')).map(slot => {
    const modo = slot.querySelector('.f-modo').value;
    if (modo === 'pasivo') {
      return {
        modo: 'pasivo',
        stat: slot.querySelector('.f-stat').value,
        valor: Number(slot.querySelector('.f-valor').value) || 0,
      };
    }
    const accionTipo = slot.querySelector('.f-accion').value;
    const accion = { tipo: accionTipo };
    const idSel = slot.querySelector('.f-efecto-id');
    if (idSel) accion.id = idSel.value;
    const pctInput = slot.querySelector('.f-pct');
    if (pctInput) accion.pct = Number(pctInput.value) || 0;
    const tipoDanoSel = slot.querySelector('.f-tipodano');
    if (tipoDanoSel) accion.tipoDano = tipoDanoSel.value;
    const subtipoSel = slot.querySelector('.f-subtipo');
    if (subtipoSel && subtipoSel.value) accion.subtipo = subtipoSel.value;
    return {
      modo: 'tce',
      gatillo: slot.querySelector('.f-gatillo').value,
      condicion: slot.querySelector('.f-condicion').value,
      objetivo: slot.querySelector('.f-objetivo').value,
      accion,
    };
  });
}
