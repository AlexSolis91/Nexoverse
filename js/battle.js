// Prototipo jugable del flujo de partida confirmado por el diseño:
// Ronda 1: Robo(5) -> Invocación(máx 3) -> Batalla -> Final de Ronda
// Ronda 2+: Robo(1) -> Invocación(máx 3, limitado por casillas libres, campo=5) -> Batalla -> Final de Ronda
// Condición de victoria: el primero en quedarse sin personajes en el campo pierde (se revisa
// solo al final de la Fase de Batalla).
//
// SIMPLIFICACIONES DE ESTA VERSIÓN (pendientes de que el diseño las defina):
// - No hay selección manual de movimiento ni de objetivo: cada personaje ejecuta su Movimiento 1
//   (Básico) sobre un enemigo vivo aleatorio. Los movimientos Especial/Ultimate (con costo de
//   Cargas) existen en los datos del personaje pero no son seleccionables todavía.
// - No hay equipo equipado (los slots de equipo no están conectados aún a esta batalla).
// - Cada personaje usa sus estadísticas base tal cual (nivel 1, 0 puntos de talento asignados,
//   confirmado por el usuario) — el sistema de subir de nivel/asignar talentos aún no tiene UI.
// - Cargas: se acumulan sin tope (todavía no se definió un máximo).

const FIELD_SIZE = 5;

let state = null;

