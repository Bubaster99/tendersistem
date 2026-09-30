-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('planned', 'open', 'closed', 'rebid', 'awarded', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('bom_template', 'tz', 'contract', 'drawings', 'other');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "stage" TEXT,
    "finishDate" TEXT,
    "size" TEXT,
    "coverImage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibleContactId" TEXT,

    CONSTRAINT "WorkType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "scope" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "telegram" TEXT,
    "photo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'planned',
    "plannedStart" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "workStart" TEXT,
    "paymentTerms" TEXT,
    "retentionPercent" DECIMAL(5,2),
    "contactId" TEXT,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentDownload" (
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentDownload_pkey" PRIMARY KEY ("companyId","tenderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkType_name_key" ON "WorkType"("name");

-- CreateIndex
CREATE INDEX "Tender_projectId_idx" ON "Tender"("projectId");

-- CreateIndex
CREATE INDEX "TenderDocument_tenderId_idx" ON "TenderDocument"("tenderId");

-- AddForeignKey
ALTER TABLE "WorkType" ADD CONSTRAINT "WorkType_responsibleContactId_fkey" FOREIGN KEY ("responsibleContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
