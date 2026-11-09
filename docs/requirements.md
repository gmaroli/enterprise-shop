# Requirements

Business rules and user stories for Enterprise Shop. Acceptance criteria describe intended behaviour.

## Roles
- **Visitor**: browses and searches the catalog.
- **Customer**: visitor plus cart, checkout and order history.
- **Admin**: customer plus product management and the all-orders view.

## Accounts
- US-1 As a visitor I can register with name, email and password.
  - Email is case-insensitive and unique. Password is 8 to 72 characters. Registering logs me in.
- US-2 As a user I can log in and out. Wrong credentials show "Invalid credentials". Sessions last 7 days.

## Catalog
- US-3 As a visitor I can browse products, 12 per page, sorted by name.
- US-4 I can search by name, description or SKU (case-insensitive) and filter by category.
- US-5 I can open a product page showing price, description, SKU and stock. Inactive products are not visible. Stock of 0 shows "Out of stock"; 10 or fewer shows "Only N left".

## Cart
- US-6 As a customer I can add a product to my cart (quantity 1 to 99). Adding an item already in the cart increases its quantity.
  - The quantity in the cart can never exceed current stock ("Only N in stock").
- US-7 I can change an item's quantity or remove it; setting the quantity to 0 removes it. The cart persists across sessions.
- US-8 I see line totals, subtotal, discount, shipping, tax and total.

## Region and currency
- US-16 The shop detects the visitor's country from their IP address (a bundled country database; no external calls) and pre-fills it as the shipping country at checkout. A country chosen in the header selector overrides detection ("Auto" returns to detection). On a private or loopback address (such as localhost) the configured dev address `GEO_DEV_IP` stands in; with none set the default country is used.
- US-17 Prices are shown and charged in the currency of the shopper's country: USD (US and any country the shop does not price in), AUD (AU), GBP (GB), CAD (CA) and EUR (DE, FR, ES, IT, NL, IE, AT, BE, PT, FI).
- US-18 Product prices are stored in USD. A shown price is the USD price multiplied by the exchange rate (units of the currency per 1 USD) and rounded to the nearest cent. Admins can edit the demo rates; USD is fixed at 1. Changing a rate affects new views and new orders only: an order keeps the rate it was charged at.
- US-19 Orders, the Stripe Checkout session and receipts use the shopper's currency. The order stores its currency and exchange rate.

## Pricing rules (money is in cents)
All rule amounts below are USD. In another currency, the shipping fee and the free-shipping threshold are converted with the same rate and rounded, line prices are converted per unit, and the percentage rules (coupon, tax) apply to the converted amounts.
- Subtotal: sum of unit price x quantity.
- Coupons (case-insensitive, trimmed): `WELCOME10` gives 10% off the subtotal (rounded to the nearest cent); `FREESHIP` removes shipping. Unknown codes are ignored. One coupon per order.
- Shipping: US$7.50 flat; free when the subtotal (before discount) is US$100.00 or more; free for an empty cart.
- Tax: 8% of the discounted subtotal, rounded to the nearest cent. Shipping is not taxed.
- Total: discounted subtotal + shipping + tax.

## Checkout and orders
- US-9 As a customer I can check out with a shipping address (name, address, city, postal code, 2-letter country; the country is pre-filled from the shopper's region). My cart must not be empty and every item must be in stock.
- US-10 Payment happens on Stripe's hosted page (test mode). An order is created as `PENDING` before I am redirected.
- US-11 When Stripe confirms payment, the order becomes `PAID`, stock is reduced by the quantities bought, and my cart is emptied.
  - Payment counts only when Stripe reports the session as paid and the amount and currency match the order; otherwise the order stays `PENDING` and the mismatch is logged.
  - Repeated or simultaneous deliveries of the same confirmation must not change anything twice.
- US-11a If the confirmation webhook is late or missing, returning to the success page, or using "Check payment status" on a pending order, asks Stripe directly and completes the order the same way.
- US-12 If the Stripe session expires or an async payment fails, the order becomes `CANCELLED` or `FAILED`.
- US-13 I can see my orders and any order's details. Only the owner or an admin can view an order.

## Admin
- US-14 Admins can list all products (including inactive), create, edit and deactivate products. SKU must be unique. Price is greater than 0; stock is a non-negative whole number.
- US-15 Admins can view all orders.

## Non-goals
Refunds, returns, live exchange rates, currencies beyond the five above, inventory reservation during checkout, email notifications, and password reset.
