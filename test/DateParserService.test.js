'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DateParserService = require('../src/services/DateParserService');

const TODAY = new Date(2026, 5, 15);
const OFFERED_DATES = [
  '16/06/2026',
  '17/06/2026',
  '18/06/2026',
  '19/06/2026',
];

function parse(message, offeredDates = OFFERED_DATES) {
  return DateParserService.parse(message, {
    today: TODAY,
    offeredDates,
  });
}

test('DateParserService usa o ano das datas oferecidas em uma data curta', () => {
  const result = parse('18/06');

  assert.equal(result.reason, null);
  assert.equal(DateParserService.format(result.date), '18/06/2026');
});

test('DateParserService entende dia isolado usando as opcoes apresentadas', () => {
  const result = parse('Pode ser dia 18');

  assert.equal(result.reason, null);
  assert.equal(DateParserService.format(result.date), '18/06/2026');
});

test('DateParserService entende mes por extenso e separadores alternativos', () => {
  const textual = parse('Quero no dia 18 de junho');
  const abbreviatedMonth = parse('18/jun');
  const numericText = parse('dia 18 do mes 06');
  const dots = parse('18.06');
  const hyphen = parse('18-06');

  assert.equal(DateParserService.format(textual.date), '18/06/2026');
  assert.equal(DateParserService.format(abbreviatedMonth.date), '18/06/2026');
  assert.equal(DateParserService.format(numericText.date), '18/06/2026');
  assert.equal(DateParserService.format(dots.date), '18/06/2026');
  assert.equal(DateParserService.format(hyphen.date), '18/06/2026');
});

test('DateParserService entende datas relativas e dias da semana', () => {
  const relative = parse('depois de amanha', []);
  const daysFromNow = parse('daqui a 3 dias', []);
  const weekday = parse('quinta-feira');

  assert.equal(DateParserService.format(relative.date), '17/06/2026');
  assert.equal(DateParserService.format(daysFromNow.date), '18/06/2026');
  assert.equal(DateParserService.format(weekday.date), '18/06/2026');
});

test('DateParserService leva data curta ja passada para o proximo ano', () => {
  const result = parse('10/06', []);

  assert.equal(result.reason, null);
  assert.equal(DateParserService.format(result.date), '10/06/2027');
});

test('DateParserService rejeita data inexistente e data completa passada', () => {
  const invalid = parse('31/02/2027', []);
  const past = parse('10/06/2025', []);

  assert.equal(invalid.date, null);
  assert.equal(invalid.reason, 'invalid');
  assert.equal(past.date, null);
  assert.equal(past.reason, 'past');
});
