import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 地図・投稿・認証ページはすべて公開（未ログインでも閲覧・投稿可能）
const isPublicRoute = createRouteMatcher([
  '/',
  '/submit(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/admin(.*)',  // 管理画面は独自ADMIN_TOKENで認証するためClerk対象外
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth.protect()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
