- [x] Payment taables to payment module refactor
- [x] Добавить nextLevel, nextUpdatedAt в модель подписки
- [x] downgrade usecase + controller (понижает nextLevel, просто крудиксон)
- [x] Новые гифты (абстракция)

- у тебя левел 3
- ты даунгрейдишь на левел 2
- current = 3
- тебе дарят левел 5
- ты активируешь
- текущий левел 5, а вот что делать со следующим и с недоиспользованными днями твоей подписки?

1. Ограничить гифты так что они включаются только в конце периода платной подписки (если гифт повышает уровень)
2. Гифт повышенного уровня автоматом переводит тебя на повышенный уровень дальше, и сжигает (или докидывает) дни текущей подписки
3. Гифт повышенного уровня не переводит тебя на повышенный уровень дальше, а твои оставшиеся дни подписки приплюсовываются к времени гифта (или сжигаются)
4. Идеальное управление за счёт event-driven состояния подписки
5. Дополнительное поле current-до-подарка в таблице подарков. Количество дней до оплаты в целом один раз только посчитать нужно будет
Только тогда надо чтобы charge/upgrade при активном гифте менял текущую, а даунгрейд - после-гифтовую

6. When has active (activated_at not null + now - activated_at <= duration_days) gift, use gift's level when getting current sub level (current level is virtual, next_billing_at переносится на время подарка)

Constraint: unique on active gift

плюсы:
- активация гифта в любой момент
- точный контроль времени жизни гифта
- недоиспользованные дни подписки не сгорают, приплюсовать время гифта в плане - следующее списание тогда-то / next_billing_at переносится на время подарка
- всегда знаем мы на гифте или нет
- следующий и текущий левелы остаются

минусы:
- усложнение логики)) но с другой стороны это так или иначе пришлось бы делать
чуйка говорит это збс

Работаем
- [x] Нужен будет сервис-абстракция, который будет собсна получать левел и/или гифт. Его уже использовать в гарде и везде где нужен левел
- Убрать is_gift поле из подписки, использовать сервис наш новый
- [x] Запрос на подписку + гифт
SELECT s.*, (g.id IS NOT NULL) as is_gift FROM subscription s JOIN gift g ON s.user_id = g.gifted_to WHERE s.user_id = $1 AND g.activated_at IS NOT NULL -- <- this will use indices
 AND (now()::timestamptz - g.activated_at::timestamptz <= INTERVAL g.duration_days || ' days')

- [x] Индекс под запрос 
CREATE UNIQUE INDEX "gift_gifted_to_activated_at_unique_idx" ON "gift" USING btree ("gifted_to")
WHERE
  "activated_at" IS NOT NULL
  AND now()::timestamptz - "activated_at" <= interval "duration_days" || days

- [- решили удалить, нахуй оно надо вот рили? Добавили в юзерскую логику, придётся ещё кой-где продублировать] Вью или функция, чтобы подменять current_tier_id подарочным уровнем если у тебя есть активный гифт. Это в user.repository улетит, ну и плюсом пригодится в инфе по текущей подписке

CREATE OR REPLACE FUNCTION get_current_subscription(user_id uuid)
  returns table (
      subscription__is_gift boolean,
      subscription__gift_until timestamptz,
      subscription__id uuid,
      subscription__user_id uuid,
      subscription__current_tier_id uuid,
      subscription__next_tier_id uuid,
      subscription__price_on_purchase_rubles integer,
      subscription__grace_period_size smallint,
      subscription__billing_period_days smallint,
      subscription__current_period_end timestamp,
      subscription__last_billing_attempt timestamp,
      subscription__created_at timestamp,
      subscription__updated_at timestamp,
      subscription_tier__id uuid,
      subscription_tier__tier text,
      subscription_tier__power integer,
      subscription_tier__permissions text[],
      subscription_tier__price_rubles integer
  )
