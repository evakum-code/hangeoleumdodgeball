import { useCallback, useEffect, useRef, useState } from "react";
import courtImg from "@/assets/court.jpg";
import kid1 from "@/assets/kid1.png";
import kid2 from "@/assets/kid2.png";
import ballImg from "@/assets/ball.png";

type Kid = {
  id: number;
  x: number;
  y: number;
  vx: number;
  minX: number;
  maxX: number;
  img: string;
  out: boolean;
};

// 앞줄/뒷줄에 겹치게 배치 + 좌우로 움직이는 범위
const LAYOUT = [
  { x: 24, y: 51, vx: 0.16, minX: 18, maxX: 40 },
  { x: 28, y: 51, vx: -0.12, minX: 20, maxX: 42 },
  { x: 50, y: 50, vx: 0.1, minX: 44, maxX: 62 },
  { x: 54, y: 50, vx: -0.18, minX: 46, maxX: 64 },
  { x: 78, y: 51, vx: 0.14, minX: 70, maxX: 86 },
  { x: 32, y: 62, vx: -0.2, minX: 24, maxX: 46 },
  { x: 36, y: 62, vx: 0.22, minX: 26, maxX: 50 },
  { x: 64, y: 62, vx: 0.17, minX: 56, maxX: 82 },
  { x: 68, y: 62, vx: -0.15, minX: 58, maxX: 84 },
];

const depthScale = (y: number) => 0.42 + ((y - 46) / 26) * 0.5;

const makeKids = (): Kid[] =>
  LAYOUT.map((p, i) => ({
    id: i,
    x: p.x,
    y: p.y,
    vx: p.vx,
    minX: p.minX,
    maxX: p.maxX,
    img: i % 2 === 0 ? kid1 : kid2,
    out: false,
  }));

const BALL_HOME = { x: 50, y: 94 };

