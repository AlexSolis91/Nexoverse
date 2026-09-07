// Funciones UNIVERSALES de efectos de estado / buffs / debuffs.
// Todo personaje o equipo que "aplique Veneno" pasa por esta única función — nunca
// una copia propia. Ver memoria del proyecto: es una regla de arquitectura explícita.

const NexoEffects = (() => {
  function ensureBucket(personaje) {
    if (!personaje.efectos) personaje.efectos = [];
  }

  // --- Efectos de estado (DoT) ---
  function aplicarQuemadura(objetivo, danoElementalDeQuienAplica, pct, aplicadorId) {
    ensureBucket(objetivo);
    objetivo.efectos.push({
      id: 'quemadura', aplicadorId, pct, danoBase: danoElementalDeQuienAplica,
      ticksRestantes: 1,
    });
  }

  function aplicarVeneno(objetivo, danoElementalDeQuienAplica, pctInicial, aplicadorId) {
    ensureBucket(objetivo);
    // instancia independiente por aplicador; no se sobreescribe ni se acumula con otras
    objetivo.efectos.push({
      id: 'veneno', aplicadorId, pct: pctInicial, danoBase: danoElementalDeQuienAplica,
      indefinido: true,
    });
  }

  function aplicarSangrado(objetivo, pctDeHpMaximo, aplicadorId) {
    ensureBucket(objetivo);
    objetivo.efectos.push({ id: 'sangrado', aplicadorId, pct: pctDeHpMaximo, ticksRestantes: 1 });
  }

  function aplicarControlDeTurno(objetivo, id, turnos) {
    ensureBucket(objetivo);
    objetivo.efectos.push({ id, turnosRestantes: turnos });
  }

  function aplicarDebilidad(objetivo, pct, duracionTurnos) {
    ensureBucket(objetivo);
    // acumulable: cada instancia se guarda por separado y se suman los pct
    objetivo.efectos.push({ id: 'debilidad', pct, turnosRestantes: duracionTurnos || 1 });
  }

  function aplicarCeguera(objetivo, duracionTurnos) {
    ensureBucket(objetivo);
    objetivo.efectos.push({ id: 'ceguera', turnosRestantes: duracionTurnos || 1 });
  }

  // No expira por turnos (indefinido_hasta_limpieza) — se retira solo con disipar/limpiar.
  function aplicarQuemaduraSolar(objetivo) {
    ensureBucket(objetivo);
    if (objetivo.efectos.some(e => e.id === 'quemadura_solar')) return; // no acumulable
    objetivo.efectos.push({ id: 'quemadura_solar' });
  }

  function aplicarBuffODebuff(objetivo, id, pct, duracionTurnos) {
    ensureBucket(objetivo);
    objetivo.efectos.push({ id, pct, turnosRestantes: duracionTurnos || 1 });
  }

  // Se llama al inicio del turno del personaje. Devuelve info de control (si pierde el turno, etc).
  function procesarInicioDeTurno(personaje, log) {
    ensureBucket(personaje);
    let pierdeTurno = false;
    let redireccionAliado = null;
    let autoGolpe = null;

    for (const ef of personaje.efectos) {
      if (ef.id === 'aturdimiento' || ef.id === 'mega_aturdimiento') {
        pierdeTurno = true;
        log(`${personaje.nombre} está ${ef.id === 'mega_aturdimiento' ? 'Mega Aturdido' : 'Aturdido'} y pierde su turno.`);
      }
      if (ef.id === 'congelacion' && Math.random() < 0.5) {
        pierdeTurno = true;
        log(`${personaje.nombre} está Congelado y pierde su turno (50%).`);
      }
      if (ef.id === 'mega_congelacion') {
        pierdeTurno = true;
        log(`${personaje.nombre} está Mega Congelado y pierde su turno.`);
      }
      if (ef.id === 'miedo' && Math.random() < 0.25) {
        pierdeTurno = true;
        log(`${personaje.nombre} siente Miedo y pierde su turno (25%).`);
      }
      if ((ef.id === 'posesion' || ef.id === 'mega_posesion')) {
        redireccionAliado = { pct: 20, stat: 'danoFisico' };
        log(`${personaje.nombre} está Poseído y atacará a un aliado.`);
      }
      if (ef.id === 'confusion' && Math.random() < 0.5) {
        autoGolpe = { pct: 15, stat: 'danoEspecial' };
        pierdeTurno = true;
        log(`${personaje.nombre} está Confundido y se golpea a sí mismo.`);
      }
    }
    return { pierdeTurno, redireccionAliado, autoGolpe };
  }

  // Ticks de DoT + reducción de duraciones. Se llama en Fase Final de Ronda.
  function procesarFinalDeRonda(personaje, log) {
    ensureBucket(personaje);
    const restantes = [];
    for (const ef of personaje.efectos) {
      if (ef.id === 'quemadura') {
        const dano = ef.danoBase * (ef.pct / 100);
        NexoDamage.aplicarDano(personaje, dano, log);
        log(`${personaje.nombre} sufre ${dano.toFixed(1)} de Quemadura.`);
        continue; // expira tras 1 tick, no se conserva
      }
      if (ef.id === 'veneno') {
        const dano = ef.danoBase * (ef.pct / 100);
        NexoDamage.aplicarDano(personaje, dano, log);
        log(`${personaje.nombre} sufre ${dano.toFixed(1)} de Veneno (${ef.pct}%).`);
        ef.pct += 2; // el % sube 2 puntos cada tick, nunca expira solo
        restantes.push(ef);
        continue;
      }
      if (ef.id === 'sangrado') {
        const dano = personaje.hpMaximo * (ef.pct / 100);
        NexoDamage.aplicarDano(personaje, dano, log);
        log(`${personaje.nombre} sufre ${dano.toFixed(1)} de Sangrado.`);
        continue; // expira tras 1 tick
      }
      if (ef.turnosRestantes != null) {
        ef.turnosRestantes -= 1;
        if (ef.turnosRestantes > 0) restantes.push(ef);
        continue;
      }
      restantes.push(ef); // efectos sin duración explícita (ceguera de duración variable, etc.) se conservan
    }
    personaje.efectos = restantes;
  }

  function modificadorDanoRecibidoPct(personaje, tipoDano, subtipo) {
    ensureBucket(personaje);
    let mod = 0;
    for (const ef of personaje.efectos) {
      if (ef.id === 'debilidad') mod += ef.pct;
      if ((ef.id === 'congelacion' || ef.id === 'mega_congelacion') && tipoDano === 'elemental' && subtipo === 'hielo') {
        mod += ef.id === 'mega_congelacion' ? 25 : 10;
      }
    }
    return mod;
  }

  function tieneEfecto(personaje, id) {
    return (personaje.efectos || []).some(e => e.id === id);
  }

  function limpiarEfecto(personaje, id) {
    personaje.efectos = (personaje.efectos || []).filter(e => e.id !== id);
  }

  function bloqueaGeneracionDeCargas(personaje) {
    return tieneEfecto(personaje, 'miedo');
  }

  return {
    aplicarQuemadura, aplicarVeneno, aplicarSangrado, aplicarControlDeTurno,
    aplicarDebilidad, aplicarCeguera, aplicarQuemaduraSolar, aplicarBuffODebuff,
    procesarInicioDeTurno, procesarFinalDeRonda, modificadorDanoRecibidoPct,
    tieneEfecto, limpiarEfecto, bloqueaGeneracionDeCargas,
  };
})();
