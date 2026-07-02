# Tests that need to be modified
I have modified gift and subscription systems so it's more flexible now and I need you to help me out with tests

Below you will find multiple level 2 headers with existing filenames of test file with optional level 3 headers pointing to describe() blocks in these test files. Under every test filename you'll find an enumered list of instructions, and each point might contain list of test cases

You need to modify the tests exactly as described. If you doubt the logic, you can look at the code. Also, remember these points:
- Every new subscriber gets a free tier subscription
- There are gift subscriptions that can be given to any subscriber with any level of subscription. Gift is just an entity from gift table. Gifts can be activated
- Only one gift can be active at a time, and active gifts expire
- Active gift takes precedence over paid subscription (including any free tier)
- When gift is activated by a subscriber, the application's role guards will consider his subscription tier to be the tier of the gift (it is decided in the UserRepository.findByIdWithSubscription() method)
- When you need to see users actual subscription level, use this method or the SubscriptionRepository.lockById() method - it will show both paid and gift subscriptions that are active. When you need to assert current_tier_id or next_tier_id just get it from subscription entity
- Each subscription has the current_tier_id and the next_tier_id. next_tier_id is used for deciding the action when the subscription period ends - this happens in billing periods/cycles via susbcription-billing.service.ts

## handle-yookassa-webhook.controller.e2e-spec.ts:
1. Add new test cases:
- [ ] stores payment success event and switches subscription to tier with more power from metadata when currently subscriber was on gifted sub with lower power. Rest of gift is stashed away
- [ ] stores payment success event and switches subscription to paid one from metadata when currently subscriber was on gifted subscription of same tier power. Rest of gift is stashed away
- [ ] when user has a current sub with tier 1 but next_tier_id is 2 after the webhook is processed his current_tier_id should be pointing to tier 2
- [ ] when user has a current sub with tier 2 but next_tier_id is 1 after the webhook is processed his current_tier_id should be pointing to tier 1 but the userRepo.findByIdWithSubscriptionTier shows he is on tier 2 (meaning he is on an active gift), billing date is restOfGiftDays + the period he paid for

2. Add more assertions to existing test cases. The following case should also assert that the free sub doesn't have billing_period and other properties of a billable subscription
- [ ] stores cancellation event and downgrades subscription to free tier outside grace period 

## gift-subscription.controller.e2e-spec.ts:
1. Fix test cases as per new logic: giving a gift only creates a record in gift table but doesn't affect current subscription at all. This should be done for all test cases in this suite/file

## downgrade-subscription.controller.e2e-spec.ts

1. Add test cases:
- [ ] Lets user downgrade despite of having active gifted sub with higher power, this only lowers the next_tier_id including lowering to free tier if user tries to lower to free tier

## subscription-billing.service.spec.ts:

1. Make this into integration test, so use real repo instead of in-memory one

2. Read existing test suite. Ensure these tests are present and add extra assertions if needed:
- [ ] skips billing when persistence cannot load the subscription
- [ ] skips billing when subscription is not due yet
- [ ] skips execution when billing disabled
- [ ] charges due subscriptions and records success. current_tier_id
in the meta is the next_tier_id from current subscription
- [ ] processes all due subscriptions even when total exceeds batch size
- [ ] does not charge the same subscription twice when queue mutates mid-run
- [ ] stops processing when application shutdown interrupts a billing run

3. Add these test cases to the test suite
- [ ] skips billing on a user when he's on active gift until the gift expires
- [ ] doesn't charge a user who has next_tier_id pointing to a free tier yet his current_tier_id is a paid tier. This user gets downgraded to free tier
- [ ] doesn't charge on a user if there's no payment method, user gets downgraded to free tier if he's due to pay but no payment method
- [ ] charge is being made for the next_tier_id tier, not the current_tier_id
- [ ] first cycle skips paid subscribers who have been on active gift sub but when the gift expires before second cycle run they will be charged


## subscription.manager.spec.ts
1. Move through the describe blocks and do work as described below

### handleRegistration
1. Keep the original test case and create e2e case in finish-registration.e2e-spec.ts
- [ ] Copy to finish-registration.usecase test: creates free tier subscription for new user

### handleGift
1. Move to gift.controller.e2e-spec if needed:
- [ ] Cannot send gift for a non-subscriber user without existing subscription

2. Skip if already exists in accept-gifted-subscription.controller.e2e-spec otherwise implement in gifts handle e2e specs. Remove from the subscription.manager.spec.ts
- [ ] prolongs existing gifted subscription of the same tier
- [ ] Skip if already exists otherwise implement in accept-gifted-subscription.controller.e2e-spec: upgrades existing subscription to a higher tier
- [ ] Skip if already exists otherwise implement in accept-gifted-subscription.controller.e2e-spec: throws when trying to downgrade subscription tier


### handlePaymentEvent
1. Keep all of original ones and duplicate these tests to billing.service.spec and (/charge OR /yookassa/webhook) and make it e2e. When making assertions in tests, assert both current_tier_id and next_tier_id as per logic
- [ ] prolongs subscription on payment success and keeps payment schedule
- [ ] downgrades subscription tier on payment success when metadata tier has lower power
- [ ] upgrades subscription tier on payment success when metadata tier has higher power
- [ ] downgrades to free tier on payment cancellation outside grace period
- [ ] keeps subscription when payment cancellation happens within grace period

2. Add the following cases and double them in /charge + /webhook handling AND subscription-billing.service:
- [ ] Add case: payment failure when on a gift subscription (auto-downgrade but gift is kept unchanged)
- [ ] Add case: payment success when on an active gift (gift tier power lower than the paid for gift) so that rest of the gift is packed or just the billing date moved

3. Copy all of the test cases from describe('handlePaymentEvent') to 

### handleDowngrade
Move these to downgrade-subscription.controller.e2e-spec if they are missing there. Remove from subscription.manager.spec. Adjust assertion for new logic (/downgrade doesn't affect current subscription, only next_tier_id)
- [ ] downgrades subscription to a cheaper billable tier while keeping billing schedule
- [ ] resets billing data when downgrading to a non-billable tier
- [ ] throws when trying to downgrade to a higher power tier

2. Rename the subscription.manager.spec to subscription.state.spec