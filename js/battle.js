// Prototipo jugable del flujo de partida confirmado por el diseño:
// Ronda 1: Robo(5) -> Invocación(máx 3) -> Batalla -> Final de Ronda
// Ronda 2+: Robo(1) -> Invocación(máx 3, limitado por casillas libres, campo=5) -> Batalla -> Final de Ronda
// Condición de victoria: el primero en quedarse sin personajes en el campo pierde (se revisa
// solo al final de la Fase de Batalla).
//
// SIMPLIFICACIONES DE ESTA PRIMERA VERSIÓN (pendientes de que el diseño las defina):
// - No hay selección manual de movimiento ni de objetivo: cada personaje ejecuta su Ataque
//   Básico sobre un enemigo vivo aleatorio (no se usan Cargas ni Movimientos todavía).
// - No hay equipo equipado (los slots de equipo no están conectados aún a esta batalla).
// - Como los talentos empiezan en 0 y el sistema de nivel/subida aún no está diseñado,
//   se usa una base temporal de estadísticas (TEMP_BASE_STATS + TEMP_TALENT_POINTS) solo
//   para que el combate sea jugable; debe reemplazarse cuando definan el sistema de niveles.

const FIELD_SIZE = 5;

const TEMP_BASE_STATS = {
  danoFisico: 10, danoElemental: 10, danoEspecial: 10, defensa: 5, sabiduria: 5,
  roboDeVida: 5, hp: 100, regeneracion: 5, velocidad: 10, esquivar: 5,
  critico: 5, bloqueo: 5, resHielo: 0, resVeneno: 0, resFuego: 0, resRayo: 0, resEspecial: 0, armadura: 0,
};
const TEMP_TALENT_POINTS = 5; // puntos "de ejemplo" repartidos igual en los 5 talentos

let state = null;

function buildStatsFromTemplate(talentsCfg) {
  const stats = { ...TEMP_BASE_STATS };
  talentsCfg.talentos.forEach(t => {
    const map = talentsCfg.mapeo[t];
    stats[map.primaria] = (stats[map.primaria] || 0) + TEMP_TALENT_POINTS * talentsCfg.puntosPorTalento.primaria;
    stats[map.secundaria] = (stats[map.secundaria] || 0) + TEMP_TALENT_POINTS * talentsCfg.puntosPorTalento.secundaria;
  });
  return stats;
}

