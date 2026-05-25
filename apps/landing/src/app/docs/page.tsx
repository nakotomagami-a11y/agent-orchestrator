import Nav from '../../components/Nav';
import DocsPage from "@agent-office/ui/docs";

export default function Docs() {
  return (
    <div className="h-screen overflow-hidden bg-bg-0">
      <Nav activePage="docs" />
      <div className="h-[calc(100vh-64px)] mt-16">
        <DocsPage />
      </div>
    </div>
  );
}
