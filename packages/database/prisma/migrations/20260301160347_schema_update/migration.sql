/*
  Warnings:

  - You are about to drop the column `examId` on the `ProctoringLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ProctoringLog` table. All the data in the column will be lost.
  - You are about to drop the column `sampleInput` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `sampleOutput` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `testCases` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `stdOut` on the `Submission` table. All the data in the column will be lost.
  - Added the required column `attemptId` to the `ProctoringLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderIndex` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attemptId` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `language` on the `Submission` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "ProgrammingLanguage" AS ENUM ('C', 'CPP', 'JAVA', 'PYTHON3', 'JAVASCRIPT', 'TYPESCRIPT', 'GO', 'RUST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionStatus" ADD VALUE 'TIME_LIMIT_EXCEEDED';
ALTER TYPE "SubmissionStatus" ADD VALUE 'MEMORY_LIMIT_EXCEEDED';

-- AlterEnum
ALTER TYPE "ViolationType" ADD VALUE 'OTHER';

-- DropForeignKey
ALTER TABLE "ProctoringLog" DROP CONSTRAINT "ProctoringLog_examId_fkey";

-- DropForeignKey
ALTER TABLE "ProctoringLog" DROP CONSTRAINT "ProctoringLog_userId_fkey";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProctoringLog" DROP COLUMN "examId",
DROP COLUMN "userId",
ADD COLUMN     "attemptId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "sampleInput",
DROP COLUMN "sampleOutput",
DROP COLUMN "testCases",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "marks" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
ADD COLUMN     "memoryLimitKb" INTEGER NOT NULL DEFAULT 256000,
ADD COLUMN     "orderIndex" INTEGER NOT NULL,
ADD COLUMN     "timeLimitMs" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "stdOut",
ADD COLUMN     "attemptId" TEXT NOT NULL,
ADD COLUMN     "executionTimeMs" INTEGER,
ADD COLUMN     "memoryUsedKb" INTEGER,
ADD COLUMN     "totalCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "language",
ADD COLUMN     "language" "ProgrammingLanguage" NOT NULL;

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'ENROLLED',
    "score" DOUBLE PRECISION,
    "gradedAt" TIMESTAMP(3),
    "retakeNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionTestCaseResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "actualOutput" TEXT,
    "executionTimeMs" INTEGER,
    "memoryUsedKb" INTEGER,

    CONSTRAINT "SubmissionTestCaseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_userId_examId_retakeNumber_key" ON "ExamAttempt"("userId", "examId", "retakeNumber");

-- CreateIndex
CREATE INDEX "ProctoringLog_attemptId_idx" ON "ProctoringLog"("attemptId");

-- CreateIndex
CREATE INDEX "Submission_attemptId_questionId_idx" ON "Submission"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Submission_userId_questionId_idx" ON "Submission"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestCaseResult" ADD CONSTRAINT "SubmissionTestCaseResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestCaseResult" ADD CONSTRAINT "SubmissionTestCaseResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringLog" ADD CONSTRAINT "ProctoringLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
