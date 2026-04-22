import axios from 'axios';
import { logger } from '../utils/logger.js';

function extractSteamId(input) {
  let steamId = input.trim();
  if (steamId.includes("partner=")) {
    const partner = steamId.split("partner=")[1]?.split("&")[0];
    if (partner) steamId = (BigInt(partner) + BigInt("76561197960265728")).toString();
  } else if (steamId.includes("profiles/")) {
    steamId = steamId.split("profiles/")[1].split("/")[0];
  } else if (steamId.includes("id/")) {
    throw new Error("Links customizados (/id/) precisam ser convertidos para SteamID numérico primeiro.");
  }
  return steamId;
}

export async function fetchInventory(tradeLink, apiKey) {
  try {
    const steamid64 = extractSteamId(tradeLink);
    logger.info(`ID Extraído: ${steamid64}`);
    logger.req(`Buscando inventário na CSInventoryAPI (Padrão Oficial)...`);

    // 🔴 CORREÇÃO 1: O parâmetro exigido é steamid64
    const url = `https://csinventoryapi.com/api/v1/inventory?api_key=${apiKey}&steamid64=${steamid64}`;
    const response = await axios.get(url);
    const data = response.data;
    
    // 🔴 CORREÇÃO 2: Validação da estrutura oficial da Steam
    if (!data || data.success !== 1 || !data.assets || !data.descriptions) {
      throw new Error("Inventário vazio, privado ou formato inesperado.");
    }

    // Criamos um mapa rápido para as descrições (onde ficam os nomes e as fotos)
    const descMap = new Map();
    data.descriptions.forEach(desc => {
      descMap.set(`${desc.classid}_${desc.instanceid}`, desc);
    });

    const validItems = [];
    
    // Cruzamos os "ativos físicos" do inventário com o "dicionário" de nomes
    data.assets.forEach(asset => {
      const desc = descMap.get(`${asset.classid}_${asset.instanceid}`);
      
      // Filtramos apenas itens que têm nome (ignorando medalhas e troféus inúteis se necessário)
      if (desc && desc.market_hash_name) {
         validItems.push({
            assetid: asset.assetid,
            market_hash_name: desc.market_hash_name,
            icon_url: desc.icon_url
         });
      }
    });

    logger.success(`${validItems.length} skins reais extraídas do inventário.`);
    
    return validItems;
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}