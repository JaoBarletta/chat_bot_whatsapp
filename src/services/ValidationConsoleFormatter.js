'use strict';

const events = {
  'message.process': 'Mensagem processada',
  'message.buffer': 'Agrupamento de mensagens',
  'routing.decision': 'Identificacao da necessidade',
  'flow.started': 'Inicio do fluxo',
  'flow.transition': 'Etapa do atendimento',
  'flow.interrupted': 'Mudanca de fluxo',
  'flow.cancelled': 'Cancelamento do fluxo',
  'attendance.completed': 'Atendimento finalizado',
  'db.patient_lookup': 'Banco de dados - Busca do paciente',
  'db.patient_registration': 'Banco de dados - Cadastro do paciente',
  'db.appointment': 'Banco de dados - Agendamento',
  'db.anamnesis': 'Banco de dados - Anamnese',
  'db.history': 'Banco de dados - Historico',
  'whatsapp.reply': 'WhatsApp - Resposta ao paciente',
  'whatsapp.report': 'WhatsApp - Envio do relatorio',
  'whatsapp.photo': 'WhatsApp - Envio da foto',
  'report.callback': 'Encaminhamento do relatorio',
  'calendar.publish': 'Google Calendar - Publicacao',
  'calendar.result': 'Google Calendar - Resultado',
  'ai.request': 'OpenAI - Envio da solicitacao',
  'ai.response': 'OpenAI - Retorno da API',
  'ai.skipped': 'OpenAI - Chamada dispensada',
  'humanizer.decision': 'Validacao da resposta da IA',
  'test.suite': 'Suite de testes',
};
const statuses = {
  success: 'SUCESSO', error: 'ERRO', timeout: 'TEMPO ESGOTADO',
  created: 'EVENTO CRIADO', not_created: 'EVENTO NAO CRIADO',
  processed: 'PROCESSADO', completed: 'CONCLUIDO', started: 'INICIADO',
  skipped: 'NAO EXECUTADO', accepted: 'RESPOSTA APROVADA',
  fallback: 'RESPOSTA LOCAL', local_rules: 'REGRAS LOCAIS',
  cancelled: 'CANCELADO', interrupted: 'INTERROMPIDO', passed: 'APROVADO',
};
const values = {
  idle: 'Sem etapa ativa', waiting_confirmation: 'Aguardando confirmacao',
  waiting_date: 'Aguardando data', waiting_time: 'Aguardando horario',
  flow_policy: 'Etapa usa resposta local', service_result: 'Resultado da integracao',
  transaction_committed: 'Gravacao confirmada', api_unavailable: 'API indisponivel',
  cooldown: 'Pausa temporaria da API', missing_key: 'Chave da API ausente',
  disabled: 'Integracao desativada', already_exists: 'Evento ja existente',
  without_appointment_date: 'Sem data de agendamento',
  no_appointment_or_service: 'Sem agendamento ou integracao',
  GOOGLE_REAUTH_REQUIRED: 'Renove a autorizacao do Google Calendar',
  GOOGLE_OAUTH_ERROR: 'Falha na autenticacao do Google',
};
const labels = {
  intent: 'Fluxo', reason: 'Motivo', errorCode: 'Erro', model: 'Modelo', mode: 'Modo',
  httpStatus: 'HTTP', inputTokens: 'Tokens de entrada', outputTokens: 'Tokens de saida',
  totalTokens: 'Total de tokens', cachedTokens: 'Tokens em cache',
  inputChars: 'Caracteres recebidos', outputChars: 'Caracteres enviados',
  instructionChars: 'Caracteres das instrucoes', historyItems: 'Itens do historico',
  redacted: 'Dados filtrados', truncated: 'Texto limitado', hasImage: 'Imagem recebida',
  hasPhoto: 'Foto no relatorio', hasAppointment: 'Com agendamento',
  hasAnamnesis: 'Com anamnese', finished: 'Fluxo finalizado', reportable: 'Gerar relatorio',
  fragmentCount: 'Mensagens agrupadas', bufferMs: 'Espera de agrupamento (ms)',
  queueMs: 'Espera na fila (ms)', timeoutMs: 'Limite de espera (ms)',
  tests: 'Testes', passed: 'Aprovados', failed: 'Falhas', skipped: 'Ignorados',
  exitCode: 'Codigo de saida', promptVersion: 'Versao do prompt',
  maxOutputTokens: 'Limite de tokens de saida', dataPolicy: 'Politica de dados',
};

function safe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').slice(0, 160);
}

function display(value) {
  if (value === null) return 'Nao informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  return safe(values[value] || value);
}

class ValidationConsoleFormatter {
  static format(row) {
    const date = new Date(row.timestamp);
    const time = Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour12: false,
    });
    const duration = Number.isFinite(row.durationMs)
      ? ` | Tempo: ${row.durationMs < 1000 ? `${row.durationMs} ms` : `${(row.durationMs / 1000).toFixed(2).replace('.', ',')} s`}` : '';
    const lines = [
      `[${time}] [${statuses[row.status] || safe(row.status || 'INFO')}] ${events[row.event] || safe(row.event)}`,
      `  Mensagem: ${row.traceId ? safe(row.traceId).slice(0, 8) : '-'}${duration}`,
    ];
    if (row.stepBefore !== undefined || row.stepAfter !== undefined) {
      lines.push(`  Etapa anterior: ${display(row.stepBefore ?? null)}`);
      lines.push(`  Etapa atual: ${display(row.stepAfter ?? null)}`);
    }
    // Only approved metric fields reach the console, never patient payloads.
    for (const [key, label] of Object.entries(labels)) {
      if (row[key] !== undefined) lines.push(`  ${label}: ${display(row[key])}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

module.exports = ValidationConsoleFormatter;
