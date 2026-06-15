'use strict';

const ProcedureCatalog = require('./ProcedureCatalog');

const MONTHS = Object.freeze({
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
});

const WEEKDAYS = Object.freeze({
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
});

class DateParserService {
  static parse(value, { today = new Date(), offeredDates = [] } = {}) {
    const referenceDate = DateParserService.startOfDay(today);
    const options = DateParserService.normalizeOfferedDates(offeredDates)
      .filter((date) => date >= referenceDate)
      .sort((left, right) => left - right);
    const text = ProcedureCatalog.normalize(value).replace(/\s+/g, ' ').trim();

    if (!text) {
      return { date: null, reason: 'not_found' };
    }

    if (/\bdepois de amanha\b/.test(text)) {
      return {
        date: DateParserService.addDays(referenceDate, 2),
        reason: null,
      };
    }

    if (/\bamanha\b/.test(text)) {
      return {
        date: DateParserService.addDays(referenceDate, 1),
        reason: null,
      };
    }

    if (/\bhoje\b/.test(text)) {
      return { date: referenceDate, reason: null };
    }

    const daysFromNowMatch = text.match(
      /\b(?:daqui\s+a|em)\s+(\d{1,2})\s+dias?\b/
    );
    if (daysFromNowMatch) {
      return {
        date: DateParserService.addDays(
          referenceDate,
          Number(daysFromNowMatch[1])
        ),
        reason: null,
      };
    }

    const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      return DateParserService.buildExplicitDate({
        day: Number(isoMatch[3]),
        month: Number(isoMatch[2]),
        year: Number(isoMatch[1]),
        referenceDate,
      });
    }

    const fullDateMatch = text.match(
      /\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2}|\d{4})\b/
    );
    if (fullDateMatch) {
      return DateParserService.buildExplicitDate({
        day: Number(fullDateMatch[1]),
        month: Number(fullDateMatch[2]),
        year: DateParserService.normalizeYear(fullDateMatch[3]),
        referenceDate,
      });
    }

    const monthNames = Object.keys(MONTHS).join('|');
    const textualDateMatch = text.match(
      new RegExp(
        `\\b(?:dia\\s+)?(\\d{1,2})(?:\\s*(?:de|do)\\s+|\\s*[\\/.-]\\s*|\\s+)(${monthNames})(?:\\s*(?:de\\s+)?(\\d{2}|\\d{4}))?\\b`
      )
    );
    if (textualDateMatch) {
      return DateParserService.resolvePartialDate({
        day: Number(textualDateMatch[1]),
        month: MONTHS[textualDateMatch[2]],
        year: textualDateMatch[3]
          ? DateParserService.normalizeYear(textualDateMatch[3])
          : null,
        referenceDate,
        offeredDates: options,
      });
    }

    const numericTextDateMatch = text.match(
      /\b(?:dia\s+)?(\d{1,2})\s+(?:de|do)\s+(?:mes\s+)?(\d{1,2})\b/
    );
    if (numericTextDateMatch) {
      return DateParserService.resolvePartialDate({
        day: Number(numericTextDateMatch[1]),
        month: Number(numericTextDateMatch[2]),
        year: null,
        referenceDate,
        offeredDates: options,
      });
    }

    const shortDateMatch = text.match(
      /\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\s*[\/.-]\s*\d)\b/
    );
    if (shortDateMatch) {
      return DateParserService.resolvePartialDate({
        day: Number(shortDateMatch[1]),
        month: Number(shortDateMatch[2]),
        year: null,
        referenceDate,
        offeredDates: options,
      });
    }

    const weekday = DateParserService.extractWeekday(text);
    if (weekday !== null) {
      const offeredMatch = options.find(
        (date) => date.getDay() === weekday
      );
      if (offeredMatch) {
        return { date: new Date(offeredMatch), reason: null };
      }

      let daysAhead = (weekday - referenceDate.getDay() + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;
      return {
        date: DateParserService.addDays(referenceDate, daysAhead),
        reason: null,
      };
    }

    const dayOnlyMatch =
      text.match(/\bdia\s+(\d{1,2})\b/) || text.match(/^(\d{1,2})$/);
    if (dayOnlyMatch) {
      const day = Number(dayOnlyMatch[1]);
      const offeredMatch = options.find((date) => date.getDate() === day);

      if (offeredMatch) {
        return { date: new Date(offeredMatch), reason: null };
      }

      const inferredDate = DateParserService.inferDayOnlyDate(
        day,
        referenceDate
      );
      return inferredDate
        ? { date: inferredDate, reason: null }
        : { date: null, reason: 'invalid' };
    }

    return { date: null, reason: 'not_found' };
  }

  static resolvePartialDate({
    day,
    month,
    year,
    referenceDate,
    offeredDates,
  }) {
    if (year) {
      return DateParserService.buildExplicitDate({
        day,
        month,
        year,
        referenceDate,
      });
    }

    const offeredMatch = offeredDates.find(
      (date) => date.getDate() === day && date.getMonth() + 1 === month
    );
    if (offeredMatch) {
      return { date: new Date(offeredMatch), reason: null };
    }

    let inferredYear = referenceDate.getFullYear();
    let date = DateParserService.createValidDate(day, month, inferredYear);

    if (!date) {
      return { date: null, reason: 'invalid' };
    }

    if (date < referenceDate) {
      inferredYear += 1;
      date = DateParserService.createValidDate(day, month, inferredYear);
    }

    return date
      ? { date, reason: null }
      : { date: null, reason: 'invalid' };
  }

  static buildExplicitDate({ day, month, year, referenceDate }) {
    const date = DateParserService.createValidDate(day, month, year);

    if (!date) {
      return { date: null, reason: 'invalid' };
    }

    if (date < referenceDate) {
      return { date: null, reason: 'past' };
    }

    return { date, reason: null };
  }

  static inferDayOnlyDate(day, referenceDate) {
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;

    for (let monthsAhead = 0; monthsAhead <= 12; monthsAhead += 1) {
      const monthReference = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() + monthsAhead,
        1
      );
      const candidate = DateParserService.createValidDate(
        day,
        monthReference.getMonth() + 1,
        monthReference.getFullYear()
      );

      if (candidate && candidate >= referenceDate) {
        return candidate;
      }
    }

    return null;
  }

  static extractWeekday(text) {
    for (const [name, weekday] of Object.entries(WEEKDAYS)) {
      const pattern = new RegExp(`\\b${name}\\b`);
      if (pattern.test(text)) return weekday;
    }

    return null;
  }

  static normalizeOfferedDates(offeredDates) {
    if (!Array.isArray(offeredDates)) return [];

    return offeredDates
      .map((item) => DateParserService.parseStoredDate(item?.date || item))
      .filter(Boolean);
  }

  static parseStoredDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return DateParserService.startOfDay(value);
    }

    const text = String(value || '').trim();
    const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      return DateParserService.createValidDate(
        Number(brMatch[1]),
        Number(brMatch[2]),
        Number(brMatch[3])
      );
    }

    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return DateParserService.createValidDate(
        Number(isoMatch[3]),
        Number(isoMatch[2]),
        Number(isoMatch[1])
      );
    }

    return null;
  }

  static createValidDate(day, month, year) {
    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  static normalizeYear(value) {
    const year = Number(value);
    return year < 100 ? 2000 + year : year;
  }

  static startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  static addDays(value, days) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  static format(date) {
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('/');
  }
}

module.exports = DateParserService;
