CREATE TABLE "JudgeProfile" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JudgeProfile_isPublished_order_idx" ON "JudgeProfile"("isPublished", "order");
