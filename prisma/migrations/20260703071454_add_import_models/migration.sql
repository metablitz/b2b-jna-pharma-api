-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discontinuedReason" TEXT,
ADD COLUMN     "minOrderQuantity" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "CategoryMapping" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deactivated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "kept" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMapping_rawName_key" ON "CategoryMapping"("rawName");
