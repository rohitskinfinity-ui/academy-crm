/**
 * OpenAPI 3 spec for Academy LMS admin APIs.
 * NestJS equivalent: DocumentBuilder + SwaggerModule.setup('api', ...)
 */
export function getOpenApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Academy API",
      description: "LMS Backend API — admin panel endpoints",
      version: "1.0",
    },
    servers: [{ url: "/", description: "Current host" }],
    tags: [
      { name: "Auth", description: "Admin login and session" },
      { name: "Users", description: "User management" },
      { name: "Treatments", description: "Treatment library" },
      { name: "Courses", description: "Course catalog" },
      { name: "Enrollments", description: "Student enrollments" },
      { name: "Campuses", description: "Campuses and batches" },
      { name: "Public", description: "Public marketing / user-web APIs" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT from POST /api/admin/auth/login. Also accepts x-access-token header.",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {},
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: {},
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        CreateAdminRequest: {
          type: "object",
          required: ["email", "password", "full_name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            full_name: { type: "string" },
            display_name: { type: "string", nullable: true },
            role: { type: "string", enum: ["admin", "staff"], default: "staff" },
          },
        },
        PatchUserRequest: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            display_name: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            role: {
              type: "string",
              enum: ["student", "instructor", "admin", "staff"],
            },
            is_active: { type: "boolean" },
            email: { type: "string", format: "email" },
          },
        },
        CreateTreatmentRequest: {
          type: "object",
          required: ["slug", "name"],
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            summary: { type: "string", nullable: true },
            image_url: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["draft", "published", "archived"],
              default: "draft",
            },
            sort_order: { type: "integer", default: 0 },
            base_price: { type: "number", nullable: true },
            currency: { type: "string", default: "INR" },
          },
        },
        UpsertStageRequest: {
          type: "object",
          required: ["stage", "title"],
          properties: {
            stage: {
              type: "string",
              enum: ["theory", "observation", "training", "hands-on"],
            },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            checklist: { type: "array", items: { type: "string" } },
            sort_order: { type: "integer", default: 0 },
          },
        },
        CreateVideoRequest: {
          type: "object",
          required: ["title"],
          properties: {
            stage: {
              type: "string",
              enum: ["theory", "observation", "training", "hands-on"],
              default: "theory",
            },
            title: { type: "string" },
            kind: {
              type: "string",
              enum: ["lecture", "ai_procedure", "clinical"],
              default: "lecture",
            },
            duration_seconds: { type: "integer", nullable: true },
            video_url: { type: "string", nullable: true },
            thumbnail_url: { type: "string", nullable: true },
            instructor_id: { type: "string", format: "uuid", nullable: true },
            sort_order: { type: "integer", default: 0 },
            is_published: { type: "boolean", default: true },
          },
        },
        CreateBookletRequest: {
          type: "object",
          required: ["name"],
          properties: {
            stage: {
              type: "string",
              enum: ["theory", "observation", "training", "hands-on"],
              default: "theory",
            },
            name: { type: "string" },
            file_url: { type: "string", nullable: true },
            drive_url: { type: "string", nullable: true },
            size_bytes: { type: "integer", nullable: true },
            mime_type: { type: "string", nullable: true },
            sort_order: { type: "integer", default: 0 },
          },
        },
        UpsertQuizRequest: {
          type: "object",
          properties: {
            title: { type: "string", default: "Theory quiz" },
            pass_percent: { type: "number", default: 66 },
            is_required: { type: "boolean", default: true },
          },
        },
        CreateQuestionRequest: {
          type: "object",
          required: ["prompt", "options", "correct_index"],
          properties: {
            prompt: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 2 },
            correct_index: { type: "integer", minimum: 0 },
            explanation: { type: "string", nullable: true },
            sort_order: { type: "integer", default: 0 },
          },
        },
        CreateCategoryRequest: {
          type: "object",
          required: ["slug", "title"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            icon: { type: "string", nullable: true },
            sort_order: { type: "integer", default: 0 },
          },
        },
        CreateCourseRequest: {
          type: "object",
          required: ["slug", "title"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            image_url: { type: "string", nullable: true },
            duration_label: { type: "string", nullable: true },
            mode: {
              type: "string",
              enum: ["online", "offline", "hybrid"],
              nullable: true,
            },
            level: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              nullable: true,
            },
            category_id: { type: "string", format: "uuid", nullable: true },
            list_price: { type: "number", nullable: true },
            currency: { type: "string", default: "INR" },
            status: {
              type: "string",
              enum: ["draft", "published", "archived"],
              default: "draft",
            },
            is_bestseller: { type: "boolean", default: false },
            is_customizable: { type: "boolean", default: true },
          },
        },
        SetCourseTreatmentsRequest: {
          type: "object",
          required: ["treatments"],
          properties: {
            treatments: {
              type: "array",
              items: {
                type: "object",
                required: ["treatment_id"],
                properties: {
                  treatment_id: { type: "string", format: "uuid" },
                  sort_order: { type: "integer", default: 0 },
                  hands_on_default: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        CreateCampusRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            city: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            is_active: { type: "boolean", default: true },
          },
        },
        CreateBatchRequest: {
          type: "object",
          required: ["name"],
          properties: {
            course_id: { type: "string", format: "uuid", nullable: true },
            campus_id: { type: "string", format: "uuid", nullable: true },
            name: { type: "string" },
            starts_on: { type: "string", nullable: true },
            ends_on: { type: "string", nullable: true },
            training_mode: {
              type: "string",
              enum: ["online", "offline", "hybrid"],
              nullable: true,
            },
            seats_total: { type: "integer", nullable: true },
            seats_left: { type: "integer", nullable: true },
            is_active: { type: "boolean", default: true },
          },
        },
        CreateEnrollmentRequest: {
          type: "object",
          required: ["user_id", "title"],
          properties: {
            user_id: { type: "string", format: "uuid" },
            course_id: { type: "string", format: "uuid", nullable: true },
            title: { type: "string" },
            origin: {
              type: "string",
              enum: ["catalog", "custom"],
              default: "catalog",
            },
            status: {
              type: "string",
              enum: ["active", "completed", "cancelled", "suspended"],
              default: "active",
            },
            agreed_price: { type: "number", nullable: true },
            currency: { type: "string", default: "INR" },
            batch_id: { type: "string", format: "uuid", nullable: true },
            campus_id: { type: "string", format: "uuid", nullable: true },
            notes_internal: { type: "string", nullable: true },
            treatments: {
              type: "array",
              items: {
                type: "object",
                required: ["treatment_id"],
                properties: {
                  treatment_id: { type: "string", format: "uuid" },
                  sort_order: { type: "integer", default: 0 },
                  hands_on_included: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        PatchEnrollmentRequest: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: {
              type: "string",
              enum: ["active", "completed", "cancelled", "suspended"],
            },
            agreed_price: { type: "number", nullable: true },
            currency: { type: "string" },
            batch_id: { type: "string", format: "uuid", nullable: true },
            campus_id: { type: "string", format: "uuid", nullable: true },
            notes_internal: { type: "string", nullable: true },
          },
        },
        SetEnrollmentTreatmentsRequest: {
          type: "object",
          required: ["treatments"],
          properties: {
            treatments: {
              type: "array",
              items: {
                type: "object",
                required: ["treatment_id"],
                properties: {
                  treatment_id: { type: "string", format: "uuid" },
                  sort_order: { type: "integer", default: 0 },
                  hands_on_included: { type: "boolean", default: true },
                },
              },
            },
            agreed_price: { type: "number", nullable: true },
          },
        },
      },
    },
    paths: {
      "/api/admin/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Admin login",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JWT + admin profile",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccess" },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
          },
        },
      },
      "/api/admin/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout (client discards token)",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Logged out" },
          },
        },
      },
      "/api/admin/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current admin profile",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Admin profile" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/admin/auth/admins": {
        get: {
          tags: ["Auth"],
          summary: "List admins and staff",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Auth"],
          summary: "Create admin/staff (admin role only)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateAdminRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/admin/users": {
        get: {
          tags: ["Users"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "role",
              in: "query",
              schema: {
                type: "string",
                enum: ["student", "instructor", "admin", "staff"],
              },
            },
            { name: "search", in: "query", schema: { type: "string" } },
            {
              name: "is_active",
              in: "query",
              schema: { type: "string", enum: ["true", "false"] },
            },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: { "200": { description: "Paginated users" } },
        },
      },
      "/api/admin/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Get user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "OK" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["Users"],
          summary: "Update user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PatchUserRequest" },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Users"],
          summary: "Soft-delete user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/treatments": {
        get: {
          tags: ["Treatments"],
          summary: "List treatments",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["draft", "published", "archived"],
              },
            },
            { name: "search", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Treatments"],
          summary: "Create treatment",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTreatmentRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/treatments/{id}": {
        get: {
          tags: ["Treatments"],
          summary: "Get treatment with nested content",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        patch: {
          tags: ["Treatments"],
          summary: "Update treatment",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTreatmentRequest" },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Treatments"],
          summary: "Soft-delete treatment",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/treatments/{id}/stages": {
        get: {
          tags: ["Treatments"],
          summary: "List stages",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        put: {
          tags: ["Treatments"],
          summary: "Upsert stage",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertStageRequest" },
              },
            },
          },
          responses: { "200": { description: "Saved" } },
        },
      },
      "/api/admin/treatments/{id}/videos": {
        get: {
          tags: ["Treatments"],
          summary: "List videos",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Treatments"],
          summary: "Add video",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateVideoRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/treatments/{id}/videos/{videoId}": {
        patch: {
          tags: ["Treatments"],
          summary: "Update video",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "videoId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Treatments"],
          summary: "Soft-delete video",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "videoId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/treatments/{id}/booklets": {
        get: {
          tags: ["Treatments"],
          summary: "List booklets",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Treatments"],
          summary: "Add booklet",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateBookletRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/treatments/{id}/booklets/{bookletId}": {
        patch: {
          tags: ["Treatments"],
          summary: "Update booklet",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "bookletId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Treatments"],
          summary: "Soft-delete booklet",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "bookletId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/treatments/{id}/quizzes": {
        get: {
          tags: ["Treatments"],
          summary: "Get quiz + questions",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        put: {
          tags: ["Treatments"],
          summary: "Upsert quiz",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertQuizRequest" },
              },
            },
          },
          responses: { "200": { description: "Saved" } },
        },
      },
      "/api/admin/treatments/{id}/quizzes/questions": {
        post: {
          tags: ["Treatments"],
          summary: "Add quiz question",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateQuestionRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/treatments/{id}/quizzes/questions/{questionId}": {
        patch: {
          tags: ["Treatments"],
          summary: "Update question",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "questionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Treatments"],
          summary: "Delete question",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "questionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/course-categories": {
        get: {
          tags: ["Courses"],
          summary: "List course categories",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Courses"],
          summary: "Create category",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCategoryRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/course-categories/{id}": {
        patch: {
          tags: ["Courses"],
          summary: "Update category",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Courses"],
          summary: "Delete category",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/courses": {
        get: {
          tags: ["Courses"],
          summary: "List courses",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["draft", "published", "archived"],
              },
            },
            {
              name: "category_id",
              in: "query",
              schema: { type: "string", format: "uuid" },
            },
            { name: "search", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Courses"],
          summary: "Create course",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCourseRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/courses/{id}": {
        get: {
          tags: ["Courses"],
          summary: "Get course + treatments",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        patch: {
          tags: ["Courses"],
          summary: "Update course",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Courses"],
          summary: "Soft-delete course",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/courses/{id}/treatments": {
        put: {
          tags: ["Courses"],
          summary: "Replace course treatments",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SetCourseTreatmentsRequest",
                },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/admin/campuses": {
        get: {
          tags: ["Campuses"],
          summary: "List campuses",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Campuses"],
          summary: "Create campus",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCampusRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/batches": {
        get: {
          tags: ["Campuses"],
          summary: "List batches",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "course_id",
              in: "query",
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Campuses"],
          summary: "Create batch",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateBatchRequest" },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/batches/{id}": {
        patch: {
          tags: ["Campuses"],
          summary: "Update batch",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/public/calendar": {
        get: {
          tags: ["Public"],
          summary: "List upcoming and ongoing courses for the public calendar",
          parameters: [
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["upcoming", "ongoing", "all"],
                default: "all",
              },
            },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "from", in: "query", schema: { type: "string" } },
            { name: "to", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50 },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/admin/enrollments": {
        get: {
          tags: ["Enrollments"],
          summary: "List enrollments",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "user_id",
              in: "query",
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "course_id",
              in: "query",
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["active", "completed", "cancelled", "suspended"],
              },
            },
            { name: "search", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Enrollments"],
          summary: "Create enrollment",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateEnrollmentRequest",
                },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/admin/enrollments/{id}": {
        get: {
          tags: ["Enrollments"],
          summary: "Get enrollment detail",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        patch: {
          tags: ["Enrollments"],
          summary: "Update enrollment",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PatchEnrollmentRequest" },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Enrollments"],
          summary: "Soft-delete enrollment",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/admin/enrollments/{id}/treatments": {
        put: {
          tags: ["Enrollments"],
          summary: "Replace enrollment treatments / price",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SetEnrollmentTreatmentsRequest",
                },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/admin/enrollments/{id}/treatments/{treatmentId}": {
        patch: {
          tags: ["Enrollments"],
          summary: "Patch one enrollment treatment",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "treatmentId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "enrollment_treatments.id",
            },
          ],
          responses: { "200": { description: "Updated" } },
        },
      },
    },
  } as const;
}
