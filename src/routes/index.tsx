import { createFileRoute } from "@tanstack/react-router";
import DodgeballGame from "@/components/DodgeballGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "피구 뺄셈 게임 | 공 던지고 남은 친구 세기" },
      {
        name: "description",
        content:
          "공을 드래그해 상대편 친구를 맞히고, 남은 친구 수를 계산해 입력하면 다음 공을 던질 수 있는 초등 뺄셈 학습 게임.",
      },
      { property: "og:title", content: "피구 뺄셈 게임" },
      {
        property: "og:description",
        content: "공을 던져 친구를 아웃시키고 남은 인원을 계산하는 뺄셈 학습 게임.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-secondary px-3 py-6">
      <header className="mx-auto mb-5 max-w-5xl text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">피구 뺄셈 게임</h1>
        <p className="mt-2 text-muted-foreground">
          공을 드래그해서 던지고, 남은 친구가 몇 명인지 계산해 보세요!
        </p>
      </header>
      <DodgeballGame />
    </main>
  );
}