LANGUAGE SQL
STABLE
AS $$
            WITH current_subscription AS (
                SELECT
                    (g.id IS NOT NULL) as is_gift,
                    COALESCE(g.tier_id, s.current_tier_id) as actual_tier_id,
                    (g.activated_at::timestamptz + (g.duration_days || ' days')::interval) as gift_until,
                    s.*
                FROM subscription s
                JOIN gift g ON s.user_id = g.gifted_to
                WHERE s.user_id = $1 AND g.activated_at IS NOT NULL
                    AND (g.activated_at::timestamptz + (g.duration_days || ' days')::interval) >= now()::timestamptz
            )
            SELECT 
              cs.is_gift as subscription__is_gifted,
              cs.gift_until as subscription__gift_until,
				      cs.id as subscription__id,
				      cs.user_id as subscription__user_id,
              cs.actual_tier_id as subscription__current_tier_id,
				      cs.next_tier_id as subscription__next_tier_id,
				      cs.price_on_purchase_rubles as subscription__price_on_purchase_rubles,
				      cs.is_gifted as subscription__is_gifted,
				      cs.grace_period_size as subscription__grace_period_size,
				      cs.billing_period_days as subscription__billing_period_days,
				      cs.current_period_end as subscription__current_period_end,
				      cs.last_billing_attempt as subscription__last_billing_attempt,
				      cs.created_at as subscription__created_at,
				      cs.updated_at as subscription__updated_at,
				      st.id as subscription_tier__id,
				      st.tier as subscription_tier__tier,
				      st.power as subscription_tier__power,
				      st.permissions as subscription_tier__permissions,
				      st.price_rubles as subscription_tier__price_rubles,
            FROM current_subscription cs INNER JOIN subscription_tier st ON cs.tier_id = st.id
$$;

- [x] В user.repository брать цену уровня из джойна, а уровень подписки из вьюшки/функции (findAll / findByIdWithSubscriptionTier)
- [x] Удалить новый сервисо-репозиторий нахуй он нужен-то)


- [x] Починить билдачок
- [ ] SubscriptionService.handleDowngradeToFreeTier should be used in payment processing also when cancellation happens outside of grace
- [ ] BillingService: Doesn't charge on a user if there's no payment method, user gets downgraded to free tier if he's due to pay but no payment method
- [ ] BillingService: we should filter out the subs with next_tier pointing to free tier, meaning the prepareAttempt or some other method should say that they need to be excluded from billing and we should process them with downgrading to free tier
- [ ] GET /payments/history (фильтр по платёжным эвентам - самый простой вариант)

- [x] Удалить SubscriptionManager, ведь по сути теперь повышение и понижение уровней - это просто круды, а биллинг - ваще отдельная история. Единственный флоу где биллинг связан с понижением это после неудачных списаний принудительно перевести чела на гифт если есть или на бесплатный левел. Логику принудительного юза гифтов я бы выключил даже, так что по сути всё что может произойти - это перевод на бесплатку в случае неудачных списаний
А повышение происходит после удачной оплаты просто крудом, так что ну типа)..


Кто мутирует подписку? Вот их всех надо будет подредачить
- /registration (создаёт базовую подписку, single mode)
- /charge => success payment webhook (single mode)
- /downgrade (нет, только следующую)
- expire cron (batch mode)
- /use-gift (single mode)

- [x] billingCron (в зависимости от next_sub_level и тд)
- [ ] Добавить is_archived в уровень подписки и возможность работать с архивными уровнями (главный нюанс в том что tierByPower хуя с два найдёшь для subscription-manager + migration unique index on subscription_tier (power, is_archived))
- [+-] Дропнуть левые поля в subscription(is_gifted, priceOnPurchase и тд, всё это из джойнов должно получаться)
- [ ] Новые гифты (get, use, send)
- [ ] Фиксы в /charge (повышение уровня)

- [ ] GET /payment-methods/
- [ ] GET /subscription/ (типа по твоей подписке инфа)
- [ ] Идемпотентность в /charge

----
## Upgrade / downgrade of subscription
1. [x] Add upgrade subscription usecase. It requires an active payment method and it will result in immediate charge
(charge method)

[x] Frontend SHOULD warn of instant charging after purchase
[ ] Idempotency of "charge" method + e2e tests about it


[ ] Blocked by new gift system!
2. Downgrade of subscription will downgrade subscription and gift whatever time was left before the downgrade action happened in previous tier; gift will be auto-accepted

[ ] Frontend SHOULD explain this

3. Downgrade of current gifted sub will downgrade the pre-gifted sub level

[ ] Frontend SHOULD explain this
[ ] Frontend SHOULD show available gifts and 

- add to e2e spec of downgrade

