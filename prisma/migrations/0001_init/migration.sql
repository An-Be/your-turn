-- CreateEnum
CREATE TYPE "Player" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "NightStatus" AS ENUM ('DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('DONE', 'SKIP', 'SWAP', 'UNDO', 'CORRECT', 'BACKFILL', 'ROTATE');

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "playerAName" TEXT NOT NULL,
    "playerBName" TEXT NOT NULL,
    "currentStarter" "Player" NOT NULL DEFAULT 'A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Night" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "date" CHAR(10) NOT NULL,
    "starter" "Player" NOT NULL,
    "status" "NightStatus" NOT NULL,
    "appliedFlip" BOOLEAN NOT NULL DEFAULT false,
    "recordedBy" "Player",
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Night_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "date" CHAR(10),
    "by" "Player",
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_token_key" ON "Household"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Night_householdId_date_key" ON "Night"("householdId", "date");

-- CreateIndex
CREATE INDEX "Event_householdId_at_idx" ON "Event"("householdId", "at");

-- AddForeignKey
ALTER TABLE "Night" ADD CONSTRAINT "Night_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
