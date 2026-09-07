// Fórmulas de daño confirmadas por el diseño:
// daño_base = stat_de_dano_correspondiente * (%movimiento / 100)
// daño_final = daño_base * (1 - resistenciaCorrespondiente / 100)
// Defensa funciona como una resistencia, pero solo para Físico.
// Armadura no es %: es una barra que se agota antes de tocar el HP real.
// Crítico: probabilidad = stat Crítico del atacante (%), daño crítico = x2 fijo para todos.

const NexoDamage = (() => {
  function statDeDano(personaje, tipoDano) {
    if (tipoDano === 'fisico') return personaje.stats.danoFisico;
    if (tipoDano === 'elemental') return personaje.stats.danoElemental;
    if (tipoDano === 'especial') return personaje.stats.danoEspecial;
    return 0;
  }

  function resistenciaCorrespondiente(objetivo, tipoDano, subtipo) {
    if (tipoDano === 'fisico') return objetivo.stats.defensa || 0;
    if (tipoDano === 'especial') return objetivo.stats.resEspecial || 0;
    if (tipoDano === 'elemental') {
      if (subtipo === 'hielo') return objetivo.stats.resHielo || 0;
      if (subtipo === 'veneno') return objetivo.stats.resVeneno || 0;
      if (subtipo === 'fuego') return objetivo.stats.resFuego || 0;
      if (subtipo === 'rayo') return objetivo.stats.resRayo || 0;
      return 0;
    }
    return 0;
  }

  // aplica daño a un objetivo respetando la barra de Armadura antes que el HP
  function aplicarDano(objetivo, cantidad, log) {
    let restante = cantidad;
    if (objetivo.armaduraActual > 0) {
      const absorbido = Math.min(objetivo.armaduraActual, restante);
      objetivo.armaduraActual -= absorbido;
      restante -= absorbido;
      if (log) log(`${objetivo.nombre} absorbe ${absorbido.toFixed(1)} con su Armadura.`);
    }
    if (restante > 0) {
      objetivo.hpActual = Math.max(0, objetivo.hpActual - restante);
    }
    return cantidad;
  }

  const MULTIPLICADOR_CRITICO = 2;

  function calcularYAplicarDano(atacante, objetivo, tipoDano, pct, subtipo, log, extraModPct = 0) {
    const base = statDeDano(atacante, tipoDano) * (pct / 100);
    const resistencia = resistenciaCorrespondiente(objetivo, tipoDano, subtipo);
    let final = base * (1 - resistencia / 100);
    if (extraModPct) final = final * (1 + extraModPct / 100);

    const probCritico = (atacante.stats.critico || 0) / 100;
    const esCritico = Math.random() < probCritico;
    if (esCritico) final = final * MULTIPLICADOR_CRITICO;

    final = Math.max(0, final);
    aplicarDano(objetivo, final, log);
    return { cantidad: final, esCritico };
  }

  return { statDeDano, resistenciaCorrespondiente, aplicarDano, calcularYAplicarDano, MULTIPLICADOR_CRITICO };
})();
