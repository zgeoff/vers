import * as neon from '@pulumi/neon';

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

      // 0 does not disable suspend; it defers to Neon's global 300s scale-to-zero default
      suspendTimeoutSeconds: 0,
    },
  },
  { protect: true },
);

const mainBranch = new neon.Branch(
  'main',
  {
    projectId: project.id,
    name: 'main',
  },
  { protect: true },
);

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

const mcpRORole = new neon.Role(
  'mcp-ro',
  {
    projectId: project.id,
    branchId: mainBranch.id,
    name: 'mcp_ro',
  },
  { protect: true },
);

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
