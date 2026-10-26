'use strict';

const ConversationTextService = require('./ConversationTextService');

const HOUR_WORDS = Object.freeze({
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
});

class TimeParserService {
  static parse(value, { availableSlots = [] } = {}) {
    const text = ConversationTextService.normalize(value);
    if (!text) return null;

    const candidates = TimeParserService.extractCandidates(text);
    return TimeParserService.selectBestCandidate(candidates, {
      text,
      availableSlots,
    });
  }

  static extractCandidates(text) {
    const candidates = [];
    const numericPattern =
      /\b(?:as|a|às|para|pelas)?\s*([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h|hs|hrs|horas?)?\b/g;

    let match;
    while ((match = numericPattern.exec(text)) !== null) {
      candidates.push({
        hour: Number(match[1]),
        minute: Number(match[2] || 0),
      });
    }

    if (/\bmeio dia\b/.test(text)) {
      candidates.push({ hour: 12, minute: 0 });
    }

    if (/\bmeia noite\b/.test(text)) {
      candidates.push({ hour: 0, minute: 0 });
    }

    const wordPattern = new RegExp(
      `\\b(?:as|a|às|para|pelas)?\\s*(${Object.keys(HOUR_WORDS).join('|')})\\b`,
      'g'
    );

    while ((match = wordPattern.exec(text)) !== null) {
      candidates.push({
        hour: HOUR_WORDS[match[1]],
        minute: 0,
      });
    }

    return candidates;
  }

  static selectBestCandidate(candidates, { text, availableSlots = [] }) {
    const available = new Set(availableSlots.map(TimeParserService.normalizeSlot));
    const expanded = candidates.flatMap((candidate) =>
      TimeParserService.expandCandidate(candidate, text)
    );
    const uniqueCandidates = [...new Set(expanded)].filter(Boolean);

    if (available.size > 0) {
      const availableCandidate = uniqueCandidates.find((slot) =>
        available.has(slot)
      );

      if (availableCandidate) return availableCandidate;
    }

    return uniqueCandidates[0] || null;
  }

  static expandCandidate({ hour, minute }, text) {
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return [];
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return [];

    const explicitAfternoon = /\b(tarde|noite)\b/.test(text);
    const explicitMorning = /\b(manha|cedo)\b/.test(text);
    const candidates = [];

    if (explicitAfternoon && hour >= 1 && hour <= 11) {
      candidates.push(TimeParserService.format(hour + 12, minute));
    }

    candidates.push(TimeParserService.format(hour, minute));

    if (!explicitMorning && hour >= 1 && hour <= 7) {
      candidates.push(TimeParserService.format(hour + 12, minute));
    }

    return candidates;
  }

  static normalizeSlot(slot) {
    const match = String(slot || '').match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) return String(slot || '').trim();
    return TimeParserService.format(Number(match[1]), Number(match[2]));
  }

  static format(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
}

module.exports = TimeParserService;
