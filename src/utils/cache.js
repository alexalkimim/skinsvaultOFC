import fs from 'fs';
import path from 'path';

// Caminho do nosso banco de dados local
const DB_FILE = path.resolve('./database.json');

// Inicia a memória
let memoryCache = new Map();

// Quando o sistema liga, ele carrega o banco de dados salvo
if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    memoryCache = new Map(Object.entries(data));
  } catch (e) {
    console.error("Erro ao ler banco de dados local. Iniciando vazio.");
  }
}

export const cache = {
  get: (key) => memoryCache.get(key),
  has: (key) => memoryCache.has(key),
  set: (key, value) => {
    memoryCache.set(key, value);
    // Toda vez que aprende um preço novo, salva no disco (persistência real)
    fs.writeFileSync(DB_FILE, JSON.stringify(Object.fromEntries(memoryCache), null, 2));
  }
};