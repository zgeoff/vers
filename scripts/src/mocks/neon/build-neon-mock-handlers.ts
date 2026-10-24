import { HttpResponse, http } from 'msw';
import type { HttpHandler, HttpResponseResolver } from 'msw';
import { z } from 'zod';
import { neonBranchCollection } from './neon-branch-collection';
import type { NeonBranchRowSchema } from './neon-branch-collection';
import { neonOperationCollection } from './neon-operation-collection';
import type { NeonOperationRowSchema } from './neon-operation-collection';

export function buildNeonMockHandlers(apiOrigin: string): Array<HttpHandler> {
  return [
    http.get(`${apiOrigin}/projects/:projectID/branches`, makeListBranchesResolver()),
    http.post(`${apiOrigin}/projects/:projectID/branches`, makeCreateBranchResolver()),
    http.get(
      `${apiOrigin}/projects/:projectID/operations/:operationID`,
      makeReadOperationResolver(),
    ),
  ];
}

function makeListBranchesResolver(): HttpResponseResolver {
  return (info) => {
    if (!hasBearerToken(info.request)) {
      return refuseUnauthorized();
    }

    const branches = neonBranchCollection.findMany((query) =>
      query.where({ projectID: String(info.params['projectID']) }),
    );

    return HttpResponse.json({ branches: branches.map((branch) => toBranchPayload(branch)) });
  };
}

function hasBearerToken(request: Request): boolean {
  const authorization = request.headers.get('Authorization') ?? '';

  return authorization.startsWith('Bearer ') && authorization.length > 'Bearer '.length;
}

function refuseUnauthorized(): Response {
  return HttpResponse.json({ code: '', message: 'authorization failed' }, { status: 401 });
}

type BranchRow = z.infer<typeof NeonBranchRowSchema>;

function toBranchPayload(branch: BranchRow) {
  return {
    created_at: branch.createdAt.toISOString(),
    default: branch.parentID === null,
    expires_at: branch.expiresAt ?? undefined,
    id: branch.id,
    name: branch.name,
    parent_id: branch.parentID ?? undefined,
    project_id: branch.projectID,
  };
}

const createBranchBodySchema = z.object({
  branch: z.object({
    expires_at: z.string().optional(),
    name: z.string().min(1),
    parent_id: z.string().optional(),
  }),
});

function makeCreateBranchResolver(): HttpResponseResolver {
  return async (info) => {
    if (!hasBearerToken(info.request)) {
      return refuseUnauthorized();
    }

    const projectID = String(info.params['projectID']);

    const rawBody: unknown = await info.request.json();

    const body = createBranchBodySchema.safeParse(rawBody);

    if (!body.success) {
      return HttpResponse.json({ code: '', message: body.error.message }, { status: 400 });
    }

    const parentID = body.data.branch.parent_id;

    const parent =
      parentID === undefined
        ? undefined
        : neonBranchCollection.findFirst((query) => query.where({ id: parentID, projectID }));

    if (parentID !== undefined && parent === undefined) {
      return HttpResponse.json(
        { code: '', message: `branch ${parentID} not found` },
        { status: 404 },
      );
    }

    const branch = await neonBranchCollection.create({
      expiresAt: body.data.branch.expires_at ?? null,
      name: body.data.branch.name,
      parentID: parentID ?? null,
      projectID,
    });

    const operation = await neonOperationCollection.create({ branchID: branch.id, projectID });

    return HttpResponse.json(
      { branch: toBranchPayload(branch), operations: [toOperationPayload(operation)] },
      { status: 201 },
    );
  };
}

type OperationRow = z.infer<typeof NeonOperationRowSchema>;

function toOperationPayload(operation: OperationRow) {
  return {
    action: operation.action,
    branch_id: operation.branchID,
    id: operation.id,
    project_id: operation.projectID,
    status: operation.status,
  };
}

function makeReadOperationResolver(): HttpResponseResolver {
  return (info) => {
    if (!hasBearerToken(info.request)) {
      return refuseUnauthorized();
    }

    const operation = neonOperationCollection.findFirst((query) =>
      query.where({
        id: String(info.params['operationID']),
        projectID: String(info.params['projectID']),
      }),
    );

    if (operation === undefined) {
      return HttpResponse.json({ code: '', message: 'operation not found' }, { status: 404 });
    }

    return HttpResponse.json({ operation: toOperationPayload(operation) });
  };
}
