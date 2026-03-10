import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import prisma from "@repo/database";
import bcrypt from "bcryptjs";
import {
  UserSchema,
  ExamSchema,
  DepartmentSchema,
  BatchSchema,
  AdminUpdateUserSchema,
  QuestionSchema,
  UpdateQuestionSchema,
  TestCaseSchema,
  UpdateTestCaseSchema,
} from "@common/types";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware/auth.ts";

const app: Express = express();
const PORT = process.env.PORT ?? 4000;

// ─── Global Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.get(
  "/api/users",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        omit: { password: true },
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/signup", async (_req: Request, res: Response) => {
  const result = UserSchema.safeParse(_req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const { email, password, name } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
      omit: { password: true },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/signin", async (_req: Request, res: Response) => {
  const { email, password } = _req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Signin failed" });
  }
});

app.get("/api/me", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

app.post(
  "/api/admin/departments",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = DepartmentSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { name, code, isActive } = result.data;

    try {
      const department = await prisma.department.create({
        data: { name, code, isActive },
      });
      return res.status(201).json(department);
    } catch (error: any) {
      if (error.code === "P2002") {
        const field = error.meta?.target?.includes("code") ? "code" : "name";
        return res
          .status(409)
          .json({ error: `A department with that ${field} already exists` });
      }
      return res.status(500).json({ error: "Failed to create department" });
    }
  },
);

app.get(
  "/api/admin/departments",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const departments = await prisma.department.findMany({
        include: {
          _count: { select: { batches: true, users: true } },
        },
        orderBy: { name: "asc" },
      });
      return res.json(departments);
    } catch (error) {
      return res.status(500).json({ error: "Failed to get departments" });
    }
  },
);

app.post(
  "/api/admin/batches",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = BatchSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { departmentId, yearOfStudy, intakeYear, label, isActive } =
      result.data;

    try {
      // Verify the department exists before creating the batch
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      const batch = await prisma.batch.create({
        data: { departmentId, yearOfStudy, intakeYear, label, isActive },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });
      return res.status(201).json(batch);
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error:
            "A batch for this department, year of study, and intake year already exists",
        });
      }
      return res.status(500).json({ error: "Failed to create batch" });
    }
  },
);

app.get(
  "/api/admin/batches",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Optional ?departmentId= filter
    const { departmentId } = _req.query;

    try {
      const batches = await prisma.batch.findMany({
        where: departmentId
          ? { departmentId: String(departmentId) }
          : undefined,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { users: true } },
        },
        orderBy: [{ intakeYear: "desc" }, { yearOfStudy: "asc" }],
      });
      return res.json(batches);
    } catch (error) {
      return res.status(500).json({ error: "Failed to get batches" });
    }
  },
);

app.patch(
  "/api/admin/users/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // 1. ADMIN only
    const admin = await prisma.user.findUnique({ where: { id: _req.userId! } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Validate body
    const result = AdminUpdateUserSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { role, departmentId, batchId, rollNumber } = result.data;

    // 3. Target user must exist
    const targetUser = await prisma.user.findUnique({
      where: { id: _req.params.id },
    });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    try {
      // 4. If a departmentId is being set, verify it exists
      if (departmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: departmentId },
        });
        if (!dept) {
          return res.status(404).json({ error: "Department not found" });
        }
      }

      // 5. If a batchId is being set, verify it exists AND belongs to the
      //    departmentId that will be in effect after this update
      if (batchId) {
        const batch = await prisma.batch.findUnique({
          where: { id: batchId },
        });
        if (!batch) {
          return res.status(404).json({ error: "Batch not found" });
        }

        const effectiveDeptId = departmentId ?? targetUser.departmentId;
        if (batch.departmentId !== effectiveDeptId) {
          return res.status(400).json({
            error: "Batch does not belong to the specified department",
          });
        }
      }

      // 6. Build the update payload — only include fields that were sent
      //    (undefined = omit from update, null = explicitly clear the field)
      const data: Record<string, unknown> = {};
      if (role !== undefined) data.role = role;
      if (departmentId !== undefined) data.departmentId = departmentId ?? null;
      if (batchId !== undefined) data.batchId = batchId ?? null;
      if (rollNumber !== undefined) data.rollNumber = rollNumber ?? null;

      // 7. If role is changing to FACULTY/ADMIN, clear student-only fields
      if (role === "FACULTY" || role === "ADMIN") {
        data.departmentId = null;
        data.batchId = null;
        data.rollNumber = null;
      }

      const updatedUser = await prisma.user.update({
        where: { id: _req.params.id },
        data,
        omit: { password: true },
        include: {
          department: { select: { id: true, name: true, code: true } },
          batch: {
            select: {
              id: true,
              label: true,
              yearOfStudy: true,
              intakeYear: true,
            },
          },
        },
      });

      return res.json(updatedUser);
    } catch (error: any) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json({ error: "A user with that roll number already exists" });
      }
      return res.status(500).json({ error: "Failed to update user" });
    }
  },
);

