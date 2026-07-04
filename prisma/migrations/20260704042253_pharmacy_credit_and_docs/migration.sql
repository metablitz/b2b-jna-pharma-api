-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "businessLicenseFile" BYTEA,
ADD COLUMN     "businessLicenseName" TEXT,
ADD COLUMN     "creditLimit" INTEGER NOT NULL DEFAULT 3000000,
ADD COLUMN     "licenseSubmitMethod" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "pharmacyLicenseFile" BYTEA,
ADD COLUMN     "pharmacyLicenseName" TEXT,
ALTER COLUMN "businessLicense" SET DEFAULT '',
ALTER COLUMN "ward" SET DEFAULT '',
ALTER COLUMN "district" SET DEFAULT '';
