// Lectura de datos del juego. Funciona igual en local (server.js) y en GitHub Pages (estático).
const NexoData = (() => {
  const cache = {};

  const base = typeof NEXO_BASE !== 'undefined' ? NEXO_BASE : '';

  async function load(file) {
    if (cache[file]) return cache[file];
    const res = await fetch(`${base}data/${file}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`No se pudo cargar data/${file}`);
    const json = await res.json();
    cache[file] = json;
    return json;
  }

  function invalidate(file) {
    delete cache[file];
  }

  return {
    talents: () => load('talents.json'),
    effects: () => load('effects.json'),
    triggers: () => load('triggers.json'),
    conditions: () => load('conditions.json'),
    equipmentTypes: () => load('equipmentTypes.json'),
    characters: () => load('characters.json'),
    equipment: () => load('equipment.json'),
    rarities: () => load('rarities.json'),
    chests: () => load('chests.json'),
    invalidate,
  };
})();
