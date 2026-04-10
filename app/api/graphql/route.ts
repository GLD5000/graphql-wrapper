import { graphql } from "graphql";
import { rootValue, schema } from "../../../lib/graphql/schema";

type GraphQLBody = {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    message:
      "Use POST /api/graphql with a JSON body: { query, variables?, operationName? }",
  });
}

export async function POST(request: Request) {
  let body: GraphQLBody;

  try {
    body = (await request.json()) as GraphQLBody;
  } catch {
    return Response.json(
      { errors: [{ message: "Request body must be valid JSON." }] },
      { status: 400 },
    );
  }

  if (!body.query) {
    return Response.json(
      { errors: [{ message: "Missing GraphQL query in request body." }] },
      { status: 400 },
    );
  }

  const result = await graphql({
    schema,
    source: body.query,
    rootValue,
    variableValues: body.variables,
    operationName: body.operationName,
  });

  const status = result.errors?.length ? 400 : 200;
  return Response.json(result, { status });
}
