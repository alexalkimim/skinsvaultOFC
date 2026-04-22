import readline from 'readline';
import { logger } from './utils/logger.js';
import { fetchInventory } from './services/steamService.js';
import { processPrices } from './services/priceService.js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.CSINVENTORY_API_KEY;

if (!API_KEY) {
  logger.error("Faltando CSINVENTORY_API_KEY no arquivo .env");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function printReport(report, totalBuff, totalYoupin) {
  logger.divider();
  console.log(`\x1b[1m=== RESULTADO FINAL ===\x1b[0m\n`);
  
  console.log(`\x1b[32mTotal BUFF:   R$ ${totalBuff.toFixed(2)}\x1b[0m`);
  console.log(`\x1b[34mTotal YouPin: R$ ${totalYoupin.toFixed(2)}\x1b[0m\n`);
  console.log(`\x1b[1m=== ITENS DA CONTA ===\x1b[0m\n`);

  report.forEach(item => {
    const qtyStr = item.qty > 1 ? `(x${item.qty})` : `    `;
    console.log(`${qtyStr} ${item.name}`);
    console.log(`     ↳ BUFF: R$ ${item.buffTotal.toFixed(2)} | YouPin: R$ ${item.youpinTotal.toFixed(2)}\n`);
  });
  logger.divider();
}

async function main() {
  logger.divider();
  console.log("   🚀 SKIN VAULT CLI ENGINE   ");
  logger.divider();

  rl.question('Insira o Trade Link ou Link de Perfil Steam: ', async (link) => {
    if (!link) {
      logger.error("Link inválido.");
      rl.close();
      return;
    }

    try {
      const inventory = await fetchInventory(link, API_KEY);
      const { finalReport, totalBuff, totalYoupin } = await processPrices(inventory, API_KEY);
      
      printReport(finalReport, totalBuff, totalYoupin);
    } catch (e) {
      logger.error("Falha na execução: " + e.message);
    } finally {
      rl.close();
    }
  });
}

main();