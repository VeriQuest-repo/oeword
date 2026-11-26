// 화면 키보드가 입력칸을 가리지 않게 합니다 (#8).
//
// 아이패드·폰에서 키보드가 올라오면 보이는 영역(visualViewport)이 줄어듭니다.
// - 줄어든 만큼을 CSS 변수 --keyboard-inset 에 넣어, 화면 아래에 그만큼 여백을 둡니다 (마지막 버튼까지 올려 볼 수 있게).
// - 입력칸에 들어가거나 키보드 크기가 바뀌면, 입력칸이 가려졌을 때 보이는 영역 가운데로 옮깁니다.
import { useEffect } from "react";

const MARGIN = 16;

function isTextInput(el: Element | null): el is HTMLElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** 지금 입력 중인 칸이 키보드나 화면 밖에 가려져 있으면 보이는 곳으로 옮깁니다. */
function revealFocused() {
  const el = document.activeElement;
  const vv = window.visualViewport;
  if (!isTextInput(el) || !vv) return;
  const rect = el.getBoundingClientRect();
  const top = vv.offsetTop + MARGIN;
  const bottom = vv.offsetTop + vv.height - MARGIN;
  if (rect.bottom > bottom || rect.top < top) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    const onResize = () => {
      update();
      revealFocused();
    };
    // 키보드가 다 올라온 뒤(약 0.3초)에 한 번 더 확인합니다.
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(revealFocused, 300);
    };

    update();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocus);
    return () => {
      clearTimeout(timer);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocus);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
