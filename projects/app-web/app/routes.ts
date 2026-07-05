import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, route } from '@react-router/dev/routes';
import { Routes } from './types';

export default [
  layout('layouts/public-layout.tsx', [
    index('routes/_index/route.tsx'),
    route(Routes.Login, 'routes/login/route.tsx'),
    route(Routes.LoginForceLogout, 'routes/login_force-logout/route.tsx'),
    route(Routes.Signup, 'routes/signup/route.tsx'),
    route(Routes.Onboarding, 'routes/onboarding/route.tsx'),
    route(Routes.VerifyOTP, 'routes/verify-otp/route.tsx'),
    route(Routes.Logout, 'routes/logout/route.tsx'),
    route(Routes.ForgotPassword, 'routes/forgot-password/route.tsx'),
    route(Routes.ResetPassword, 'routes/reset-password/route.tsx'),
    route(Routes.ResetPasswordStarted, 'routes/reset-password-started/route.tsx'),
  ]),

  layout('layouts/authed-layout/authed-layout.tsx', [
    route(Routes.Nexus, 'routes/nexus/route.tsx'),
    route(Routes.Account, 'routes/account/route.tsx'),
    route(Routes.AccountChangeEmail, 'routes/account_change-email/route.tsx'),
    route(Routes.AccountChangePassword, 'routes/account_change-password/route.tsx'),
    route(Routes.AccountVerify2FA, 'routes/account_verify-2fa/route.tsx'),
    route(Routes.Aether, 'routes/aether/route.tsx'),
    route(Routes.AetherNode, 'routes/aether_node/route.tsx'),
    route(Routes.Avatar, 'routes/avatar/route.tsx'),
    route(Routes.AvatarCreate, 'routes/avatar_create/route.tsx'),
  ]),

  route('*', 'routes/splat/route.tsx'),
] satisfies RouteConfig;
