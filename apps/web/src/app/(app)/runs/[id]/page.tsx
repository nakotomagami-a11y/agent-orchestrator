import { RunDetail } from "@/modules/runs/components/run-detail";

type Params = { params: Promise<{ id: string }> };

export default async function RunDetailPage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <div className="toolbar">
        <h1>Run</h1>
        <span className="sub" style={{ fontFamily: "var(--font-mono)" }}>· {id}</span>
      </div>
      <RunDetail runId={id} />
    </>
  );
}
