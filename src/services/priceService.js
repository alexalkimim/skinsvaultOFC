import axios from 'axios';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function getBrlRate() {
  try {
    const res = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL');
    return parseFloat(res.data.USDBRL.ask);
  } catch (e) {
    return 5.45; // Cotação de fallback
  }
}

// Sua fórmula de precificação (Ouro)
function calculateRealPrice(pureUsdPrice) {
  if (pureUsdPrice <= 0.50) return pureUsdPrice * 0.65;
  if (pureUsdPrice <= 3.00) return pureUsdPrice * 0.82;
  if (pureUsdPrice <= 15.00) return pureUsdPrice * 0.89;
  if (pureUsdPrice <= 100.00) return pureUsdPrice * 0.95;
  return pureUsdPrice * 1.00;
}

async function fetchLivePrice(name, source, apiKey) {
  const cacheKey = `${name}_${source}`;
  
  // 1. O Escudo: Se o preço estiver no database.json, ele retorna na hora (Custo: 0 tokens)
  if (cache.has(cacheKey)) {
    const cachedPrice = cache.get(cacheKey);
    if (cachedPrice > 0) {
      logger.hit(`Lido do banco local: [${source}] ${name}`);
      return cachedPrice;
    }
  }

  try {
    // 🔴 ROTA CORRIGIDA (Removemos o /v1/price e voltamos ao padrão correto)
    const encodedName = encodeURIComponent(name);
    const url = `https://csinventoryapi.com/api/market/price/${encodedName}?api_key=${apiKey}&source=${source}`;
    
    const res = await axios.get(url, { timeout: 5000 });
    const data = res.data;

    let rawPriceCents = 0;

    if (data.price && typeof data.price === 'object') {
        rawPriceCents = data.price.USD || 0;
    } else if (data.price) {
        rawPriceCents = data.price;
    }

    if (rawPriceCents > 0) {
        const usdValue = rawPriceCents / 100;
        const adjustedUsd = calculateRealPrice(usdValue);
        
        logger.success(`[${source}] ${name}: $${usdValue.toFixed(2)} (Ajustado: $${adjustedUsd.toFixed(2)})`);
        
        // 2. Salva no banco de dados local para nunca mais gastar token com essa skin
        cache.set(cacheKey, adjustedUsd);
        return adjustedUsd;
    }

    cache.set(cacheKey, 0);
    return 0;

  } catch (e) {
    const status = e.response?.status || "TIMEOUT";
    logger.error(`Falha na API (${status}) para item: ${name}`);
    // Se der erro 404 ou rate limit, não salvamos 0 no cache para ele tentar de novo depois
    return 0;
  }
}

export async function processPrices(inventory, apiKey) {
  logger.info("Iniciando motor de precificação PRO...");
  const brlRate = await getBrlRate();
  logger.info(`Dólar: R$ ${brlRate.toFixed(2)}`);

  // Filtra itens "default" (AK-47, Glock-18 padrão) que não têm preço de mercado
  const filteredInventory = inventory.filter(item => {
    const n = item.market_hash_name;
    return n !== "AK-47" && n !== "Glock-18" && n !== "USP-S" && n !== "AWP";
  });

  const itemCounts = {};
  filteredInventory.forEach(item => {
    const name = item.market_hash_name;
    itemCounts[name] = (itemCounts[name] || 0) + 1;
  });

  const uniqueNames = Object.keys(itemCounts);
  logger.info(`Precificando ${uniqueNames.length} itens únicos...`);

  const priceCatalog = {};
  const chunkSize = 15; // Velocidade Pro

  for (let i = 0; i < uniqueNames.length; i += chunkSize) {
    const chunk = uniqueNames.slice(i, i + chunkSize);
    
    await Promise.all(chunk.map(async (name) => {
      // Buscamos Buff e Youpin em paralelo
      const [pYoupin, pBuff] = await Promise.all([
        fetchLivePrice(name, 'youpin', apiKey),
        fetchLivePrice(name, 'buff163', apiKey)
      ]);
      
      priceCatalog[name] = {
        youpin: pYoupin * brlRate,
        buff: pBuff * brlRate
      };
    }));

    if (i + chunkSize < uniqueNames.length) await delay(200);
  }

  let totalBuff = 0;
  let totalYoupin = 0;
  const finalReport = [];

  Object.entries(itemCounts).forEach(([name, qty]) => {
    const prices = priceCatalog[name];
    const tBuff = prices.buff * qty;
    const tYoupin = prices.youpin * qty;

    totalBuff += tBuff;
    totalYoupin += tYoupin;

    finalReport.push({
      name, qty, buffTotal: tBuff, youpinTotal: tYoupin
    });
  });

  finalReport.sort((a, b) => b.buffTotal - a.buffTotal);
  return { finalReport, totalBuff, totalYoupin };
}