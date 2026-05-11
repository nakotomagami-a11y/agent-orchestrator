import { ProjectDetail } from "@/modules/projects/components/project-detail";

type Params = { params: Promise<{ id: string }> };

export default async function ProjectRoute({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <div className="toolbar">
        <h1>Project</h1>
        <span className="sub" style={{ fontFamily: "var(--font-mono)" }}>· {id}</span>
      </div>
      <ProjectDetail id={id} />
    </>
  );
}
