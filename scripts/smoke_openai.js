'use strict';

require('dotenv').config();
process.env.OPENAI_DEBUG = 'false';
const path = require('node:path');
// Keep synthetic validation separate from operational consumption.
process.env.OPENAI_USAGE_DIR = path.join(__dirname, '../logs/validation-ai');
process.env.VALIDATION_LOG_DIR = path.join(__dirname, '../logs/validation-smoke');
const OpenAIService = require('../src/services/OpenAIService');
const Humanizer = require('../src/services/ResponseHumanizerService');

async function main() {
  const baseReply = 'Qual atendimento voce procura?';
  const candidate = await OpenAIService.humanizeReply({
    baseReply, intent: 'OUTRO', patientMessage: 'Ola', recentHistory: [],
  });
  const accepted = new Humanizer().isValidCandidate({ baseReply, candidate });
  console.log(`OpenAI: comunicacao concluida. Resposta ${accepted ? 'aceita pelo guardrail' : 'rejeitada; atendimento usaria resposta local'}.`);
  console.log('Consumo desta validacao: logs/validation-ai. Nenhum dado de paciente foi enviado.');
  if (!accepted) process.exitCode = 1;
}

main().catch(() => { console.error('Validacao OpenAI falhou; confira configuracao, modelo, chave e saldo.'); process.exitCode = 1; });
