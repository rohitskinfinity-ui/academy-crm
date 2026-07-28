import { getOpenApiDocument } from "@/lib/swagger/openapi";
import ReactSwagger from "./react-swagger";

/**
 * Swagger UI — NestJS equivalent of:
 *   SwaggerModule.setup('api', app, document)
 *
 * In Next.js `/api/*` is reserved for route handlers, so UI lives at `/api-docs`.
 * Spec JSON: GET /api/openapi
 */
export default function ApiDocsPage() {
  const spec = getOpenApiDocument() as unknown as Record<string, unknown>;

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <ReactSwagger spec={spec} />
    </main>
  );
}