export default function DodgeballGame() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [kids, setKids] = useState<Kid[]>(makeKids);
  const [ball, setBall] = useState({ x: BALL_HOME.x, y: BALL_HOME.y });
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<"aim" | "fly" | "quiz" | "done">("aim");
  const [outCount, setOutCount] = useState(0);
  const [quiz, setQuiz] = useState<{ before: number; hitIds: number[] } | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const kidsRef = useRef(kids);
  kidsRef.current = kids;
  const raf = useRef<number | null>(null);
  const moveRaf = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const alive = kids.filter((k) => !k.out).length;
  const ballScale = Math.max(0.3, Math.min(1.25, depthScale(ball.y)));

  // 아이들이 좌우로 움직임
  useEffect(() => {
    const tick = () => {
      if (phaseRef.current === "aim" || phaseRef.current === "fly") {
        setKids((prev) =>
          prev.map((k) => {
            if (k.out) return k;
            let x = k.x + k.vx;
            let vx = k.vx;
            if (x < k.minX) {
              x = k.minX;
              vx = -vx;
            } else if (x > k.maxX) {
              x = k.maxX;
              vx = -vx;
            }
            return { ...k, x, vx };
          }),
        );
      }
      moveRaf.current = requestAnimationFrame(tick);
    };
    moveRaf.current = requestAnimationFrame(tick);
    return () => {
      if (moveRaf.current) cancelAnimationFrame(moveRaf.current);
    };
  }, []);

  const toPct = (e: { clientX: number; clientY: number }) => {
    const r = fieldRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  };

  const throwBall = useCallback((dirX: number, dirY: number) => {
    const len = Math.hypot(dirX, dirY) || 1;
    const speed = 1.55;
    let vx = (dirX / len) * speed;
    let vy = (dirY / len) * speed;
    if (vy > -0.2) vy = -0.2;
    let x = BALL_HOME.x;
    let y = BALL_HOME.y;
    setPhase("fly");

    const step = () => {
      x += vx;
      y += vy;
      setBall({ x, y });

      const s = Math.max(0.3, Math.min(1.25, depthScale(y)));
      // 겹쳐 있는 친구들은 한 번에 여러 명 맞을 수 있어요
      const inBody = (k: (typeof kidsRef.current)[number], px: number, py: number) => {
        const ks = depthScale(k.y);
        const halfW = 6.5 * ks;
        return (
          px > k.x - halfW &&
          px < k.x + halfW &&
          py < k.y + 2 &&
          py > k.y - 26 * ks
        );
      };

      const direct = kidsRef.current.filter((k) => !k.out && inBody(k, x, y) && Math.abs(s - depthScale(k.y)) < 0.35);

      // 겹쳐 서 있는 친구들은 공 하나로 함께 맞아요
      const hits = direct.length
        ? kidsRef.current.filter(
            (k) =>
              !k.out &&
              direct.some((d) => {
                const ks = depthScale(k.y);
                const ds = depthScale(d.y);
                return (
                  Math.abs(k.x - d.x) < 6.5 * (ks + ds) * 0.5 + 2 &&
                  Math.abs(k.y - d.y) < 6
                );
              }),
          )
        : [];

      if (hits.length > 0) {
        const before = kidsRef.current.filter((k) => !k.out).length;
        setQuiz({ before, hitIds: hits.map((h) => h.id) });
        setAnswer("");
        setFeedback(null);
        setPhase("quiz");
        return;
      }

      if (y < 42 || x < -5 || x > 105) {
        setToast("아쉽다! 빗나갔어요. 다시 던져볼까요?");
        setBall({ ...BALL_HOME });
        setPhase("aim");
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "aim") return;
    setAim(toPct(e));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phase !== "aim" || !aim) return;
    setAim(toPct(e));
  };
  const onPointerUp = () => {
    if (phase !== "aim" || !aim) return;
    const dx = aim.x - BALL_HOME.x;
    const dy = aim.y - BALL_HOME.y;
    setAim(null);
    if (Math.hypot(dx, dy) < 6) return;
    throwBall(dx, dy);
  };

  const submit = () => {
    if (!quiz) return;
    const n = quiz.hitIds.length;
    const correct = quiz.before - n;
    if (answer !== "" && Number(answer) === correct) {
      setKids((prev) => prev.map((k) => (quiz.hitIds.includes(k.id) ? { ...k, out: true } : k)));
      setOutCount((c) => c + n);
      setQuiz(null);
      setBall({ ...BALL_HOME });
      if (correct === 0) {
        setPhase("done");
      } else {
        setPhase("aim");
        setToast("정답! 공을 한 번 더 던질 수 있어요.");
      }
    } else {
      setFeedback("다시 세어볼까요? 아웃된 친구를 빼면 몇 명일까요?");
    }
  };

  const reset = () => {
    setKids(makeKids());
    setOutCount(0);
    setBall({ ...BALL_HOME });
    setQuiz(null);
    setPhase("aim");
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div
        ref={fieldRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative aspect-[3/2] w-full touch-none overflow-hidden rounded-3xl border-4 border-card shadow-2xl select-none"
      >
        <img
          src={courtImg}
          alt="햇살 가득한 학교 운동장 피구 코트"
          width={1536}
          height={1024}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* 상대편 코트 표시 */}
        <div className="pointer-events-none absolute left-1/2 top-[44%] h-[30%] w-[86%] -translate-x-1/2 rounded-[50%] border-4 border-dashed border-white/70" />

        {kids.map((k) => {
          const s = depthScale(k.y);
          return (
            <img
              key={k.id}
              src={k.img}
              alt="상대편 친구"
              loading="lazy"
              width={672}
              height={992}
              className="pointer-events-none absolute origin-bottom"
              style={{
                left: `${k.x}%`,
                top: `${k.y}%`,
                width: `${11 * s}%`,
                transform: `translate(-50%, -100%) scale(${k.out ? 0.4 : 1}) rotate(${k.out ? -75 : 0}deg)`,
                opacity: k.out ? 0 : 1,
                transition: "opacity .5s, scale .5s, rotate .5s",
                filter: "drop-shadow(0 6px 6px rgba(0,0,0,.35))",
              }}
            />
          );
        })}

        {/* 조준선 */}
        {aim && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={BALL_HOME.x}
              y1={BALL_HOME.y}
              x2={aim.x}
              y2={aim.y}
              stroke="white"
              strokeWidth="0.6"
              strokeDasharray="2 2"
            />
          </svg>
        )}

        {/* 공 */}
        <img
          src={ballImg}
          alt="피구공"
          width={816}
          height={816}
          className="pointer-events-none absolute"
          style={{
            left: `${ball.x}%`,
            top: `${ball.y}%`,
            width: `${13 * ballScale}%`,
            transform: "translate(-50%, -50%)",
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,.35))",
          }}
        />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-2 p-3 sm:p-4">
          <div className="rounded-2xl bg-card/90 px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">남은 친구</p>
            <p className="text-2xl font-bold text-foreground">{alive}명</p>
          </div>
          <div className="rounded-2xl bg-card/90 px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">내가 아웃시킨 친구</p>
            <p className="text-2xl font-bold text-foreground">{outCount}명</p>
          </div>
        </div>

        {phase === "aim" && (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-foreground/70 px-4 py-1.5 text-sm font-semibold text-background">
            공을 잡고 던지고 싶은 방향으로 드래그하세요
          </p>
        )}

        {toast && (
          <p className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-foreground/80 px-6 py-3 text-lg font-bold text-background">
            {toast}
          </p>
        )}

        {/* 계산 문제 */}
        {phase === "quiz" && quiz && (
          <QuizCard
            quiz={quiz}
            kids={kids}
            answer={answer}
            setAnswer={setAnswer}
            feedback={feedback}
            submit={submit}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-foreground">전부 아웃! 우리 팀 승리 🎉</h2>
              <p className="mt-2 text-muted-foreground">
                {outCount}명을 맞히고 계산도 모두 맞혔어요.
              </p>
              <button
                onClick={reset}
                className="mt-6 w-full rounded-2xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground"
              >
                다시 하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizCard({
  quiz,
  kids,
  answer,
  setAnswer,
  feedback,
  submit,
}: {
  quiz: { before: number; hitIds: number[] };
  kids: Kid[];
  answer: string;
  setAnswer: (v: string) => void;
  feedback: string | null;
  submit: () => void;
}) {
  const n = quiz.hitIds.length;
  const aliveKids = kids.filter((k) => !k.out);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-foreground/45 p-3 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-3xl bg-card p-5 text-center shadow-2xl">
        <p className="text-sm font-semibold text-primary">
          공이 {n === 1 ? "명중" : `${n}명에게 명중`}했어요!
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">몇 명이 남았을까요?</h2>

        {/* 사람이 빠지는 그림 */}
        <div className="mt-4 flex flex-wrap items-end justify-center gap-1 rounded-2xl bg-secondary p-3">
          {aliveKids.map((k) => {
            const hit = quiz.hitIds.includes(k.id);
            return (
              <div key={k.id} className="relative h-16 w-9">
                <img
                  src={k.img}
                  alt={hit ? "아웃되는 친구" : "남는 친구"}
                  className="h-full w-full object-contain"
                  style={{
                    opacity: hit ? 0.35 : 1,
                    transform: hit ? "rotate(-25deg) translateY(6px)" : "none",
                    filter: hit ? "grayscale(1)" : "none",
                  }}
                />
                {hit && (
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-destructive">
                    ✕
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ✕ 표시된 {n}명이 코트 밖으로 나가요
        </p>

        <p className="mt-3 text-2xl font-bold text-foreground">
          {quiz.before} − {n} = ?
        </p>
        <input
          inputMode="numeric"
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-3 w-32 rounded-2xl border-2 border-input bg-background px-4 py-3 text-center text-2xl font-bold text-foreground outline-none focus:border-primary"
          placeholder="?"
        />
        {feedback && <p className="mt-2 text-sm font-semibold text-destructive">{feedback}</p>}
        <button
          onClick={submit}
          className="mt-3 w-full rounded-2xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          정답 확인하고 공 받기
        </button>
      </div>
    </div>
  );
}
