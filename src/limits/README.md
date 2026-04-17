## Core ideas:
- limits are statically created objects
- log user's call of an AI feature. Just store records like user_id X used the feature Y at
- we have hourly and daily limits. We could extend this to X-hourly and Y-daily but no need I figured
- limits are checked and logged only for free-tier subs, all students, admins and paid subs are limitless
- for frontend display we have GET /limits handle and for backend safety we have a @LimitByFeature decorator

## Product meaning
- Balance the demand and our compute capacity by adjusting tiers limits and pricing. For now, all paid tiers are limitless which should promote paid subs
- Limits are softer than "trial". You still can analyze interviews even though you haven't paid. Just not as much