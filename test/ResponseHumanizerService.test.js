'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ResponseHumanizerService = require('../src/services/ResponseHumanizerService');
const IntentTypes = require('../src/constants/IntentTypes');

test('humanizador aceita reformulacao segura', async () => {
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Certo! Qual periodo voce prefere: manha, tarde ou noite?';
      },
    },
  });

  const result = await service.humanize({
    baseReply: 'Qual periodo voce prefere: manha, tarde ou noite?',
    intent: IntentTypes.AGENDAMENTO,
  });

  assert.equal(
    result,
    'Certo! Qual periodo voce prefere: manha, tarde ou noite?'
  );
});

test('humanizador usa fallback quando a IA introduz procedimento', async () => {
  const baseReply = 'As informacoes serao avaliadas pelo dentista.';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'As informacoes serao avaliadas e provavelmente sera necessario canal.';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.SINTOMA,
    }),
    baseReply
  );
});

test('humanizador usa fallback quando a IA troca procedimento ou inventa numero', async () => {
  const baseReply = 'Vou registrar Limpeza em 20/06/2026. Confirma?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Vou registrar Clareamento em 21/06/2026. Confirma?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.AGENDAMENTO,
    }),
    baseReply
  );
});

test('humanizador usa fallback quando a IA falha', async () => {
  const baseReply = 'Vou encaminhar seu atendimento para a equipe.';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        throw new Error('Ollama indisponivel');
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.HUMANO,
    }),
    baseReply
  );
});

test('humanizador rejeita confirmacao de vaga que o fluxo nao aprovou', async () => {
  const baseReply = 'Só para confirmar sua solicitação para 18/06/2026 às 15:00. Está certo?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Você tem um agendamento marcado para 18/06/2026 às 15:00. Está certo?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.AGENDAMENTO,
    }),
    baseReply
  );
});

test('humanizador rejeita repeticao do nome que nao existe no texto aprovado', async () => {
  const baseReply = 'Há quanto tempo você está sentindo esse incômodo?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'João, há quanto tempo você está sentindo esse incômodo?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.SINTOMA,
      patientName: 'João Victor',
    }),
    baseReply
  );
});

test('humanizador rejeita nova saudacao e frase generica no meio da conversa', async () => {
  const baseReply = 'Você já sabe qual procedimento gostaria de agendar?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Oi! Estou aqui para ajudar. Qual procedimento você gostaria de agendar?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.AGENDAMENTO,
      recentHistory: [
        { role: 'patient', content: 'Olá' },
        { role: 'assistant', content: 'Oi! Tudo bem?' },
      ],
    }),
    baseReply
  );
});

test('humanizador rejeita troca da pergunta de procedimento por motivo', async () => {
  const baseReply = 'Você já sabe qual procedimento gostaria de agendar?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Qual é o motivo da sua visita à clínica odontológica?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.AGENDAMENTO,
      recentHistory: [{ role: 'patient', content: 'Quero agendar' }],
    }),
    baseReply
  );
});

test('humanizador rejeita pergunta que perde a data aprovada', async () => {
  const baseReply = 'Qual data você prefere para agendarmos Limpeza?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Você gostaria de fazer um agendamento por causa da limpeza?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.AGENDAMENTO,
      recentHistory: [{ role: 'patient', content: 'Quero uma limpeza' }],
    }),
    baseReply
  );
});

test('debug informa a mensagem final escolhida pelo humanizador', async () => {
  const originalDebug = process.env.OLLAMA_DEBUG;
  const originalLog = console.log;
  const logs = [];
  process.env.OLLAMA_DEBUG = 'true';
  console.log = (...args) => logs.push(args.join(' '));

  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Certo. Qual data você prefere?';
      },
    },
  });

  try {
    const reply = await service.humanize({
      baseReply: 'Qual data você prefere?',
      intent: IntentTypes.AGENDAMENTO,
    });
    const output = logs.join('\n');

    assert.equal(reply, 'Certo. Qual data você prefere?');
    assert.match(output, /VALIDACAO DO HUMANIZADOR/);
    assert.match(output, /Resultado: ACEITA/);
    assert.match(
      output,
      /Mensagem final enviada: Certo\. Qual data você prefere\?/
    );
  } finally {
    console.log = originalLog;
    if (originalDebug === undefined) {
      delete process.env.OLLAMA_DEBUG;
    } else {
      process.env.OLLAMA_DEBUG = originalDebug;
    }
  }
});

test('humanizador rejeita risada ou comentario jocoso sobre a dor', async () => {
  const baseReply =
    'Há quanto tempo você está sentindo essa dor ou incômodo?';
  const service = new ResponseHumanizerService({
    ollamaService: {
      async humanizeReply() {
        return 'Ahaha, dor no dente é um incômodo bem real! Pode me contar por quanto tempo você sente essa dor forte?';
      },
    },
  });

  assert.equal(
    await service.humanize({
      baseReply,
      intent: IntentTypes.SINTOMA,
      patientMessage: 'Estou sentindo uma dor no dente muito forte',
    }),
    baseReply
  );
});