## Gift system redesign

0. Terminology
- Gift - an ability of user to get certain amount of days of paid subscription without charges or even having payment method active
- S

1. Prepare the DB

[ ] Create gift table (entity & migrations file)
- gift (id uuid v7, gifted_to foreign key user(id), gifted_by foreign key user(id), tier_before_gift jsonb{current_tier_id, price_roubles} default null, activated_at timestamptz default null, duration_days smallint)
- check constraint gift_usage (tier_before_gift is not null AND activated_at is not null) OR (tier_before_gift is null AND is_used is null)
- check constraint gift_previous_subscription_info(/*check shape of jsonb */)

Th


2. Create the use-gift method: new POST /subscriptions/gift/:id - any user can call on gift that was gifted to him (check by gifted_to)
Sender of gift cannot 

It activates the gift from gift table marking it used so gift cannot be used again and records the tier_before_gift. User can only use his gifts

[ ] Create method (keep structure like any other of our endpoints with controller, usecase and e2e spec)
[ ] Add e2e spec for /use-gift
Cases: 
- 404 when trying to use gift gifted to another user
- 401 on auth/wrong token
- usage of already used gift causes 429 conflict
- 404 when trying to use non-existing gift
- user cannot use a gift that's lower tier than his current subscription (for current gifted subscription and current paid subscription both)
- activating a gift moves subscription billing time

[ ] Move all cases from current e2e spec for /subscriptions/gift to use-gift methods e2e spec


3. Edit the send-gift method: current POST /subscriptions/gift - admin-only handle

From now on only creates the ability to use the gift, add record to gift table 
[ ] Edit the usecase, controller
[ ] Add new test suite in e2e spec for send-gift methid
Cases
- sending lower-level subscription as a gift is prohibited
- sending higher-level subscription as a gift creates a new inactive gift regardless if has active gifted sub already or not
- sending same-level subscription in /send-gift should create a new gift entity regardless if it's user has an active gift or not

4. Crete the get-gifts method: new GET /subscriptions/gift (paginated 10 gifts on page) - any user sees his gifts, admin can see every gift he sent and filter by user telegram or email with LIKE search


-- 

3. Gifted subscription expires by cron just like the billing happens

- add e2e spec for cron expire-gift

4. If pre-gift tier should be billed sometime later, the billing time moves further by amount of days of gifted sub. Even if current subscription is on grace period of payment, the next try move by +X days of gifted sub

- add this to e2e spec for cron expire-gift

5. After gifted sub expires, return user his previous tier for previous price

- add this to e2e spec for cron expire-gift

6. If user has a gift that's active, he cannot use the new gift until the previous gift expires

- add this to e2e spec for /use-gift

7. If user has a unpacked gift and admin sends one more gift, user should be able to choose between the gifts but he can only activate one

- add GET /subscriptions/gift/
- add this to e2e spec for /use-gift




## Gift interaction with existing subscription
All of these should be added to e2e spec for cron expire-gift

1. Case:
Subscriber is subscribed to free tier, has no payment method. He's gifted a paid subscription for 30 days. Will he be demoted back to free tier? Are there e2e tests for this scenario?

Outcome:
- He should be demoted to free tier, no charges

2. Case:
Subscriber is subscribed to free tier but he has active payment method. He's gifted a paid subscription for 30 days. Will he be demoted back to free tier subscription or will the system charge him for the payment subscription after 30 days? Are there e2e tests for this scenario?

Outcome:
- He should be demoted to free tier, no charges

3. Case: 
Subscriber is subscribed to paid tier 1 and has active payment method. He's gifted a tier 2 (higher tier) subscription for 30 days. Will he be demoted to tier 1 after these 30 days and charged for tier 1 subscription? Are there tests for this case?

Outcome:
- He should be demoted to tier 1 and billed for tier 1 in days = sub_left_days + gifted.duration_days

4. Case:
Subscriber is subscribed to paid tier 1 and has no active payment methods. He's gifted a tier 2 (higher tier) subscription for 30 days. Will he be demoted to free tier after these 30 days? Are there tests for this case?

Outcome:
- He should be demoted to tier 1 and billed for tier 1 in days = sub_left_days + gifted.duration_days
- The billing should fail and he should be demoted further to free tier after grace_period

