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

const NexoTargetOptions = [
  { id: 'portador', nombre: 'El propio personaje' },
  { id: 'objetivo', nombre: 'El objetivo del ataque' },
  { id: 'aliadoAleatorio', nombre: 'Un aliado aleatorio' },
  { id: 'todosAliados', nombre: 'Todos los aliados' },
  { id: 'todosEnemigos', nombre: 'Todos los enemigos' },
];

async function renderEffectSlots(container, { count = 5, unlockCounts, initial = [] } = {}) {
  const [effectsData, triggers, conditions] = await Promise.all([
    NexoData.effects(), NexoData.triggers(), NexoData.conditions()
  ]);
  const estadoOpts = effectsData.efectosDeEstado;
  const buffOpts = effectsData.buffs;
  const debuffOpts = effectsData.debuffs;

  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const rarezaQueDesbloquea = unlockCounts ? Object.entries(unlockCounts).find(([r, n]) => n === i + 1) : null;
    const slot = document.createElement('div');
    slot.className = 'effect-slot';
    slot.dataset.index = i;
    slot.innerHTML = `
      <div class="tag">Efecto ${i + 1} ${rarezaQueDesbloquea ? `— se desbloquea en rareza ${rarezaQueDesbloquea[0]}` : ''}</div>
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
    container.appendChild(slot);

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

    // aplicar valores iniciales si se está editando una carta existente
    const data = initial[i];
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
  }
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
