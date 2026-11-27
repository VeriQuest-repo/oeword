// 외우기 2단계 객관식(#43)의 보기 만들기. 화면 전용 순수 로직입니다.
//
// - 정답 1개 + 오답 최대 3개 (사지선다)
// - 오답은 고른 범위(range)에서 먼저 뽑고, 모자라면 같은 단어장의 다른 단어(extra)에서 채웁니다.
// - 정답과 뜻이 하나라도 겹치는 단어(채점 규칙으로 같은 뜻)는 오답으로 쓰지 않습니다. 정답이 둘처럼 보이지 않게요.
// - 쓸 수 있는 단어가 모자라면 보기 수가 줄어듭니다. 정답 하나만 남으면 null (객관식을 낼 수 없음).
import { acceptedForms, normalizeEnglish } from "./grading";
import { shuffle, type StudyCard } from "./study";
import type { Sense } from "./words";

export interface ChoiceOption {
  /** 단어 열쇠 (wordKey) */
  key: string;
  /** 보기에 보여 줄 글자: 영단어→뜻이면 뜻, 뜻→영단어면 영단어 */
  label: string;
  correct: boolean;
}

export const CHOICE_COUNT = 4;

/** 단어의 뜻이 받아 주는 모양 모음 (뜻이 겹치는지 보려고 씁니다) */
function meaningForms(senses: Sense[]): Set<string> {
  return new Set(senses.flatMap((s) => s.meanings.flatMap(acceptedForms)));
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const form of a) if (b.has(form)) return true;
  return false;
}

/** 뜻 보기 글자: 품사가 하나면 "사과", 여럿이면 "명사 선물, 현재 / 형용사 참석한" */
export function meaningLabel(senses: Sense[]): string {
  if (senses.length === 1) return senses[0]!.meanings.join(", ");
  return senses.map((s) => `${s.pos} ${s.meanings.join(", ")}`).join(" / ");
}

/**
 * 카드 하나의 보기를 만듭니다. 보기 순서는 섞여 있습니다.
 * range 와 extra 에 정답 카드가 들어 있어도 됩니다 (알아서 뺍니다).
 */
export function buildChoices(
  card: StudyCard,
  direction: "en_ko" | "ko_en",
  range: readonly StudyCard[],
  extra: readonly StudyCard[] = [],
  random: () => number = Math.random,
): ChoiceOption[] | null {
  const answerForms = meaningForms(card.senses);
  const usedLabels = new Set<string>();
  const label = (c: StudyCard) => (direction === "en_ko" ? meaningLabel(c.senses) : c.text);
  const labelKey = (c: StudyCard) => (direction === "en_ko" ? label(c) : normalizeEnglish(c.text));
  usedLabels.add(labelKey(card));

  const seen = new Set<string>([card.key]);
  const distractors: StudyCard[] = [];
  for (const group of [range, extra]) {
    for (const other of shuffle(group, random)) {
      if (distractors.length >= CHOICE_COUNT - 1) break;
      if (seen.has(other.key)) continue;
      seen.add(other.key);
      if (overlaps(answerForms, meaningForms(other.senses))) continue;
      if (usedLabels.has(labelKey(other))) continue;
      usedLabels.add(labelKey(other));
      distractors.push(other);
    }
  }
  if (distractors.length === 0) return null;

  const options: ChoiceOption[] = [
    { key: card.key, label: label(card), correct: true },
    ...distractors.map((c) => ({ key: c.key, label: label(c), correct: false })),
  ];
  return shuffle(options, random);
}
