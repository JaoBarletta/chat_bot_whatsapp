'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const FlowRouter = require('../src/services/FlowRouter');
const IntentTypes = require('../src/constants/IntentTypes');

test('FlowRouter classifica mensagens exclusivamente por regras locais', async () => {
  const router = new FlowRouter();

  assert.equal(
    await router.route('Quanto custa um implante?'),
    IntentTypes.FINANCEIRO
  );
  assert.equal(
    await router.route('Estou com dor e queria fazer canal'),
    IntentTypes.SINTOMA
  );
  assert.equal(
    await router.route('Quero fazer uma limpeza'),
    IntentTypes.AGENDAMENTO
  );
  assert.equal(
    await router.route('Gostaria de fazer um agendamento'),
    IntentTypes.AGENDAMENTO
  );
  assert.equal(await router.route('oi'), IntentTypes.OUTRO);
  assert.equal(await router.route('Olá!'), IntentTypes.OUTRO);
  assert.equal(await router.route('bom dia'), IntentTypes.OUTRO);
  assert.equal(await router.route('Oi, tudo bem?'), IntentTypes.OUTRO);
  assert.equal(await router.route('olá, boa tarde !'), IntentTypes.OUTRO);
  assert.equal(
    await router.route('Olá, boa tarde tudo bem?'),
    IntentTypes.OUTRO
  );
  assert.equal(
    await router.route('Olá, boa tarde. Quero agendar uma consulta'),
    IntentTypes.AGENDAMENTO
  );
  assert.equal(
    await router.route('Gostaria de ver para fazer um agendamenyo'),
    IntentTypes.AGENDAMENTO
  );
  assert.equal(
    await router.route('Gostaria de fazer um agendmento'),
    IntentTypes.AGENDAMENTO
  );
  assert.equal(
    await router.route('Quero fazer uma linpeza'),
    IntentTypes.AGENDAMENTO
  );
});

test('FlowRouter usa OUTRO como fallback deterministico', async () => {
  const router = new FlowRouter();

  assert.equal(await router.route('mensagem ambigua'), IntentTypes.OUTRO);
  assert.equal(await router.route('Gostaria de verificar isso'), IntentTypes.OUTRO);
});