function makeBattleCharacter(template, rareza, lado, unlockCounts) {
  const stats = { ...(template.estadisticasBase || {}) };
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
    cargasActuales: 0,
    // clon profundo de movimientos: cada personaje en batalla lleva su propia copia porque
    // movimientos como Chibaku Tensei acumulan un bono de daño persistente (bonoAcumulado)
    // propio de esa instancia, no del template compartido.
    movimientos: (template.movimientos || []).map(m => ({ ...m, bonoAcumulado: 0 })),
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
  const [characters, rarities] = await Promise.all([
    NexoData.characters(), NexoData.rarities()
  ]);

  const setupArea = document.getElementById('setupArea');
  if (characters.length === 0) {
    setupArea.innerHTML = `No hay personajes creados todavía en data/characters.json.`;
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
    rarities,
    log: [],
    jugador: {
      mazo: shuffle(jugadorTemplates.map(x => makeBattleCharacter(x.template, x.rareza, 'jugador', rarities.efectosDesbloqueados))),
      mano: [], campo: new Array(FIELD_SIZE).fill(null), cementerio: [],
    },
    rival: {
      mazo: shuffle(rivalTemplates.map(x => makeBattleCharacter(x.template, x.rareza, 'rival', rarities.efectosDesbloqueados))),
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
  checkPassives(card, 'al_ser_invocado', {});
  renderAll();
}

function goToBattlePhase() {
  state.jugador._invocadosEstaFase = 0;
  state.rival._invocadosEstaFase = 0;
  state.fase = 'batalla';
  log(`— Fase de Batalla —`);
  const vivos = [...state.jugador.campo, ...state.rival.campo].filter(Boolean);
  // cola MUTABLE (no un arreglo fijo): así "gana 1 turno adicional" puede insertar a alguien
  // justo después de la acción actual, sin recalcular todo el orden de la ronda.
  state.colaDeTurnos = vivos.sort((a, b) => b.stats.velocidad - a.stats.velocidad);
  document.getElementById('controls').innerHTML = `<button class="btn" onclick="playAutoBattle()">Simular Batalla</button>`;
  renderAll();
}

// Inserta a `personaje` para que actúe inmediatamente después del turno en curso — usado por
// la acción universal "turnoAdicional" (ver ejecutarAccion). Si ya está en la cola, no se
// duplica: simplemente se re-agenda al frente.
function otorgarTurnoAdicional(personaje) {
  if (!personaje || !personaje.vivo || !state.colaDeTurnos) return;
  state.colaDeTurnos = state.colaDeTurnos.filter(p => p !== personaje);
  state.colaDeTurnos.unshift(personaje);
  log(`${personaje.nombre} gana un turno adicional.`);
}

function livingEnemies(personaje) {
  const enemigoLado = personaje.lado === 'jugador' ? 'rival' : 'jugador';
  return state[enemigoLado].campo.filter(c => c && c.vivo);
}

function checkEffectsList(lista, personaje, gatilloId, contexto) {
  for (const item of lista || []) {
    if (item.modo !== 'tce' || item.gatillo !== gatilloId) continue;
    // probabilidad opcional (0-100): si no se especifica, siempre se evalúa (100%).
    if (item.probabilidad != null && Math.random() * 100 >= item.probabilidad) continue;
    if (!evaluarCondicion(item.condicion, personaje, contexto, item.condicionParam)) continue;
    ejecutarAccion(item.accion, personaje, contexto, item.objetivo);
  }
}

function checkPassives(personaje, gatilloId, contexto) {
  checkEffectsList(personaje.pasivas, personaje, gatilloId, contexto);
}

// `param` son los parámetros propios DE LA CONDICIÓN (ej. qué % o qué tipoDano espera),
// separados de `contexto` que trae los datos DEL EVENTO que disparó el gatillo.
function evaluarCondicion(condId, personaje, contexto, param) {
  if (!condId || condId === 'siempre') return true;
  if (condId === 'objetivo_menos_hp_que_ejecutor') return contexto.objetivo && contexto.objetivo.hpActual < personaje.hpActual;
  if (condId === 'objetivo_hp_mayor_a_ejecutor') return contexto.objetivo && contexto.objetivo.hpActual > personaje.hpActual;
  if (condId === 'ejecutor_hp_menor_a_pct') return personaje.hpActual / personaje.hpMaximo <= ((param && param.pct) || 50) / 100;
  if (condId === 'objetivo_tiene_efecto') return contexto.objetivo && param && NexoEffects.tieneEfecto(contexto.objetivo, param.efectoId);
  if (condId === 'ejecutor_tiene_efecto') return param && NexoEffects.tieneEfecto(personaje, param.efectoId);
  if (condId === 'objetivo_tiene_efecto_o_debuff') {
    return contexto.objetivo && (contexto.objetivo.efectos || []).some(e => categoriaDeEfecto(e.id) !== 'buffs');
  }
  if (condId === 'dano_recibido_es_tipo') return param && contexto.tipoDano === param.tipoDano;
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
  if (objetivoTipo === 'enemigoAleatorio') {
    const enemigos = livingEnemies(personaje);
    return enemigos.length ? [enemigos[Math.floor(Math.random() * enemigos.length)]] : [];
  }
  if (objetivoTipo === 'enemigoAleatorio2') {
    return shuffle(livingEnemies(personaje)).slice(0, 2);
  }
  return [];
}

// Las 10 acciones universales del motor. Cualquier pasiva/movimiento/equipo de CUALQUIER
// personaje se construye combinando estas — nunca se crea una acción exclusiva de un personaje.
function ejecutarAccion(accion, personaje, contexto, objetivoTipo) {
  const objetivos = resolverObjetivos(objetivoTipo, personaje, contexto);
  objetivos.forEach(obj => {
    if (accion.tipo === 'dano') {
      let cantidad;
      if (accion.baseDeCalculo === 'hpMaximoObjetivo') {
        // daño = % del HP MÁXIMO del objetivo, no del stat del atacante (ej. pasiva Legendaria de Superman)
        cantidad = obj.hpMaximo * (accion.pct / 100);
        NexoDamage.aplicarDano(obj, cantidad, log);
      } else {
        const extraMod = NexoEffects.modificadorDanoRecibidoPct(obj, accion.tipoDano, accion.subtipo);
        ({ cantidad } = NexoDamage.calcularYAplicarDano(personaje, obj, accion.tipoDano, accion.pct, accion.subtipo, log, extraMod));
      }
      log(`${personaje.nombre} inflige ${cantidad.toFixed(1)} de daño ${accion.tipoDano} a ${obj.nombre} (pasiva/efecto).`);
      const eliminado = checkMuerte(obj);
      if (eliminado && accion.siElimina) {
        accion.siElimina.forEach(sub => ejecutarAccion(sub, personaje, { objetivo: obj }, sub.objetivo));
      }
    } else if (accion.tipo === 'contraataque') {
      // "contraataca con su básico": ejecuta el MISMO movimiento básico que se usa en el turno
      // normal, reutilizando exactamente la misma función (nunca una copia del ataque).
      const profundidad = (contexto.profundidadContraataque || 0) + 1;
      if (profundidad > 1) return; // evita ping-pong infinito entre dos contraatacadores mutuos
      if (personaje.vivo && obj.vivo) ejecutarMovimientoBasico(personaje, obj, { profundidadContraataque: profundidad });
    } else if (accion.tipo === 'efectoEstado') {
      aplicarEfectoEstadoPorId(accion.id, obj, personaje, accion.pct, accion.duracion);
      log(`${personaje.nombre} aplica ${accion.id} a ${obj.nombre}.`);
    } else if (accion.tipo === 'buff') {
      NexoEffects.aplicarBuffODebuff(obj, accion.id, accion.pct, accion.duracion || 2);
      log(`${obj.nombre} recibe el buff ${accion.id}.`);
    } else if (accion.tipo === 'debuff') {
      NexoEffects.aplicarBuffODebuff(obj, accion.id, accion.pct, accion.duracion || 2);
      log(`${obj.nombre} recibe el debuff ${accion.id}.`);
    } else if (accion.tipo === 'curar') {
      const cura = obj.hpMaximo * (accion.pct / 100);
      if (NexoEffects.tieneEfecto(obj, 'quemadura_solar')) {
        // Quemadura Solar: la curación que recibiría se convierte en esa misma cantidad
        // de Daño Elemental de Fuego, en vez de curar.
        NexoDamage.aplicarDano(obj, cura, log);
        log(`${obj.nombre} tiene Quemadura Solar: la curación de ${cura.toFixed(1)} se convierte en daño de Fuego.`);
        checkMuerte(obj);
      } else {
        obj.hpActual = Math.min(obj.hpMaximo, obj.hpActual + cura);
        log(`${obj.nombre} se cura ${cura.toFixed(1)} HP.`);
      }
    } else if (accion.tipo === 'cargas') {
      obj.cargasActuales = (obj.cargasActuales || 0) + accion.pct;
      log(`${obj.nombre} genera ${accion.pct} Cargas (total: ${obj.cargasActuales}).`);
    } else if (accion.tipo === 'robarCargas') {
      const robadas = obj.cargasActuales || 0;
      obj.cargasActuales = 0;
      personaje.cargasActuales = (personaje.cargasActuales || 0) + robadas;
      log(`${personaje.nombre} roba ${robadas} Cargas de ${obj.nombre}.`);
    } else if (accion.tipo === 'disipar') {
      const categorias = disiparCategoriasA(accion.categoria);
      obj.efectos = (obj.efectos || []).filter(e => !categorias.includes(categoriaDeEfecto(e.id)));
      log(`${personaje.nombre} disipa (${accion.categoria || 'todos'}) de ${obj.nombre}.`);
    } else if (accion.tipo === 'escalarStat') {
      obj.stats[accion.stat] = (obj.stats[accion.stat] || 0) * (1 + accion.pct / 100);
      if (accion.stat === 'hp') obj.hpMaximo = obj.stats.hp; // el HP Máx real de combate sigue a stats.hp
      log(`${obj.nombre} incrementa ${accion.stat} en ${accion.pct}% (ahora ${obj.stats[accion.stat].toFixed(2)}).`);
    } else if (accion.tipo === 'turnoAdicional') {
      otorgarTurnoAdicional(obj);
    }
  });
}

// A qué categoría pertenece cada id de efecto/buff/debuff, para que "disipar" sepa qué barrer.
const BUFF_IDS = ['celeridad', 'frenesi', 'furia', 'piel_de_piedra', 'potenciacion', 'provocacion'];
const DEBUFF_IDS = ['fatiga', 'contencion', 'intimidacion', 'decrepitud', 'merma'];
function categoriaDeEfecto(id) {
  if (BUFF_IDS.includes(id)) return 'buffs';
  if (DEBUFF_IDS.includes(id)) return 'debuffs';
  return 'efectosDeEstado';
}
function disiparCategoriasA(categoria) {
  if (categoria === 'buffs') return ['buffs'];
  if (categoria === 'debuffs') return ['debuffs'];
  if (categoria === 'efectosDeEstado') return ['efectosDeEstado'];
  if (categoria === 'efectosYdebuffs') return ['efectosDeEstado', 'debuffs'];
  return ['buffs', 'debuffs', 'efectosDeEstado']; // "todos" o sin especificar
}

function aplicarEfectoEstadoPorId(id, objetivo, aplicador, pct, duracion) {
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
  else if (id === 'ceguera') NexoEffects.aplicarCeguera(objetivo, duracion || 1);
  else if (id === 'debilidad') NexoEffects.aplicarDebilidad(objetivo, pct, duracion || 3);
  else if (id === 'quemadura_solar') NexoEffects.aplicarQuemaduraSolar(objetivo);
}

function checkMuerte(personaje) {
  if (personaje.hpActual <= 0 && personaje.vivo) {
    personaje.vivo = false;
    log(`${personaje.nombre} ha caído.`);
    const p = state[personaje.lado];
    const idx = p.campo.indexOf(personaje);
    if (idx >= 0) p.campo[idx] = null;
    p.cementerio.push(personaje);
    if (state.colaDeTurnos) state.colaDeTurnos = state.colaDeTurnos.filter(x => x !== personaje);
    return true;
  }
  return false;
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

  objetivo = elegirObjetivoST(personaje);
  if (!objetivo) return;

  if (NexoEffects.tieneEfecto(personaje, 'ceguera') && Math.random() < 0.5) {
    log(`${personaje.nombre} falla su ataque (Ceguera).`);
    NexoEffects.limpiarEfecto(personaje, 'ceguera');
    return;
  }

  ejecutarMovimientoBasico(personaje, objetivo);
}

// Elige el objetivo para un ataque ST (objetivo único): si algún enemigo tiene el buff
// Provocación activo, SOLO puede elegirse entre esos (regla universal, no exclusiva de
// ningún personaje — cualquiera puede tener Provocación, por pasiva o por buff recibido).
function elegirObjetivoST(personaje) {
  const enemigos = livingEnemies(personaje);
  if (enemigos.length === 0) return null;
  const provocando = enemigos.filter(e => NexoEffects.tieneEfecto(e, 'provocacion'));
  const pool = provocando.length ? provocando : enemigos;
  return pool[Math.floor(Math.random() * pool.length)];
}

// El Movimiento 1 (Básico) de un personaje, en una única función reutilizable: la usa el
// turno normal Y cualquier "contraataque" (acción universal 'contraataque') — nunca hay
// una segunda copia de "cómo se ejecuta un básico".
function ejecutarMovimientoBasico(personaje, objetivo, contextoExtra) {
  const ab = personaje.movimientos[0] || { tipoDano: 'fisico', porcentaje: 100 };
  const extraMod = NexoEffects.modificadorDanoRecibidoPct(objetivo, ab.tipoDano, ab.subtipo);
  const { cantidad, esCritico } = NexoDamage.calcularYAplicarDano(personaje, objetivo, ab.tipoDano, ab.porcentaje, ab.subtipo, log, extraMod);
  log(`${personaje.nombre} usa ${ab.nombre || 'Ataque Básico'} sobre ${objetivo.nombre} por ${cantidad.toFixed(1)} de daño ${ab.tipoDano}${esCritico ? ' (¡CRÍTICO!)' : ''}.`);
  if (ab.cargasGeneradas) {
    personaje.cargasActuales = (personaje.cargasActuales || 0) + ab.cargasGeneradas;
  }
  checkPassives(personaje, 'al_golpear', { objetivo });
  checkEffectsList(ab.efectos, personaje, 'al_golpear', { objetivo });
  if (esCritico) {
    checkPassives(personaje, 'al_acertar_critico', { objetivo });
    checkEffectsList(ab.efectos, personaje, 'al_acertar_critico', { objetivo });
  }
  checkPassives(objetivo, 'al_recibir_dano', { objetivo: personaje, tipoDano: ab.tipoDano, ...contextoExtra });
  checkMuerte(objetivo);
}

function sideHasNoCharacters(lado) {
  return state[lado].campo.every(s => s === null);
}

async function playAutoBattle() {
  document.getElementById('controls').innerHTML = '';
  // cola dinámica: turnoDe/ejecutarAccion pueden insertar turnos extra al frente (ver
  // otorgarTurnoAdicional), por eso se consume con shift() en vez de iterar un arreglo fijo.
  while (state.colaDeTurnos.length > 0) {
    if (sideHasNoCharacters('jugador') || sideHasNoCharacters('rival')) break;
    const personaje = state.colaDeTurnos.shift();
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
        <tr><td>Crítico</td><td>${c.stats.critico}%</td></tr>
        <tr><td>Regeneración</td><td>${c.stats.regeneracion.toFixed ? c.stats.regeneracion.toFixed(2) : c.stats.regeneracion}</td></tr>
        <tr><td>Cargas</td><td>${c.cargasActuales || 0}</td></tr>
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
