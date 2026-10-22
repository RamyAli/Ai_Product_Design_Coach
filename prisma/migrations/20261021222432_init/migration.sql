-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "market" TEXT,
    "platform" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "briefJson" TEXT NOT NULL,
    "briefVersion" INTEGER NOT NULL DEFAULT 1,
    "currentStageId" TEXT,
    "practiceMode" BOOLEAN NOT NULL DEFAULT false,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "generationSource" TEXT NOT NULL DEFAULT 'manual',
    "generationModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "lastOpenedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ProjectBriefVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "briefJson" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectBriefVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "passThreshold" INTEGER NOT NULL DEFAULT 80,
    "weightConfigJson" TEXT NOT NULL,
    "acceptanceCriteriaJson" TEXT NOT NULL,
    "deliverablesJson" TEXT NOT NULL,
    "customizationJson" TEXT,
    "revalidationReason" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "taskKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "taskType" TEXT NOT NULL DEFAULT 'canonical',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL,
    "acceptanceCriteriaJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "versionNumber" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "textContent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "basedOnId" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedFilename" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "sha256" TEXT,
    "storagePath" TEXT,
    "thumbnailPath" TEXT,
    "analysisPath" TEXT,
    "sourceUrl" TEXT,
    "extractionStatus" TEXT NOT NULL DEFAULT 'uploaded',
    "extractionError" TEXT,
    "extractedText" TEXT,
    "extractionMetadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubmissionAsset_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "promptVersion" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewJson" TEXT NOT NULL,
    "comparisonJson" TEXT,
    "previousReviewId" TEXT,
    "usageJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RevisionTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "taskId" TEXT,
    "reviewTaskKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "suggestedAction" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL,
    "criterionId" TEXT,
    "theme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RevisionTask_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RevisionTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "reviewId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachMessage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachMessage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "outlineJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseStudy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "projectId" TEXT,
    "stageId" TEXT,
    "submissionId" TEXT,
    "inputJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "usageJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBriefVersion_projectId_versionNumber_key" ON "ProjectBriefVersion"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "Stage_projectId_orderIndex_idx" ON "Stage"("projectId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_projectId_stageKey_key" ON "Stage"("projectId", "stageKey");

-- CreateIndex
CREATE INDEX "Task_stageId_orderIndex_idx" ON "Task"("stageId", "orderIndex");

-- CreateIndex
CREATE INDEX "Submission_stageId_status_idx" ON "Submission"("stageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_stageId_versionNumber_key" ON "Submission"("stageId", "versionNumber");

-- CreateIndex
CREATE INDEX "SubmissionAsset_submissionId_idx" ON "SubmissionAsset"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionAsset_storagePath_idx" ON "SubmissionAsset"("storagePath");

-- CreateIndex
CREATE INDEX "Review_stageId_createdAt_idx" ON "Review"("stageId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_projectId_createdAt_idx" ON "Review"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RevisionTask_reviewId_idx" ON "RevisionTask"("reviewId");

-- CreateIndex
CREATE INDEX "RevisionTask_stageId_status_idx" ON "RevisionTask"("stageId", "status");

-- CreateIndex
CREATE INDEX "CoachMessage_projectId_stageId_createdAt_idx" ON "CoachMessage"("projectId", "stageId", "createdAt");

-- CreateIndex
CREATE INDEX "CoachMessage_reviewId_createdAt_idx" ON "CoachMessage"("reviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_projectId_key" ON "CaseStudy"("projectId");

-- CreateIndex
CREATE INDEX "AiJob_status_createdAt_idx" ON "AiJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_projectId_type_createdAt_idx" ON "AiJob"("projectId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_submissionId_idx" ON "AiJob"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BackupRecord_filename_key" ON "BackupRecord"("filename");