function makeBattleCharacter(template, rareza, lado, talentsCfg, unlockCounts) {
  const stats = buildStatsFromTemplate(talentsCfg);
  const desbloqueadas = unlockCounts[rareza] || 1;
  const pasivasActivas = (template.pasivas || []).slice(0, desbloqueadas);
  // los bonos pasivos de estadística ("siempre activos") de las pasivas ya desbloqueadas
  // se suman de una vez a las stats base del personaje para esta batalla.
  pasivasActivas.forEach(p => {
    if (p.modo === 'pasivo' && stats[p.stat] != null) {
      stats[p.stat] += p.valor;
    }
  });
  return {
    instanceId: template.id + '_' + Math.random().toString(36).slice(2, 8),
    templateId: template.id,
    nombre: template.nombre,
    imagenUrl: template.imagenUrl || '',
    rareza,
    lado,
    stats,
    hpMaximo: stats.hp,
    hpActual: stats.hp,
    armaduraActual: stats.armadura,
    efectos: [],
    vivo: true,
    movimientos: template.movimientos || [],
    pasivas: pasivasActivas,
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function log(msg) {
  state.log.unshift(msg);
  renderLog();
}

async function init() {
  const [characters, talentsCfg, rarities] = await Promise.all([
    NexoData.characters(), NexoData.talents(), NexoData.rarities()
  ]);

  const setupArea = document.getElementById('setupArea');
  if (characters.length === 0) {
    setupArea.innerHTML = `No hay personajes creados todavía. Ve al <a href="admin/login.html">Panel de Creador</a> y crea al menos uno para poder jugar una batalla de prueba.`;
    return;
  }

  const coleccion = NexoPlayer.getCollection().filter(c => c.tipo === 'personaje');
  let jugadorTemplates = coleccion.slice(0, 10).map(entry => ({
    template: characters.find(c => c.id === entry.cardId),
    rareza: entry.rareza,
  })).filter(x => x.template);
  if (jugadorTemplates.length === 0) {
    // sin colección jugable (vacía, o sus cartas ya no existen en data/characters.json)
    jugadorTemplates = characters.slice(0, 10).map(t => ({ template: t, rareza: t.rareza }));
    setupArea.innerHTML = `No tienes cartas jugables en tu colección (ve al Mercado a abrir un cofre). Por ahora se arma un mazo de prueba con todos los personajes creados.`;
  }
  const rivalTemplates = characters.slice(0, 10).map(t => ({ template: t, rareza: t.rareza }));

  state = {
    ronda: 1,
    fase: 'inicio',
    talentsCfg, rarities,
    log: [],
    jugador: {
      mazo: shuffle(jugadorTemplates.map(x => makeBattleCharacter(x.template, x.rareza, 'jugador', talentsCfg, rarities.efectosDesbloqueados))),
      mano: [], campo: new Array(FIELD_SIZE).fill(null), cementerio: [],
    },
    rival: {
      mazo: shuffle(rivalTemplates.map(x => makeBattleCharacter(x.template, x.rareza, 'rival', talentsCfg, rarities.efectosDesbloqueados))),
      mano: [], campo: new Array(FIELD_SIZE).fill(null), cementerio: [],
    },
  };

  document.getElementById('fieldLayout').style.display = 'grid';
  setupArea.style.display = setupArea.innerHTML.trim() ? 'block' : 'none';
  document.getElementById('controls').innerHTML = `<button class="btn" onclick="startRound()">Comenzar Partida</button>`;
  renderAll();
}

function drawCards(lado, cantidad) {
  const p = state[lado];
  for (let i = 0; i < cantidad && p.mazo.length > 0; i++) {
    p.mano.push(p.mazo.shift());
  }
}

function freeSlots(lado) {
  return state[lado].campo.filter(s => s === null).length;
}

function startRound() {
  const cantidadRobo = state.ronda === 1 ? 5 : 1;
  drawCards('jugador', cantidadRobo);
  drawCards('rival', cantidadRobo);
  log(`— Ronda ${state.ronda}: fase de Robo (roban ${cantidadRobo}) —`);
  state.fase = 'invocacion';

  // IA invoca automáticamente
  const maxInvocarRival = Math.min(3, freeSlots('rival'), state.rival.mano.length);
  for (let i = 0; i < maxInvocarRival; i++) {
    summon('rival', 0);
  }
  log(`El Rival invoca ${maxInvocarRival} personaje(s).`);

  document.getElementById('controls').innerHTML = `<button class="btn" onclick="goToBattlePhase()">Continuar a Fase de Batalla</button>`;
  renderAll();
}

function summon(lado, handIndex) {
  const p = state[lado];
  if (freeSlots(lado) <= 0) return;
  const maxPorInvocacion = 3; // tope de invocación por fase, además del límite de casillas libres
  p._invocadosEstaFase = (p._invocadosEstaFase || 0);
  if (p._invocadosEstaFase >= maxPorInvocacion) return;
  const card = p.mano.splice(handIndex, 1)[0];
  if (!card) return;
  const slotIndex = p.campo.findIndex(s => s === null);
  p.campo[slotIndex] = card;
  p._invocadosEstaFase++;
  renderAll();
}

function goToBattlePhase() {
  state.jugador._invocadosEstaFase = 0;
  state.rival._invocadosEstaFase = 0;
  state.fase = 'batalla';
  log(`— Fase de Batalla —`);
  const vivos = [...state.jugador.campo, ...state.rival.campo].filter(Boolean);
  state.ordenDeTurno = vivos.sort((a, b) => b.stats.velocidad - a.stats.velocidad);
  state.turnoIndex = 0;
  document.getElementById('controls').innerHTML = `<button class="btn" onclick="playAutoBattle()">Simular Batalla</button>`;
  renderAll();
}

function livingEnemies(personaje) {
  const enemigoLado = personaje.lado === 'jugador' ? 'rival' : 'jugador';
  return state[enemigoLado].campo.filter(c => c && c.vivo);
}

function checkEffectsList(lista, personaje, gatilloId, contexto) {
  for (const item of lista || []) {
    if (item.modo !== 'tce' || item.gatillo !== gatilloId) continue;
    if (!evaluarCondicion(item.condicion, personaje, contexto)) continue;
    ejecutarAccion(item.accion, personaje, contexto, item.objetivo);
  }
}

function checkPassives(personaje, gatilloId, contexto) {
  checkEffectsList(personaje.pasivas, personaje, gatilloId, contexto);
}

function evaluarCondicion(condId, personaje, contexto) {
  if (!condId || condId === 'siempre') return true;
  if (condId === 'objetivo_menos_hp_que_ejecutor') return contexto.objetivo && contexto.objetivo.hpActual < personaje.hpActual;
  if (condId === 'objetivo_hp_mayor_a_ejecutor') return contexto.objetivo && contexto.objetivo.hpActual > personaje.hpActual;
  if (condId === 'ejecutor_hp_menor_a_pct') return personaje.hpActual / personaje.hpMaximo <= (contexto.pct || 50) / 100;
  return true;
}

function resolverObjetivos(objetivoTipo, personaje, contexto) {
  if (objetivoTipo === 'portador') return [personaje];
  if (objetivoTipo === 'objetivo') return contexto.objetivo ? [contexto.objetivo] : [];
  if (objetivoTipo === 'aliadoAleatorio') {
    const aliados = state[personaje.lado].campo.filter(c => c && c.vivo && c !== personaje);
    return aliados.length ? [aliados[Math.floor(Math.random() * aliados.length)]] : [];
  }
  if (objetivoTipo === 'todosAliados') return state[personaje.lado].campo.filter(c => c && c.vivo);
  if (objetivoTipo === 'todosEnemigos') return livingEnemies(personaje);
  return [];
}

function ejecutarAccion(accion, personaje, contexto, objetivoTipo) {
  const objetivos = resolverObjetivos(objetivoTipo, personaje, contexto);
  objetivos.forEach(obj => {
    if (accion.tipo === 'dano') {
      const extraMod = NexoEffects.modificadorDanoRecibidoPct(obj, accion.tipoDano, accion.subtipo);
      const cantidad = NexoDamage.calcularYAplicarDano(personaje, obj, accion.tipoDano, accion.pct, accion.subtipo, log, extraMod);
      log(`${personaje.nombre} inflige ${cantidad.toFixed(1)} de daño ${accion.tipoDano} a ${obj.nombre} (pasiva/efecto).`);
      checkMuerte(obj);
    } else if (accion.tipo === 'efectoEstado') {
      aplicarEfectoEstadoPorId(accion.id, obj, personaje, accion.pct);
      log(`${personaje.nombre} aplica ${accion.id} a ${obj.nombre}.`);
    } else if (accion.tipo === 'buff') {
      NexoEffects.aplicarBuffODebuff(obj, accion.id, accion.pct, 2);
      log(`${obj.nombre} recibe el buff ${accion.id}.`);
    } else if (accion.tipo === 'debuff') {
      NexoEffects.aplicarBuffODebuff(obj, accion.id, accion.pct, 2);
      log(`${obj.nombre} recibe el debuff ${accion.id}.`);
    } else if (accion.tipo === 'curar') {
      const cura = obj.hpMaximo * (accion.pct / 100);
      obj.hpActual = Math.min(obj.hpMaximo, obj.hpActual + cura);
      log(`${obj.nombre} se cura ${cura.toFixed(1)} HP.`);
    } else if (accion.tipo === 'cargas') {
      log(`${obj.nombre} genera ${accion.pct} Cargas.`);
    }
  });
}

function aplicarEfectoEstadoPorId(id, objetivo, aplicador, pct) {
  if (id === 'quemadura') NexoEffects.aplicarQuemadura(objetivo, aplicador.stats.danoElemental, pct, aplicador.instanceId);
  else if (id === 'veneno') NexoEffects.aplicarVeneno(objetivo, aplicador.stats.danoElemental, pct, aplicador.instanceId);
  else if (id === 'sangrado') NexoEffects.aplicarSangrado(objetivo, pct, aplicador.instanceId);
  else if (id === 'aturdimiento') NexoEffects.aplicarControlDeTurno(objetivo, 'aturdimiento', 1);
  else if (id === 'mega_aturdimiento') NexoEffects.aplicarControlDeTurno(objetivo, 'mega_aturdimiento', 2);
  else if (id === 'congelacion') NexoEffects.aplicarControlDeTurno(objetivo, 'congelacion', 1);
  else if (id === 'mega_congelacion') NexoEffects.aplicarControlDeTurno(objetivo, 'mega_congelacion', 1);
  else if (id === 'miedo') NexoEffects.aplicarControlDeTurno(objetivo, 'miedo', 1);
  else if (id === 'posesion') NexoEffects.aplicarControlDeTurno(objetivo, 'posesion', 1);
  else if (id === 'mega_posesion') NexoEffects.aplicarControlDeTurno(objetivo, 'mega_posesion', 2);
  else if (id === 'confusion') NexoEffects.aplicarControlDeTurno(objetivo, 'confusion', 1);
  else if (id === 'ceguera') NexoEffects.aplicarCeguera(objetivo, 1);
  else if (id === 'debilidad') NexoEffects.aplicarDebilidad(objetivo, pct, 3);
}

function checkMuerte(personaje) {
  if (personaje.hpActual <= 0 && personaje.vivo) {
    personaje.vivo = false;
    log(`${personaje.nombre} ha caído.`);
    const p = state[personaje.lado];
    const idx = p.campo.indexOf(personaje);
    if (idx >= 0) p.campo[idx] = null;
    p.cementerio.push(personaje);
  }
}

function turnoDe(personaje) {
  if (!personaje.vivo) return;
  const { pierdeTurno, redireccionAliado, autoGolpe } = NexoEffects.procesarInicioDeTurno(personaje, log);
  checkPassives(personaje, 'al_inicio_de_turno', {});

  if (autoGolpe) {
    const cantidad = personaje.stats[autoGolpe.stat] * (autoGolpe.pct / 100);
    NexoDamage.aplicarDano(personaje, cantidad, log);
    log(`${personaje.nombre} se inflige ${cantidad.toFixed(1)} de daño por Confusión.`);
    checkMuerte(personaje);
    return;
  }
  if (pierdeTurno) return;

  let objetivo;
  if (redireccionAliado) {
    const aliados = state[personaje.lado].campo.filter(c => c && c.vivo && c !== personaje);
    if (aliados.length === 0) return;
    objetivo = aliados[Math.floor(Math.random() * aliados.length)];
    const cantidad = personaje.stats.danoFisico * (redireccionAliado.pct / 100);
    NexoDamage.aplicarDano(objetivo, cantidad, log);
    log(`${personaje.nombre} (Poseído) ataca a su aliado ${objetivo.nombre} por ${cantidad.toFixed(1)}.`);
    checkMuerte(objetivo);
    return;
  }

  const enemigos = livingEnemies(personaje);
  if (enemigos.length === 0) return;
  objetivo = enemigos[Math.floor(Math.random() * enemigos.length)];

  if (NexoEffects.tieneEfecto(personaje, 'ceguera') && Math.random() < 0.5) {
    log(`${personaje.nombre} falla su ataque (Ceguera).`);
    NexoEffects.limpiarEfecto(personaje, 'ceguera');
    return;
  }

  const ab = personaje.movimientos[0] || { tipoDano: 'fisico', porcentaje: 100 };
  const extraMod = NexoEffects.modificadorDanoRecibidoPct(objetivo, ab.tipoDano, null);
  const cantidad = NexoDamage.calcularYAplicarDano(personaje, objetivo, ab.tipoDano, ab.porcentaje, null, log, extraMod);
  log(`${personaje.nombre} usa ${ab.nombre || 'Ataque Básico'} sobre ${objetivo.nombre} por ${cantidad.toFixed(1)} de daño ${ab.tipoDano}.`);
  checkPassives(personaje, 'al_golpear', { objetivo });
  checkEffectsList(ab.efectos, personaje, 'al_golpear', { objetivo });
  checkPassives(objetivo, 'al_recibir_dano', { objetivo: personaje });
  checkMuerte(objetivo);
}

function sideHasNoCharacters(lado) {
  return state[lado].campo.every(s => s === null);
}

async function playAutoBattle() {
  document.getElementById('controls').innerHTML = '';
  for (const personaje of state.ordenDeTurno) {
    if (sideHasNoCharacters('jugador') || sideHasNoCharacters('rival')) break;
    turnoDe(personaje);
    renderAll();
    await new Promise(r => setTimeout(r, 550));
  }

  if (sideHasNoCharacters('jugador') || sideHasNoCharacters('rival')) {
    const ganador = sideHasNoCharacters('jugador') ? 'Rival' : 'Jugador';
    log(`*** ${ganador} gana la partida. ***`);
    document.getElementById('turnIndicator').textContent = `¡${ganador} gana la partida!`;
    document.getElementById('controls').innerHTML = `<button class="btn" onclick="location.reload()">Nueva Partida</button>`;
    return;
  }

  log(`— Fase Final de Ronda —`);
  [...state.jugador.campo, ...state.rival.campo].filter(Boolean).forEach(p => {
    NexoEffects.procesarFinalDeRonda(p, log);
    checkPassives(p, 'al_final_de_ronda', {});
    checkMuerte(p);
  });
  renderAll();

  if (sideHasNoCharacters('jugador') || sideHasNoCharacters('rival')) {
    const ganador = sideHasNoCharacters('jugador') ? 'Rival' : 'Jugador';
    log(`*** ${ganador} gana la partida. ***`);
    document.getElementById('turnIndicator').textContent = `¡${ganador} gana la partida!`;
    document.getElementById('controls').innerHTML = `<button class="btn" onclick="location.reload()">Nueva Partida</button>`;
    return;
  }

  state.ronda++;
  document.getElementById('controls').innerHTML = `<button class="btn" onclick="startRound()">Continuar a Ronda ${state.ronda}</button>`;
}

// --- Render ---
function renderAll() {
  document.getElementById('turnIndicator').textContent =
    state.fase === 'batalla' ? `Ronda ${state.ronda} — Fase de Batalla` :
    state.fase === 'invocacion' ? `Ronda ${state.ronda} — Fase de Invocación` :
    `Ronda ${state.ronda}`;

  document.getElementById('phaseBar').innerHTML = ['robo', 'invocacion', 'batalla', 'final_de_ronda']
    .map(f => `<span class="phase-pill ${state.fase === f ? 'active' : ''}">${f.replace(/_/g, ' ')}</span>`).join('');

  document.getElementById('rivalDeck').innerHTML = `Mazo Rival<br>${state.rival.mazo.length}`;
  document.getElementById('jugadorDeck').innerHTML = `Mazo<br>${state.jugador.mazo.length}`;

  renderHand('jugador');
  renderHand('rival', true);
  renderField('jugador');
  renderField('rival');
  renderLog();
}

function cardArt(c, size) {
  return c.imagenUrl
    ? `<img src="${c.imagenUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />`
    : `<span style="font-size:${size || 22}px;">🧙</span>`;
}

function renderHand(lado, oculto = false) {
  const el = document.getElementById(lado + 'Hand');
  el.innerHTML = state[lado].mano.map((c, idx) => `
    <div class="card ${c.rareza}" style="width:70px;cursor:pointer;" onclick="${lado === 'jugador' && state.fase === 'invocacion' ? `summon('jugador', ${idx})` : ''}">
      <div class="art" style="height:60px;font-size:22px;">${oculto ? '🎴' : cardArt(c)}</div>
      ${oculto ? '' : `<div class="info"><div class="name" style="font-size:10px;">${c.nombre}</div></div>`}
    </div>`).join('');
}

function renderField(lado) {
  const el = document.getElementById(lado + 'Field');
  el.innerHTML = state[lado].campo.map(c => {
    if (!c) return `<div class="field-slot">·</div>`;
    const pct = Math.max(0, c.hpActual / c.hpMaximo * 100);
    return `<div class="field-slot filled card ${c.rareza}" style="height:130px;flex-direction:column;font-size:11px;"
              onmouseenter="showSidePanel('${c.instanceId}')">
              <div style="width:36px;height:36px;overflow:hidden;border-radius:6px;">${cardArt(c, 26)}</div>
              <div>${c.nombre}</div>
              <div style="width:90%;height:6px;background:#333;border-radius:4px;overflow:hidden;margin-top:4px;">
                <div style="width:${pct}%;height:100%;background:${pct > 30 ? 'var(--ok)' : 'var(--danger)'};"></div>
              </div>
              <div>${Math.ceil(c.hpActual)}/${c.hpMaximo}</div>
            </div>`;
  }).join('');
}

function showSidePanel(instanceId) {
  const all = [...state.jugador.campo, ...state.rival.campo].filter(Boolean);
  const c = all.find(x => x.instanceId === instanceId);
  if (!c) return;
  const panel = document.getElementById('sidePanel');
  panel.innerHTML = `
    <div style="width:100%;height:140px;border-radius:8px;overflow:hidden;margin-bottom:10px;background:linear-gradient(160deg,#2a3260,#10142a);display:flex;align-items:center;justify-content:center;">${cardArt(c, 60)}</div>
    <h3>${c.nombre}</h3>
    <div class="notice">Rareza: ${c.rareza}</div>
    <table class="card-table">
      <tbody>
        <tr><td>HP</td><td>${Math.ceil(c.hpActual)} / ${c.hpMaximo}</td></tr>
        <tr><td>Daño Físico</td><td>${c.stats.danoFisico}</td></tr>
        <tr><td>Daño Elemental</td><td>${c.stats.danoElemental}</td></tr>
        <tr><td>Daño Especial</td><td>${c.stats.danoEspecial}</td></tr>
        <tr><td>Defensa</td><td>${c.stats.defensa}</td></tr>
        <tr><td>Velocidad</td><td>${c.stats.velocidad}</td></tr>
      </tbody>
    </table>
    <h4>Movimientos</h4>
    ${(c.movimientos || []).map(m => `<div class="notice"><strong>${m.nombre || '(sin nombre)'}</strong> — ${m.rol} — ${m.porcentaje}% Daño ${m.tipoDano} — Objetivo: ${m.objetivo} — Cargas: -${m.costoCargas} / +${m.cargasGeneradas}${(m.efectos && m.efectos.length) ? ` — ${m.efectos.length} efecto(s) adicional(es)` : ''}</div>`).join('') || '<div class="notice">Sin movimientos definidos</div>'}
    <h4>Pasivas activas (${c.pasivas.length})</h4>
    ${c.pasivas.map((p, i) => `<div class="notice">${i + 1}. ${p.modo === 'pasivo' ? `+${p.valor} ${p.stat}` : `${p.gatillo} → ${p.accion.tipo}`}</div>`).join('') || '<div class="notice">Ninguna</div>'}
    <h4>Efectos activos</h4>
    ${(c.efectos || []).map(e => `<div class="notice">${e.id}</div>`).join('') || '<div class="notice">Ninguno</div>'}
  `;
}

function renderLog() {
  document.getElementById('logBox').innerHTML = state.log.slice(0, 40).map(l => `<div>${l}</div>`).join('');
}

init();
