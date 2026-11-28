import { PrimaryButton } from "../../components/ui";
import { reviewCountLabel, useReviewWords } from "./ReviewPanel";

// 학생 홈의 "다시 볼 단어" (#12). 누르면 시험 메뉴로 갑니다.
export default function ReviewHomeCard({ studentId, onOpen }: { studentId: number; onOpen: () => void }) {
  const { data } = useReviewWords(studentId);
  if (!data) return null;
  return (
    <section
      className={`rounded-2xl bg-white p-5 ring-1 ${data.words.length > 0 ? "ring-2 ring-amber-200" : "ring-slate-200"}`}
    >
      <h2 className="text-lg font-semibold text-slate-800">
        다시 볼 단어 <span className="text-amber-700">{data.words.length}개</span>
      </h2>
      <p className="mt-1 text-base text-slate-600">
        {data.words.length > 0 ? reviewCountLabel(data) : "지금은 다시 볼 단어가 없어요. 시험에서 틀린 단어가 여기에 모여요."}
      </p>
      {data.words.length > 0 && (
        <PrimaryButton type="button" onClick={onOpen} className="mt-4 w-full sm:w-auto">
          다시 볼 단어 시험 보러 가기
        </PrimaryButton>
      )}
    </section>
  );
}
