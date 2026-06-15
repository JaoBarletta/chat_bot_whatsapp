'use strict';

class ApproximateTextService {
  static containsAnyWord(message, expectedWords) {
    const words = ApproximateTextService.tokenize(message);

    return expectedWords.some((expected) =>
      words.some((word) => ApproximateTextService.areSimilar(word, expected))
    );
  }

  static tokenize(message) {
    return ApproximateTextService.normalize(message)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  static areSimilar(word, expected) {
    const normalizedWord = ApproximateTextService.normalize(word);
    const normalizedExpected = ApproximateTextService.normalize(expected);

    if (normalizedWord === normalizedExpected) return true;
    if (normalizedWord.length < 5 || normalizedExpected.length < 5) {
      return false;
    }

    const maximumDistance = normalizedExpected.length >= 9 ? 2 : 1;
    if (
      Math.abs(normalizedWord.length - normalizedExpected.length) >
      maximumDistance
    ) {
      return false;
    }

    return (
      ApproximateTextService.levenshtein(
        normalizedWord,
        normalizedExpected
      ) <= maximumDistance
    );
  }

  static levenshtein(left, right) {
    const previous = Array.from(
      { length: right.length + 1 },
      (_, index) => index
    );

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];

      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const substitutionCost =
          left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] + substitutionCost
        );
      }

      previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
  }

  static normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}

module.exports = ApproximateTextService;
