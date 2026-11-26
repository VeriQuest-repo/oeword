// 엑셀에서 복사한 여러 단어 붙여넣기 (#6). 화면에서 미리보기를 만들 때 씁니다.
//
// 엑셀에서 단어·품사·뜻 3칸을 복사하면 칸은 탭, 줄은 줄바꿈으로 구분된 글자가 됩니다.
// - 같은 단어가 여러 줄이면 한 단어로 묶고, 품사별로 뜻을 모읍니다.
// - 뜻 칸의 쉼표(,)·세미콜론(;)은 뜻을 나누는 표시로 봅니다. 괄호 안의 쉼표는 나누지 않습니다.
//   예: "선물, 현재" → 뜻 2개, "(~에게, ~을) 주다" → 뜻 1개
// - 단어 칸이 비어 있으면(엑셀의 병합한 칸) 바로 윗줄 단어에 붙입니다.
// - 칸이 빠진 줄은 problems 로 알려 주고, 미리보기에서 고친 뒤 저장합니다.
import { tidy } from "./books";
import { checkWordInput, normalizePos, POS_OPTIONS, type Sense, splitMeanings, type WordInput } from "./words";

const isKnownPos = (value: string) => (POS_OPTIONS as readonly string[]).includes(normalizePos(value));

/** 붙여넣은 한 줄 (미리보기에서 고칠 수 있음) */
export interface PasteRow {
  /** 붙여넣은 글의 몇 번째 줄인지 (1부터) */
  line: number;
  word: string;
  pos: string;
  meaning: string;
  /** 단어 칸이 비어 윗줄 단어를 가져왔는지 */
  filledWord?: boolean;
}

/** 미리보기의 단어 하나 */
export interface PasteWord {
  text: string;
  senses: Sense[];
  rows: PasteRow[];
  /** 고쳐야 저장할 수 있는 문제 (줄 번호와 문구) */
  problems: { line: number; message: string }[];
  /** 알아 두면 좋은 안내 (저장은 됨) */
  notes: string[];
}

export const PASTE_MAX_WORDS = 300;

const HEADER_WORDS = new Set(["단어", "영단어", "영어", "word", "words", "english"]);

/** 탭·줄바꿈으로 된 표 글자를 칸으로 나눕니다. 엑셀이 따옴표로 감싼 칸(칸 안 줄바꿈)도 읽습니다. */
export function parseTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** 붙여넣은 글자를 단어·품사·뜻 줄로 바꿉니다. 빈 줄과 머리글 줄은 건너뜁니다. */
export function parseRows(text: string): PasteRow[] {
  const rows: PasteRow[] = [];
  for (const [index, raw] of parseTable(text).entries()) {
    let cells = raw.map((c) => tidy(c));
    while (cells.length > 0 && cells.at(-1) === "") cells = cells.slice(0, -1);
    if (cells.every((c) => c === "")) continue;
    // 맨 앞에 번호 칸이 있으면 뺍니다. 예: "1  present  명사  선물"
    if (cells.length >= 4 && /^\d+\.?$/.test(cells[0]!)) cells = cells.slice(1);
    // 머리글 줄 (단어 | 품사 | 뜻)
    if (rows.length === 0 && HEADER_WORDS.has((cells[0] ?? "").toLowerCase())) continue;

    // 2칸뿐이고 둘째 칸이 품사 이름이 아니면 품사 칸이 없는 것(단어 | 뜻)으로 보고, 품사만 고르면 되게 합니다.
    if (cells.length === 2 && !isKnownPos(cells[1]!)) cells = [cells[0]!, "", cells[1]!];
    const [word = "", pos = "", ...rest] = cells;
    // 뜻이 여러 칸에 나뉘어 있으면 하나로 모읍니다.
    const meaning = rest.filter(Boolean).join(", ");
    const row: PasteRow = { line: index + 1, word, pos, meaning };
    const previous = rows.at(-1);
    if (!word && previous?.word) {
      row.word = previous.word;
      row.filledWord = true;
    }
    rows.push(row);
  }
  return rows;
}

/** 줄들을 단어별로 묶습니다. 같은 단어(대소문자 무시)는 처음 나온 자리에 모읍니다. */
export function groupRows(rows: PasteRow[]): PasteWord[] {
  const words: PasteWord[] = [];
  for (const row of rows) {
    const text = tidy(row.word);
    const keyText = text.toLowerCase();
    let word = text ? words.find((w) => w.text.toLowerCase() === keyText) : undefined;
    if (!word) {
      word = { text, senses: [], rows: [], problems: [], notes: [] };
      words.push(word);
    }
    word.rows.push(row);

    const pos = normalizePos(row.pos);
    const meanings = splitMeanings(row.meaning);
    if (!text) word.problems.push({ line: row.line, message: "단어 칸이 비어 있어요." });
    if (!pos) word.problems.push({ line: row.line, message: "품사 칸이 비어 있어요." });
    if (meanings.length === 0) word.problems.push({ line: row.line, message: "뜻 칸이 비어 있어요." });
    if (row.filledWord) word.notes.push(`${row.line}번째 줄은 단어 칸이 비어 있어 윗줄 단어에 붙였어요.`);
    if (!pos || meanings.length === 0) continue;

    let sense = word.senses.find((s) => s.pos === pos);
    if (!sense) {
      sense = { pos, meanings: [] };
      word.senses.push(sense);
    }
    for (const m of meanings) if (!sense.meanings.includes(m)) sense.meanings.push(m);
  }

  for (const word of words) {
    if (word.problems.length > 0 || !word.text) continue;
    // 길이 제한 같은 나머지 규칙은 직접 입력과 같은 검사로 확인합니다.
    const checked = checkWordInput({ text: word.text, senses: word.senses });
    if (!checked.ok) word.problems.push({ line: word.rows[0]!.line, message: checked.message });
  }
  return words;
}

/** 문제 없는 단어만 저장용 모양으로 */
export function toWordInputs(words: PasteWord[]): WordInput[] {
  return words.filter((w) => w.problems.length === 0).map((w) => ({ text: w.text, senses: w.senses }));
}
