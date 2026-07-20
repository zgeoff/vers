import * as neon from '@pulumi/neon';

/**
 * The default provider authenticates with an org API key read from
 * NEON_API_KEY in the environment resolved by `op run`. The key itself is
 * console-managed: a key cannot rotate itself without invalidating the
 * session doing the rotating.
 *
 * This module owns the project/branch/compute/role layer only. Databases,
 * schemas, and migrations stay with the migration pipeline, and the SQL
 * grants behind each role stay a documented provisioning step — the Neon API
 * models role existence, not in-database privileges. Role passwords are
 * Neon-generated secret outputs held in the encrypted stack state; nothing
 * here declares a credential value.
 */

/**
 * Endpoint compute is uniform across branches: autoscaling 0.25–8 CU with
 * suspend_timeout 0, which defers to Neon's global 300s scale-to-zero
 * default. Deleting the project destroys every branch and database under it,
 * so the resource is protected.
 */
const project = new neon.Project(
  'vers',
  {
    name: 'vers',
    orgId: 'org-long-snow-12176298',
    regionId: 'aws-ap-southeast-2',
    pgVersion: 17,
    historyRetentionSeconds: 21_600,
    defaultEndpointSettings: {
      autoscalingLimitMinCu: 0.25,
      autoscalingLimitMaxCu: 8,
      suspendTimeoutSeconds: 0,
    },
  },
  { protect: true },
);

/**
 * The default branch, holding the production identity databases. Deleting it
 * is deleting production data, hence protect.
 */
const mainBranch = new neon.Branch(
  'main',
  {
    projectId: project.id,
    name: 'main',
  },
  { protect: true },
);

/**
 * Parent of every per-worktree dev clone: the dev-clone tooling assumes this
 * branch exists and holds the dev_base template database it clones from.
 */
const devBranch = new neon.Branch(
  'dev',
  {
    projectId: project.id,
    name: 'dev',
    parentId: mainBranch.id,
  },
  { protect: true },
);

const mainEndpoint = new neon.Endpoint(
  'main',
  {
    projectId: project.id,
    branchId: mainBranch.id,
    type: 'read_write',
    autoscalingLimitMinCu: 0.25,
    autoscalingLimitMaxCu: 8,
    suspendTimeoutSeconds: 0,
  },
  { protect: true },
);

const devEndpoint = new neon.Endpoint(
  'dev',
  {
    projectId: project.id,
    branchId: devBranch.id,
    type: 'read_write',
    autoscalingLimitMinCu: 0.25,
    autoscalingLimitMaxCu: 8,
    suspendTimeoutSeconds: 0,
  },
  { protect: true },
);

/**
 * The read-only role the postgres MCP server uses against production. Its
 * SELECT-only grants and default_transaction_read_only flag are SQL applied
 * per the database provisioning doc; the resource owns existence only.
 */
const mcpRORole = new neon.Role(
  'mcp-ro',
  {
    projectId: project.id,
    branchId: mainBranch.id,
    name: 'mcp_ro',
  },
  { protect: true },
);

/**
 * Owner of the dev-clone databases (dev_base and the per-worktree clones).
 * Its CREATEDB grant is SQL applied per the database provisioning doc.
 */
const mcpDevRole = new neon.Role(
  'mcp-dev',
  {
    projectId: project.id,
    branchId: devBranch.id,
    name: 'mcp_dev',
  },
  { protect: true },
);

export const neonProjectName = project.name;
export const neonMainBranchName = mainBranch.name;
export const neonDevBranchName = devBranch.name;
export const neonMainEndpointID = mainEndpoint.id;
export const neonDevEndpointID = devEndpoint.id;
export const neonMCPRORoleName = mcpRORole.name;
export const neonMCPDevRoleName = mcpDevRole.name;
