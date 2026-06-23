import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// The public landing page at "/".
const isHome = createRouteMatcher(['/'])
// The entire app lives under "/dashboard" and is signed-in only.
const isProtected = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Signed-in visitors to the landing page are sent straight to the app.
  if (isHome(req)) {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Signed-out visitors never reach app content; Clerk handles the redirect.
  if (isProtected(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)',
    '/(api|trpc)(.*)',
  ],
}
