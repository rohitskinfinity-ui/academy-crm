"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p style={{ padding: 24, fontFamily: "system-ui" }}>Loading API docs…</p>
  ),
});

type Props = {
  spec: Record<string, unknown>;
};

export default function ReactSwagger({ spec }: Props) {
  return (
    <SwaggerUI
      spec={spec}
      persistAuthorization
      docExpansion="list"
      defaultModelsExpandDepth={-1}
    />
  );
}
