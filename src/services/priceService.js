import axios from 'axios';
import { logger } from '../utils/logger.js';

async function getBrlRate() {
  try {
    const res = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL');
    return parseFloat(res.data.USDBRL.ask);
  } catch (e) {
    return 5.40; 
  }
}

function calculateRealPrice(pureUsdPrice) {
  if (pureUsdPrice <= 0.50) return pureUsdPrice * 0.65;
  if (pureUsdPrice <= 3.00) return pureUsdPrice * 0.82;
  if (pureUsdPrice <= 15.00) return pureUsdPrice * 0.89;
  return pureUsdPrice * 0.95;
}

// 🔴 FUNÇÃO NOVA: Baixa o mercado inteiro de uma vez (Custo: 1 Token)
async function fetchEntireMarket(source, apiKey) {
  try {
    logger.info(`Baixando base completa do [${source}] via API v1...`);
    
    // Conforme sua documentação: /api/v1/prices
    const url = `https://csinventoryapi.com/api/v1/prices?api_key=${apiKey}&source=${source}&app_id=730`;
    
    const res = await axios.get(url, { timeout: 60000 }); // JSON grande, tempo de espera maior
    
    if (!res.data || typeof res.data !== 'object') {
        throw new Error("Resposta da API não é um objeto válido.");
    }

    logger.success(`[${source}] ${Object.keys(res.data).length} skins carregadas.`);
    return res.data;
  } catch (e) {
    logger.error(`Erro ao carregar mercado [${source}]: ${e.message}`);
    return {};
  }
}

export async function processPrices(inventory, apiKey) {
  logger.info("Iniciando motor de precificação em MASSA...");
  const brlRate = await getBrlRate();
  logger.info(`Dólar: R$ ${brlRate.toFixed(2)}`);

  // 1. Baixa os mercados (Buff e Youpin) para a memória
  const buffMarket = await fetchEntireMarket('buff163', apiKey);
  const youpinMarket = await fetchEntireMarket('youpin', apiKey);

  // 2. Agrupa o inventário
  const itemCounts = {};
  inventory.forEach(item => {
    const n = item.market_hash_name;
    if (n && !n.match(/^(AK-47|Glock-18|USP-S|AWP)$/)) { // Filtra armas base
        itemCounts[n] = (itemCounts[n] || 0) + 1;
    }
  });

  const finalReport = [];
  let totalBuff = 0;
  let totalYoupin = 0;

  // 3. Cruza os dados (Busca no JSON que baixamos)
  Object.entries(itemCounts).forEach(([name, qty]) => {
    const buffData = buffMarket[name];
    const youpinData = youpinMarket[name];

    // Mapeamento exato da documentação: .sell_price_cents.usd
    const pBuffUsd = (buffData?.sell_price_cents?.usd || 0) / 100;
    const pYoupinUsd = (youpinData?.sell_price_cents?.usd || 0) / 100;

    const adjBuff = calculateRealPrice(pBuffUsd);
    const adjYoupin = calculateRealPrice(pYoupinUsd);

    const itemTotalBuff = (adjBuff * brlRate) * qty;
    const itemTotalYoupin = (adjYoupin * brlRate) * qty;

    totalBuff += itemTotalBuff;
    totalYoupin += itemTotalYoupin;

    finalReport.push({
      name, qty, buffTotal: itemTotalBuff, youpinTotal: itemTotalYoupin
    });
  });

  finalReport.sort((a, b) => b.buffTotal - a.buffTotal);
  return { finalReport, totalBuff, totalYoupin };
}