// PageHeader now lives in the shared UI package so `/docs` (which
// renders from packages/ui) can use the same header as the app routes.
// Re-exported here so existing `@/components/ui/page-header` imports
// keep working without touching every consumer.
export { PageHeader } from "@agent-office/ui/page-header";