app.post(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // 1. FACULTY only
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can add questions" });
    }

    // 2. Validate body
    const result = QuestionSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const {
      title,
      description,
      marks,
      timeLimitMs,
      memoryLimitKb,
      orderIndex,
    } = result.data;

    try {
      // 3. Exam must exist, not be soft-deleted, and belong to this faculty
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      // 4. Cannot add questions to an already-active (live) exam
      if (exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot add questions to an active exam" });
      }

      // 5. Auto-calculate orderIndex if not provided —
      //    count non-deleted questions already on this exam and place at the end
      const resolvedOrderIndex =
        orderIndex ??
        (await prisma.question.count({
          where: { examId: exam.id, deletedAt: null },
        })) + 1;

      const question = await prisma.question.create({
        data: {
          examId: exam.id,
          title,
          description,
          marks,
          timeLimitMs,
          memoryLimitKb,
          orderIndex: resolvedOrderIndex,
        },
      });

      return res.status(201).json(question);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add question" });
    }
  },
);

app.post(
  "/api/createExam",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // 1. Validate input
    const result = ExamSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const {
      title,
      description,
      startTime,
      endTime,
      durationMin,
      isActive,
      accessCode,
    } = result.data;

    try {
      // 2. Verify the authenticated user is FACULTY
      const creator = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });

      if (!creator || creator.role !== "FACULTY") {
        return res
          .status(403)
          .json({ error: "Only faculty members can create exams" });
      }

      // 3. Create the exam with all fields
      const exam = await prisma.exam.create({
        data: {
          title,
          description,
          startTime,
          endTime,
          durationMin,
          isActive,
          accessCode,
          creatorId: _req.userId!,
        },
      });

      res.status(201).json(exam);
    } catch (error) {
      res.status(500).json({ error: "Failed to create exam" });
    }
  },
);

app.get(
  "/api/getExams",
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: _req.userId! },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // ── FACULTY: exams they created ──────────────────────────────────────
      if (user.role === "FACULTY") {
        const exams = await prisma.exam.findMany({
          where: {
            creatorId: user.id,
            deletedAt: null,
          },
          include: {
            _count: { select: { questions: true, attempts: true } },
          },
          orderBy: { startTime: "desc" },
        });
        return res.json(exams);
      }

      // ── ADMIN: every exam ────────────────────────────────────────────────
      if (user.role === "ADMIN") {
        const exams = await prisma.exam.findMany({
          where: { deletedAt: null },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            _count: { select: { questions: true, attempts: true } },
          },
          orderBy: { startTime: "desc" },
        });
        return res.json(exams);
      }

      // ── STUDENT: exams their batch or department is eligible for ─────────
      //
      // ExamEligibility rows are OR-ed: the student qualifies for an exam
      // when AT LEAST ONE eligibility row matches their batchId or departmentId.
      if (!user.batchId && !user.departmentId) {
        return res.json([]);
      }

      const eligibilityFilter = [];
      if (user.batchId) eligibilityFilter.push({ batchId: user.batchId });
      if (user.departmentId)
        eligibilityFilter.push({ departmentId: user.departmentId });

      const exams = await prisma.exam.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          eligibilities: {
            some: { OR: eligibilityFilter },
          },
        },
        include: {
          _count: { select: { questions: true } },
          // Attach this student's most-recent attempt so the UI can show status
          attempts: {
            where: { userId: user.id },
            orderBy: { retakeNumber: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              score: true,
              startedAt: true,
              completedAt: true,
              retakeNumber: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });

      return res.json(exams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exams" });
    }
  },
);

// Exam Eligibility

app.get("/api/exams/:id", async (_req: Request, res: Response) => {
  const { id } = _req.params;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        questions: true,
      },
    });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }
    return res.json(exam);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch exam" });
  }
});

app.patch(
  "/api/exams/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;
    const { title, description, startTime, endTime, questions } = _req.body;
    try {
      const updatedExam = await prisma.exam.update({
        where: { id },
        data: { title, description, startTime, endTime, questions },
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          questions: true,
        },
      });
      if (!updatedExam) {
        return res.status(404).json({ error: "Exam not found" });
      }
      return res.json(updatedExam);
    } catch (error) {
      res.status(500).json({ error: "Failed to update exam" });
    }
  },
);

app.delete(
  "/api/exams/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;
    try {
      await prisma.exam.delete({
        where: { id },
      });
      return res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete exam" });
    }
  },
);

app.post(
  "/api/exams/:id/eligibility",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const { id } = _req.params;
    const {} = _req.body;
  },
);

