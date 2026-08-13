/*
  Warnings:

  - You are about to drop the column `totalCop` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalUsd` on the `Order` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BrasapointsTransactionType" AS ENUM ('WELCOME', 'ORDER_REWARD', 'REDEMPTION', 'MANUAL_ADJUSTMENT');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MenuItem" ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "totalCop",
DROP COLUMN "totalUsd",
ADD COLUMN     "brasapointsDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "brasapointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "brasapointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "total" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "BrasapointsAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrasapointsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrasapointsTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "BrasapointsTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrasapointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrasapointsRule" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "minimumOrderAmount" DOUBLE PRECISION,
    "points" INTEGER NOT NULL,
    "pointValue" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrasapointsRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrasapointsAccount_customerId_key" ON "BrasapointsAccount"("customerId");

-- CreateIndex
CREATE INDEX "BrasapointsTransaction_accountId_createdAt_idx" ON "BrasapointsTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "BrasapointsTransaction_orderId_idx" ON "BrasapointsTransaction"("orderId");

-- CreateIndex
CREATE INDEX "BrasapointsRule_locationId_active_idx" ON "BrasapointsRule"("locationId", "active");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrasapointsAccount" ADD CONSTRAINT "BrasapointsAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrasapointsTransaction" ADD CONSTRAINT "BrasapointsTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrasapointsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrasapointsTransaction" ADD CONSTRAINT "BrasapointsTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrasapointsRule" ADD CONSTRAINT "BrasapointsRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
