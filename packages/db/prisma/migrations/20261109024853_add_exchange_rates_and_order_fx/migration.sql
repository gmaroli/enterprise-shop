-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fxRate" DECIMAL(18,8) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL,
    "perUsd" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'static',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);

-- Default demo exchange rates (units per 1 USD). Editable by admins; not live market rates.
INSERT INTO "ExchangeRate" ("currency", "perUsd", "source", "updatedAt") VALUES
  ('USD', 1,    'static', CURRENT_TIMESTAMP),
  ('AUD', 1.52, 'static', CURRENT_TIMESTAMP),
  ('GBP', 0.78, 'static', CURRENT_TIMESTAMP),
  ('CAD', 1.37, 'static', CURRENT_TIMESTAMP),
  ('EUR', 0.92, 'static', CURRENT_TIMESTAMP);
