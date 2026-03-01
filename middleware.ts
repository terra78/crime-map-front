import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 地図・投稿・認証ページはすべて公開（未ログインでも閲覧・投稿可能）
const isPublicRoute = createRouteMatcher([
  '/',
  '/submit(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth.protect()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
