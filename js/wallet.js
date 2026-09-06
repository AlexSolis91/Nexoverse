// Estado del jugador (oro, colección de cartas). Vive en localStorage: es progreso
// por-jugador, no contenido de diseño, así que no va en los JSON del repo.
const NexoPlayer = (() => {
  const KEY = 'nexoverse_player_v1';

  function defaultState() {
    return { oro: 5000, coleccion: [] }; // coleccion: [{cardId, tipo:'personaje'|'equipo', rareza}]
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return JSON.parse(raw);
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function getOro() {
    return load().oro;
  }

  function addOro(amount) {
    const s = load();
    s.oro += amount;
    save(s);
    return s.oro;
  }

  function spendOro(amount) {
    const s = load();
    if (s.oro < amount) return false;
    s.oro -= amount;
    save(s);
    return true;
  }

  function addCard(entry) {
    const s = load();
    s.coleccion.push(entry);
    save(s);
  }

  function getCollection() {
    return load().coleccion;
  }

  return { getOro, addOro, spendOro, addCard, getCollection };
})();