// ─── Questions & Test Cases ──────────────────────────────────────────────────

app.get(
  "/api/exams/:id/questions",
  authMiddleware,
  async (_req: Request, res: Response) => {
    // FACULTY only
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can view questions" });
    }

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: _req.params.id },
      });

      if (!exam || exam.deletedAt !== null) {
        return res.status(404).json({ error: "Exam not found" });
      }

      if (exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      const questions = await prisma.question.findMany({
        where: { examId: exam.id, deletedAt: null },
        include: {
          testCases: {
            orderBy: { id: "asc" },
          },
          _count: { select: { submissions: true } },
        },
        orderBy: { orderIndex: "asc" },
      });

      return res.json(questions);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch questions" });
    }
  },
);

app.patch(
  "/api/questions/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can update questions" });
    }

    const result = UpdateQuestionSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot update questions on an active exam" });
      }

      const {
        title,
        description,
        marks,
        timeLimitMs,
        memoryLimitKb,
        orderIndex,
      } = result.data;

      // Only include fields that were actually sent
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (marks !== undefined) data.marks = marks;
      if (timeLimitMs !== undefined) data.timeLimitMs = timeLimitMs;
      if (memoryLimitKb !== undefined) data.memoryLimitKb = memoryLimitKb;
      if (orderIndex !== undefined) data.orderIndex = orderIndex;

      const updated = await prisma.question.update({
        where: { id: _req.params.id },
        data,
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update question" });
    }
  },
);

app.delete(
  "/api/questions/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can delete questions" });
    }

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot delete questions from an active exam" });
      }

      await prisma.question.update({
        where: { id: _req.params.id },
        data: { deletedAt: new Date() },
      });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete question" });
    }
  },
);

app.post(
  "/api/questions/:id/testcases",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can add test cases" });
    }

    const result = TestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    const { input, expectedOutput, isHidden, weight } = result.data;

    try {
      const question = await prisma.question.findUnique({
        where: { id: _req.params.id },
        include: { exam: true },
      });

      if (!question || question.deletedAt !== null) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (question.exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot add test cases to an active exam" });
      }

      const testCase = await prisma.testCase.create({
        data: {
          questionId: question.id,
          input,
          expectedOutput,
          isHidden,
          weight,
        },
      });

      return res.status(201).json(testCase);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add test case" });
    }
  },
);

app.patch(
  "/api/testcases/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can update test cases" });
    }

    const result = UpdateTestCaseSchema.safeParse(_req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ errors: result.error.flatten().fieldErrors });
    }

    try {
      // Traverse testCase → question → exam to verify ownership
      const testCase = await prisma.testCase.findUnique({
        where: { id: _req.params.id },
        include: { question: { include: { exam: true } } },
      });

      if (!testCase) {
        return res.status(404).json({ error: "Test case not found" });
      }

      if (testCase.question.deletedAt !== null) {
        return res.status(404).json({ error: "Question has been deleted" });
      }

      if (testCase.question.exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (testCase.question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot update test cases on an active exam" });
      }

      const { input, expectedOutput, isHidden, weight } = result.data;

      const data: Record<string, unknown> = {};
      if (input !== undefined) data.input = input;
      if (expectedOutput !== undefined) data.expectedOutput = expectedOutput;
      if (isHidden !== undefined) data.isHidden = isHidden;
      if (weight !== undefined) data.weight = weight;

      const updated = await prisma.testCase.update({
        where: { id: _req.params.id },
        data,
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update test case" });
    }
  },
);

app.delete(
  "/api/testcases/:id",
  authMiddleware,
  async (_req: Request, res: Response) => {
    const faculty = await prisma.user.findUnique({
      where: { id: _req.userId! },
    });
    if (!faculty || faculty.role !== "FACULTY") {
      return res
        .status(403)
        .json({ error: "Only faculty members can delete test cases" });
    }

    try {
      // Traverse testCase → question → exam to verify ownership
      const testCase = await prisma.testCase.findUnique({
        where: { id: _req.params.id },
        include: { question: { include: { exam: true } } },
      });

      if (!testCase) {
        return res.status(404).json({ error: "Test case not found" });
      }

      if (testCase.question.deletedAt !== null) {
        return res.status(404).json({ error: "Question has been deleted" });
      }

      if (testCase.question.exam.creatorId !== faculty.id) {
        return res
          .status(403)
          .json({ error: "You are not the creator of this exam" });
      }

      if (testCase.question.exam.isActive) {
        return res
          .status(400)
          .json({ error: "Cannot delete test cases from an active exam" });
      }

      // TestCase has no deletedAt — hard delete
      await prisma.testCase.delete({ where: { id: _req.params.id } });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete test case" });
    }
  },
);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Server running at http://localhost:${PORT}`);
});

export default app;
