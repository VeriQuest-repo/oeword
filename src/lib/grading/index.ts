// 채점 규칙 (#9). 화면(외우기·화면 시험)과 서버(시험 기록)가 함께 씁니다.
//
// 규칙은 CLAUDE.md 5장, 노션 기획 "1. 채점 규칙"을 따릅니다. 바꾸려면 사람 확인이 필요합니다.
// - 품사마다 뜻 하나 이상을 맞히면 정답. 한 품사에 뜻이 여러 개면 그중 하나만 맞아도 됨
// - 앞뒤·중간 공백, 쉼표, 물결(~)은 무시하고 비교
// - 괄호 부분은 써도 되고 생략해도 됨: "(~을) 주다" → "~을 주다", "주다" 모두 정답
// - "~하다" / "~한" 같은 어미 차이는 틀림 (글자가 다르면 틀림)
// - 정답은 단어장에 입력된 뜻만 기준. 비슷한 말을 정답으로 보지 않음
import type { Sense } from "../words";
import { splitMeanings } from "../words";

/** 무시하는 글자: 공백, 쉼표(반각·전각·모점), 물결(반각·전각·수학 물결). 아이패드 키보드·손글씨가 넣는 모양까지 포함합니다. */
const IGNORED = /[\s,，、~～∼〜]/g;
const OPEN = "(（";
const CLOSE = ")）";
/** 괄호가 많아도 경우의 수가 지나치게 늘지 않게 막습니다 (괄호 6개 = 64가지). */
const MAX_VARIANTS = 64;

/** 비교용으로 정리: 유니코드 모양 맞추기(NFC) 후 공백·쉼표·물결·괄호 글자를 뺍니다. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFC")
    .replace(IGNORED, "")
    .replace(/[()（）]/g, "");
}

type Token = string | Token[];

/** "(~을) 주다" → [["~을"], " 주다"]. 괄호 안은 배열(써도 되고 안 써도 되는 부분)로 묶습니다. */
function parse(text: string): Token[] {
  const root: Token[] = [];
  const stack: Token[][] = [root];
  let buffer = "";
  const flush = () => {
    if (buffer) stack[stack.length - 1]!.push(buffer);
    buffer = "";
  };
  for (const ch of text) {
    if (OPEN.includes(ch)) {
      flush();
      const group: Token[] = [];
      stack[stack.length - 1]!.push(group);
      stack.push(group);
    } else if (CLOSE.includes(ch)) {
      flush();
      if (stack.length > 1) stack.pop(); // 짝 없는 닫는 괄호는 무시
    } else {
      buffer += ch;
    }
  }
  flush();
  return root; // 닫히지 않은 괄호는 끝까지를 괄호 부분으로 봅니다.
}

function expand(tokens: Token[]): string[] {
  let results = [""];
  for (const token of tokens) {
    const options = typeof token === "string" ? [token] : ["", ...expand(token)];
    const next: string[] = [];
    for (const head of results) for (const tail of options) next.push(head + tail);
    results = [...new Set(next)].slice(0, MAX_VARIANTS);
  }
  return results;
}

/**
 * 단어장 뜻 하나가 정답으로 받아 주는 모양들 (정리한 글자).
 * 예: "(~을) 주다" → ["주다", "을주다"]
 */
export function acceptedForms(meaning: string): string[] {
  const forms = expand(parse(meaning.normalize("NFC"))).map(normalizeAnswer).filter(Boolean);
  return [...new Set(forms)];
}

/** 답 하나가 뜻 목록 중 하나와 맞는지. */
function matchesOne(answer: string, meanings: string[]): boolean {
  const key = normalizeAnswer(answer);
  if (!key) return false;
  return meanings.some((m) => acceptedForms(m).includes(key));
}

/**
 * 한 품사 입력칸의 답이 맞는지.
 * - 답 전체가 단어장 뜻 하나와 맞으면 정답 (쉼표는 무시하므로 "~을, 주다"도 "(~을) 주다"와 맞음)
 * - 한 칸에 뜻을 쉼표로 여러 개 적었으면, 적은 뜻이 모두 이 품사의 단어장 뜻이어야 정답
 *   (예: 단어장 "선물, 현재"에 "현재, 선물" → 정답, "선물, 사과" → 틀림)
 */
export function isSenseCorrect(answer: string, meanings: string[]): boolean {
  if (matchesOne(answer, meanings)) return true;
  const parts = splitMeanings(answer.normalize("NFC").replace(/、/g, ","));
  return parts.length > 1 && parts.every((part) => matchesOne(part, meanings));
}

export interface SenseGrade {
  pos: string;
  /** 학생이 쓴 답 (그대로) */
  answer: string;
  correct: boolean;
  /** 단어장 뜻 (결과 화면에 그대로 보여 줌) */
  meanings: string[];
}

export interface WordGrade {
  /** 모든 품사를 맞혔는지 */
  correct: boolean;
  senses: SenseGrade[];
}

/**
 * 영→한 채점. answers 는 senses 와 같은 순서의 품사별 입력칸 답입니다 (비어 있으면 틀림).
 * 품사마다 뜻 하나 이상을 맞혀야 단어 전체가 정답입니다.
 */
export function gradeEnKo(senses: Sense[], answers: readonly (string | undefined)[]): WordGrade {
  const graded = senses.map((sense, i) => {
    const answer = answers[i] ?? "";
    return { pos: sense.pos, answer, correct: isSenseCorrect(answer, sense.meanings), meanings: sense.meanings };
  });
  return { correct: graded.length > 0 && graded.every((s) => s.correct), senses: graded };
}

/** 한→영 비교용 정리: 대소문자·앞뒤 공백 무시, 중간 여러 칸 공백은 한 칸, 아이패드의 둥근 따옴표(’)는 ' 로. */
export function normalizeEnglish(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** 한→영 채점: 단어장 영단어와 같은지 (대소문자·앞뒤 공백 무시). */
export function gradeKoEn(word: string, answer: string): boolean {
  const key = normalizeEnglish(answer);
  return key !== "" && key === normalizeEnglish(word);
}
