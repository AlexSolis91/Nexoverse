const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

function dataPath(file) {
  return path.join(DATA_DIR, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(dataPath(file), 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// --- Characters ---
app.post('/api/characters', (req, res) => {
  const characters = readJson('characters.json');
  const card = req.body;
  const idx = characters.findIndex(c => c.id === card.id);
  if (idx >= 0) characters[idx] = card; else characters.push(card);
  writeJson('characters.json', characters);
  res.json({ ok: true, card });
});

app.delete('/api/characters/:id', (req, res) => {
  let characters = readJson('characters.json');
  characters = characters.filter(c => c.id !== req.params.id);
  writeJson('characters.json', characters);
  res.json({ ok: true });
});

// --- Equipment ---
app.post('/api/equipment', (req, res) => {
  const equipment = readJson('equipment.json');
  const card = req.body;
  const idx = equipment.findIndex(e => e.id === card.id);
  if (idx >= 0) equipment[idx] = card; else equipment.push(card);
  writeJson('equipment.json', equipment);
  res.json({ ok: true, card });
});

app.delete('/api/equipment/:id', (req, res) => {
  let equipment = readJson('equipment.json');
  equipment = equipment.filter(e => e.id !== req.params.id);
  writeJson('equipment.json', equipment);
  res.json({ ok: true });
});

// --- Registry: triggers / conditions / equipment subtypes ---
app.post('/api/triggers', (req, res) => {
  const triggers = readJson('triggers.json');
  if (!triggers.find(t => t.id === req.body.id)) triggers.push(req.body);
  writeJson('triggers.json', triggers);
  res.json({ ok: true, triggers });
});

app.post('/api/conditions', (req, res) => {
  const conditions = readJson('conditions.json');
  if (!conditions.find(c => c.id === req.body.id)) conditions.push(req.body);
  writeJson('conditions.json', conditions);
  res.json({ ok: true, conditions });
});

app.post('/api/equipment-types', (req, res) => {
  const types = readJson('equipmentTypes.json');
  const { categoria, subtipo } = req.body;
  if (!types[categoria]) return res.status(400).json({ ok: false, error: 'categoria invalida' });
  if (!types[categoria].includes(subtipo)) types[categoria].push(subtipo);
  writeJson('equipmentTypes.json', types);
  res.json({ ok: true, types });
});

app.listen(PORT, () => {
  console.log(`Nexoverse admin server corriendo en http://localhost:${PORT}`);
});
