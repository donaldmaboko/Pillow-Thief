# Pillow Thief — Store Listing Assets & Copy

Use these drafts, then replace screenshots with real captures from a
production-configuration build before submitting. **Do not publish screenshots
showing sandbox banners or test accounts.**

---

## 1. App identity

| Field | Value |
| --- | --- |
| App name | Pillow Thief |
| Tagline | Steal a cuddle. Keep the comfort. |
| Category (iOS) | Health & Fitness *(alternatives: Lifestyle)* |
| Category (Play) | Lifestyle |
| Age rating | 18+ (Mature) |
| Contains ads | No |
| In-app purchases | Yes (session bookings) |

> Apple guidance: companion/wellness apps that describe physical contact must be
> clearly non-sexual, must not make health claims, and must provide reporting and
> blocking. Pillow Thief implements all three. Review the "non-sexual
> professional companionship" wording in the review notes.

## 2. Short description (Play, ≤80 chars)

```
Book verified professional cuddle providers in Gaborone. Non-sexual, consent-first.
```

## 3. Full description

```
Pillow Thief connects adults who want comfort, calm and genuine human connection
with verified professional cuddle providers in Gaborone.

Real people. Genuine connection. Just cuddles.

WHAT YOU CAN DO
• Browse verified cuddle providers and view genuine reviews from completed sessions
• Explore the map to find providers near your area
• See services, session lengths (30/60/90/120 minutes) and prices upfront
• Choose how you meet: your place, their approved location, or a public place
• Pay securely in Botswana pula (BWP) with a clear price breakdown before you confirm
• Message your provider in the app, without sharing private contact details
• Agree on boundaries with a consent checklist before every session

SAFETY AND CONSENT FIRST
• Every provider is verified before their profile goes live
• Consent is ongoing — either person may pause or end a session at any time
• Report and block tools are built in and always available
• We do not share your exact address with other users
• Session boundaries, allowed contact, and conversation preferences are agreed in advance

PROFESSIONAL AND NON-SEXUAL
Pillow Thief is a service for non-sexual cuddling and companionship. Sexual
solicitation, harassment, coercion and recording without consent are prohibited
and lead to removal from the platform.

FOR CUDDLE PROVIDERS
• Apply, get verified, and publish your professional profile
• Set your own services, prices, durations and weekly availability
• Choose your service areas, travel fees and meeting options
• Track earnings, commission and payouts transparently
• Your legal name and documents are never shown publicly

Available in Gaborone, Botswana. Prices in BWP (pula). 18+ only.
```

## 4. Keywords (iOS, ≤100 chars total)

```
cuddle,companionship,wellness,relaxation,gaborone,botswana,comfort,cuddling,connection
```

## 5. Screenshot plan (6 per platform)

| # | Screen | Caption |
| --- | --- | --- |
| 1 | Home with verified providers | "Steal a cuddle. Keep the comfort." |
| 2 | Explore Map with provider pins | "Find providers near you on the map" |
| 3 | Provider profile | "Real profiles. Genuine reviews." |
| 4 | Booking summary with price breakdown | "Clear prices before you confirm" |
| 5 | Consent & boundaries checklist | "Agree on boundaries in advance" |
| 6 | Provider earnings dashboard | "Providers: your own prices, your schedule" |

Requirements: iOS 6.7" + 6.5" (or 6.9") sets; Android phone + 7"/10" tablet
optional. Avoid clinical/medical imagery; keep the warm cream/blush brand look.
Never show real user data, real names, addresses or phone numbers.

## 6. Store metadata to prepare

- [ ] Support URL (public) and support email
- [ ] Marketing URL (optional)
- [ ] Privacy policy URL (publish `docs/legal/privacy-policy.md` on your website)
- [ ] Terms of service URL
- [ ] App privacy labels: Location (approximate, app functionality), Contact info
      (email — account), User content (messages/reviews), Purchases, Identifiers
      (user ID), Diagnostics (if you add crash reporting)
- [ ] Play Data safety form matching the above
- [ ] Content rating questionnaire: 18+, no sexual content, user interaction = yes
- [ ] Review notes: staging test accounts (client + provider + admin), plus the
      sentence "All services are non-sexual professional companionship."
- [ ] Export compliance (standard encryption only → available in the form)
- [ ] Play: target API level per current requirement; Android App Bundle only

## 7. Pre-publish asset checklist

- [ ] App icon 1024×1024 (no transparency, no rounded corners applied by us) —
      `apps/mobile/assets/icon.png`
- [ ] Adaptive icon foreground/background (Android) — `assets/adaptive-icon.png`
- [ ] Splash screen artwork — `assets/splash.png`
- [ ] Feature graphic 1024×500 (Play) — produce from the brand palette
- [ ] Screenshots (above) captured on real devices
- [ ] Store text proof-read for accuracy: no claims about medical benefits,
      emergency response, or numbers of users/providers that we cannot verify
