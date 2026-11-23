// D1 테이블 한 줄(row)의 모양. migrations/0001_init.sql 과 맞춥니다.

import type { ManageMode, MemberRole } from "../../src/lib/permissions";

// 역할·관리 방식은 화면과 함께 쓰므로 src/lib/permissions.ts 에 정의합니다.
export type { ManageMode, MemberRole };
export type QuestionCount = 30 | 40 | 50;

export interface Family {
  id: number;
  name: string;
  created_at: string;
}

export interface Member {
  id: number;
  family_id: number;
  name: string;
  role: MemberRole;
  sort_order: number;
  created_at: string;
}

export interface FamilySettings {
  family_id: number;
  manage_mode: ManageMode;
  question_count: QuestionCount;
  updated_at: string;
}

export interface Book {
  id: number;
  family_id: number;
  title: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface Day {
  id: number;
  book_id: number;
  day_number: number;
  title: string | null;
  created_at: string;
}

export interface Meaning {
  id: number;
  word_id: number;
  pos: string;
  text: string;
  sort_order: number;
}

export interface Word {
  id: number;
  day_id: number;
  text: string;
  sort_order: number;
  created_at: string;
}

/** 단어와 품사별 뜻을 함께 담은 모양 (화면에서 바로 쓰기 좋게). */
export interface WordWithMeanings extends Word {
  meanings: Meaning[];
}

/** 로그인 세션 (0002_session.sql). 토큰 원문은 저장하지 않습니다. */
export interface Session {
  token_hash: string;
  family_id: number;
  member_id: number | null;
  created_at: string;
  expires_at: string;
}
