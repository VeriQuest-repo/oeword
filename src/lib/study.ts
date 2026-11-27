// 외우기(플래시카드, #7)에서 쓰는 순수 로직: 고른 Day 들로 카드 묶음 만들기, 섞기.
import { dayLabel } from "./books";
import { mergeSenses, type DayWords, type Sense, wordKey } from "./words";

export interface StudyCard {
  /** 같은 단어인지 가르는 열쇠 (wordKey) */
  key: string;
  text: string;
  senses: Sense[];
  /** 이 단어가 들어 있는 Day 이름들. 예: ["Day 3", "Day 5"] */
  days: string[];
}

/**
 * 고른 Day 들의 단어로 카드 묶음을 만듭니다. Day 번호 → 단어 순서대로 놓습니다.
 * 여러 Day 에 같은 단어가 있으면 한 번만 내고, 뜻은 합쳐 어느 Day 의 뜻이든 정답으로 봅니다.
 */
export function buildDeck(days: DayWords[]): StudyCard[] {
  // 복사본을 정렬합니다 (toSorted 는 tsconfig lib ES2022 에 없음).
  // oxlint-disable-next-line unicorn/no-array-sort
  const sorted = [...days].sort((a, b) => a.day.dayNumber - b.day.dayNumber);
  const deck = new Map<string, StudyCard>();
  for (const { day, words } of sorted) {
    const label = dayLabel({ dayNumber: day.dayNumber, title: null });
    for (const word of words) {
      const key = wordKey(word.text);
      const same = deck.get(key);
      if (same) {
        same.senses = mergeSenses(same.senses, word.senses);
        if (!same.days.includes(label)) same.days.push(label);
      } else {
        deck.set(key, { key, text: word.text, senses: word.senses, days: [label] });
      }
    }
  }
  return [...deck.values()];
}

/** 카드 순서를 섞습니다 (원래 배열은 그대로). random 은 테스트에서 바꿔 끼웁니다. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** 외우기 방향: 영단어 보고 뜻(en_ko), 뜻 보고 영단어(ko_en), 둘을 5:5로 섞기(mixed) */
export type StudyDirection = "en_ko" | "ko_en" | "mixed";

/** 방향이 정해진 카드. mixed 를 고르면 카드마다 en_ko 또는 ko_en 이 정해집니다. */
export interface StudyItem extends StudyCard {
  direction: "en_ko" | "ko_en";
}

/**
 * 카드마다 방향을 정합니다. mixed 는 카드 절반(홀수면 남는 한 장은 무작위)을 뜻→영단어로,
 * 나머지를 영단어→뜻으로 무작위로 나눕니다. 카드 순서는 바꾸지 않습니다.
 */
export function assignDirections(
  cards: readonly StudyCard[],
  direction: StudyDirection,
  random: () => number = Math.random,
): StudyItem[] {
  if (direction !== "mixed") return cards.map((c) => ({ ...c, direction }));
  const extra = cards.length % 2 === 1 && random() < 0.5 ? 1 : 0;
  const koEnCount = Math.floor(cards.length / 2) + extra;
  const koEn = new Set(shuffle(cards.map((_, i) => i), random).slice(0, koEnCount));
  return cards.map((c, i) => ({ ...c, direction: koEn.has(i) ? "ko_en" : "en_ko" }));
}

/** 한 바퀴 결과에서 다시 볼(틀린) 카드만 고릅니다. 결과가 없는 카드(안 본 카드)는 빼지 않고 남깁니다. */
export function wrongItems<T extends StudyCard>(items: readonly T[], result: ReadonlyMap<string, boolean>): T[] {
  return items.filter((item) => result.get(item.key) !== true);
}