5. Case:
Subscriber is subscribed to to paid tier 2 and has an active payment method. He's gifted a tier 1 (lower tier) subscription for 30 days. Will the gifted subscription override the current subscription for 30 days? Will he be charged or after these 30 days? Are there tests for this case?

Outcome:
- User cannot be gifted a lower tier than what he has

6. Case:
Subscriber is subscribed to to paid tier 2 and has no active payment methods. He's gifted a tier 1 (lower tier) subscription for 30 days. Will he use all of the tier 2 until its' end and then be switched to tier 1 gifted subscription? Are there tests for this case?

Outcome:
- User cannot be gifted a lower tier than what he has


___
Ваще не держать ничего из внешних зависимостей в нём
Мб он ваще не нужен? По сути ведь вся его логика будет в юзкейсах
По сути он на основании текущей подписки, недавних платежей и существующих гифтов должен решить что делать
Но проблема в том что на основании его данных надо потом принимать какие-то решения
По сути у него должен быть один метод публичный типа: decideNextSubscription(currentSubscription{gracePeriod, expiresAt, nextLevel, curentLevel}, latestPaymentAttempt {success/fail, tierId}, availableGifts Gift[]): {currentLevel, nextLevel}
Сразу отдаёт все нужные поля. Один центр бизнес-логики. Ноль внешних зависимостей

__
create or replace function get_current_subscription_resolved(p_user_id uuid)
returns table (
  is_gift boolean,
  gift_until timestamptz,
  subscription__id uuid,
  subscription__user_id uuid,
  subscription__current_tier_id uuid,
  subscription__next_tier_id uuid,
  subscription__price_on_purchase_rubles integer,
  subscription__grace_period_size smallint,
  subscription__billing_period_days smallint,
  subscription__current_period_end timestamp,
  subscription__last_billing_attempt timestamp,
  subscription__created_at timestamp,
  subscription__updated_at timestamp,
  subscription_tier__id uuid,
  subscription_tier__tier text,
  subscription_tier__power integer,
  subscription_tier__permissions text[],
  subscription_tier__price_rubles integer
)
language sql
stable
as $$
  select
    (ag.id is not null) as is_gift,
    case
      when ag.id is not null
        then ag.activated_at + interval '1 day' * ag.duration_days
      else null
    end as gift_until,

    s.id as subscription__id,
    s.user_id as subscription__user_id,
    coalesce(ag.tier_id, s.current_tier_id) as subscription__current_tier_id,
    s.next_tier_id as subscription__next_tier_id,
    s.price_on_purchase_rubles as subscription__price_on_purchase_rubles,
    s.grace_period_size as subscription__grace_period_size,
    s.billing_period_days as subscription__billing_period_days,
    s.current_period_end as subscription__current_period_end,
    s.last_billing_attempt as subscription__last_billing_attempt,
    s.created_at as subscription__created_at,
    s.updated_at as subscription__updated_at,

    st.id as subscription_tier__id,
    st.tier as subscription_tier__tier,
    st.power as subscription_tier__power,
    st.permissions as subscription_tier__permissions,
    st.price_rubles as subscription_tier__price_rubles
  from subscription s
  left join lateral (
    select g.id, g.tier_id, g.activated_at, g.duration_days
    from gift g
    where g.gifted_to = s.user_id
      and g.activated_at is not null
      and g.activated_at + interval '1 day' * g.duration_days > now()
    order by g.activated_at desc
    limit 1
  ) ag on true
  join subscription_tier st on st.id = coalesce(ag.tier_id, s.current_tier_id)
  where s.user_id = p_user_id
  limit 1;
$$;
        
______
        /*
            WITH current_subscription AS (
                SELECT
                    (g.id IS NOT NULL) as is_gift,
                    COALESCE(g.tier_id, s.current_tier_id) as tier_id,
                    (g.activated_at::timestamptz + (g.duration_days || ' days')::interval) as gift_until
                FROM subscription s
                JOIN gift g ON s.user_id = g.gifted_to
                WHERE s.user_id = $1 AND g.activated_at IS NOT NULL
                    AND (g.activated_at::timestamptz + (g.duration_days || ' days')::interval) >= now()::timestamptz
            )
            SELECT * FROM current_subscription INNER JOIN subscription_tier ON current_subscription.tier_id = subscription_tier.id
         */