-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "awardedAt" TIMESTAMP(3),
ADD COLUMN     "budget" DECIMAL(15,2),
ADD COLUMN     "rebidDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "winnerCompanyId" TEXT;

-- CreateTable
CREATE TABLE "RebidInvite" (
    "tenderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RebidInvite_pkey" PRIMARY KEY ("tenderId","companyId")
);

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_winnerCompanyId_fkey" FOREIGN KEY ("winnerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebidInvite" ADD CONSTRAINT "RebidInvite_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebidInvite" ADD CONSTRAINT "RebidInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
