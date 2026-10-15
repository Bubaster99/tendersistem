-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "DocumentDownload" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "bidsOpenedNoticeAt" TIMESTAMP(3),
ADD COLUMN     "openNoticeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Subscription" (
    "companyId" TEXT NOT NULL,
    "workTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "byEmail" BOOLEAN NOT NULL DEFAULT true,
    "byTelegram" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("companyId")
);

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Тендеры, открытые до этапа 4, считаем уже разосланными, а прошедшие дедлайн — уже сообщёнными снабжению:
-- иначе при первом запуске ушли бы старые письма.
UPDATE "Tender" SET "openNoticeAt" = now() WHERE "status" <> 'planned';
UPDATE "Tender" SET "bidsOpenedNoticeAt" = now() WHERE "deadlineAt" IS NOT NULL AND "deadlineAt" <= now();
