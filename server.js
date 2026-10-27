require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

const DATABASE_URL = process.env.DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000
    })
  : null;

const DATA_FILE = path.join(__dirname, "applications.json");

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readLocalApplications() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Local data read error:", error.message);
    return [];
  }
}

function writeLocalApplications(applications) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(applications, null, 2),
    "utf8"
  );
}

function normalizeApplication(row) {
  const data =
    row && row.data && typeof row.data === "object"
      ? row.data
      : {};

  return {
    ...data,
    id: row.id ?? data.id,
    name: row.name ?? data.name ?? "",
    mobile: row.mobile ?? data.mobile ?? "",
    email: row.email ?? data.email ?? "",
    state: row.state ?? data.state ?? "",
    loan_type: row.loan_type ?? data.loan_type ?? "",
    loan_amount: row.loan_amount ?? data.loan_amount ?? "",
    monthly_income:
      row.monthly_income ?? data.monthly_income ?? "",
    status: data.status ?? "Pending",
    created_at: row.created_at ?? data.created_at ?? null
  };
}

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token || !ADMIN_SECRET_KEY) {
    return res.status(401).json({
      success: false,
      message: "Admin login required"
    });
  }

  const expected = crypto
    .createHmac("sha256", ADMIN_SECRET_KEY)
    .update("reliance-finance-admin")
    .digest("hex");

  const actualBuffer = Buffer.from(String(token));
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin token"
    });
  }

  next();
}

async function setupDatabase() {
  if (!pool) {
    console.log("DATABASE_URL missing; using local JSON storage.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.applications (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      name TEXT,
      mobile TEXT,
      email TEXT,
      state TEXT,
      loan_type TEXT,
      loan_amount TEXT,
      monthly_income TEXT,
      data JSONB
    )
  `);

  // Add missing columns without deleting existing records.
  await pool.query(`
    ALTER TABLE public.applications
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS mobile TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT,
      ADD COLUMN IF NOT EXISTS loan_type TEXT,
      ADD COLUMN IF NOT EXISTS loan_amount TEXT,
      ADD COLUMN IF NOT EXISTS monthly_income TEXT,
      ADD COLUMN IF NOT EXISTS data JSONB,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  `);

  console.log("Supabase PostgreSQL connection configured.");
  await pool.query("SELECT 1");
  console.log("Database connection successful.");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Admin login
app.post("/admin-login", (req, res) => {
  if (!ADMIN_PASSWORD || !ADMIN_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: "Set ADMIN_PASSWORD and ADMIN_SECRET_KEY in environment variables."
    });
  }

  const { username, password } = req.body || {};

  if (
    username !== ADMIN_USER_ID ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Wrong username or password"
    });
  }

  const token = crypto
    .createHmac("sha256", ADMIN_SECRET_KEY)
    .update("reliance-finance-admin")
    .digest("hex");

  res.json({
    success: true,
    token,
    message: "Login successful"
  });
});

// Submit a new loan application
app.post("/submit-application", async (req, res) => {
  try {
    const application = req.body || {};

    const name = String(application.name || "").trim();
    const mobile = String(application.mobile || "").trim();

    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required."
      });
    }

    const record = {
      ...application,
      name,
      mobile,
      email: String(application.email || application.gmail || "").trim(),
      state: String(application.state || "").trim(),
      loan_type: String(
        application.loan_type || application.loanType || ""
      ).trim(),
      loan_amount: String(
        application.loan_amount || application.loanAmount || ""
      ).trim(),
      monthly_income: String(
        application.monthly_income || application.monthlyIncome || ""
      ).trim(),
      status: "Pending",
      created_at: new Date().toISOString()
    };

    if (pool) {
      const result = await pool.query(
        `INSERT INTO public.applications
          (name, mobile, email, state, loan_type,
           loan_amount, monthly_income, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, created_at`,
        [
          record.name,
          record.mobile,
          record.email,
          record.state,
          record.loan_type,
          record.loan_amount,
          record.monthly_income,
          JSON.stringify(record)
        ]
      );

      return res.json({
        success: true,
        message: "Application submitted successfully.",
        id: result.rows[0].id
      });
    }

    const applications = readLocalApplications();
    record.id = Date.now();
    applications.push(record);
    writeLocalApplications(applications);

    return res.json({
      success: true,
      message: "Application submitted successfully.",
      id: record.id
    });
  } catch (error) {
    console.error("Application submission error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Application could not be saved. Please try again."
    });
  }
});

// Admin: get all applications
app.get("/applications", requireAdmin, async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query(
        "SELECT * FROM public.applications ORDER BY created_at DESC NULLS LAST, id DESC"
      );

      return res.json(result.rows.map(normalizeApplication));
    }

    return res.json(
      readLocalApplications().sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )
    );
  } catch (error) {
    console.error("Fetch applications error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not load applications."
    });
  }
});

// Check application status using mobile number
app.get("/check-application", async (req, res) => {
  try {
    const mobile = String(req.query.mobile || "").trim();

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required."
      });
    }

    if (pool) {
      const result = await pool.query(
        `SELECT * FROM public.applications
         WHERE mobile = $1
         ORDER BY created_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [mobile]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }

      return res.json({
        success: true,
        application: normalizeApplication(result.rows[0])
      });
    }

    const application = readLocalApplications()
      .filter(item => String(item.mobile) === mobile)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )[0];

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found."
      });
    }

    return res.json({ success: true, application });
  } catch (error) {
    console.error("Status check error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not check application status."
    });
  }
});

// Admin: update application status
app.post("/update-status", requireAdmin, async (req, res) => {
  try {
    const { id, mobile, status } = req.body || {};

    if (!id && !mobile) {
      return res.status(400).json({
        success: false,
        message: "Application id or mobile is required."
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required."
      });
    }

    if (pool) {
      const result = await pool.query(
        `UPDATE public.applications
         SET data = COALESCE(data, '{}'::jsonb)
                    || jsonb_build_object('status', $1::text)
         WHERE id = $2 OR ($2 IS NULL AND mobile = $3)
         RETURNING id`,
        [String(status), id || null, mobile || null]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }
    } else {
      const applications = readLocalApplications();
      const index = applications.findIndex(item =>
        id ? String(item.id) === String(id) :
        String(item.mobile) === String(mobile)
      );

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }

      applications[index].status = String(status);
      writeLocalApplications(applications);
    }

    res.json({ success: true, message: "Status updated." });
  } catch (error) {
    console.error("Update status error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update status."
    });
  }
});

// Admin: update charges
app.post("/update-charges", requireAdmin, async (req, res) => {
  try {
    const { id, mobile, charges } = req.body || {};

    if (!id && !mobile) {
      return res.status(400).json({
        success: false,
        message: "Application id or mobile is required."
      });
    }

    if (charges === undefined || charges === null) {
      return res.status(400).json({
        success: false,
        message: "Charges are required."
      });
    }

    if (pool) {
      const result = await pool.query(
        `UPDATE public.applications
         SET data = COALESCE(data, '{}'::jsonb)
                    || jsonb_build_object('charges', $1::text)
         WHERE id = $2 OR ($2 IS NULL AND mobile = $3)
         RETURNING id`,
        [String(charges), id || null, mobile || null]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }
    } else {
      const applications = readLocalApplications();
      const index = applications.findIndex(item =>
        id ? String(item.id) === String(id) :
        String(item.mobile) === String(mobile)
      );

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }

      applications[index].charges = String(charges);
      writeLocalApplications(applications);
    }

    res.json({ success: true, message: "Charges updated." });
  } catch (error) {
    console.error("Update charges error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update charges."
    });
  }
});

// Export applications as CSV for admin
app.get("/download-csv", requireAdmin, async (req, res) => {
  try {
    let applications;

    if (pool) {
      const result = await pool.query(
        "SELECT * FROM public.applications ORDER BY created_at DESC NULLS LAST, id DESC"
      );
      applications = result.rows.map(normalizeApplication);
    } else {
      applications = readLocalApplications();
    }

    const columns = [
      "id", "name", "mobile", "email", "state",
      "loan_type", "loan_amount", "monthly_income",
      "status", "charges", "created_at"
    ];

    const escapeCsv = value => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };

    const csv = [
      columns.join(","),
      ...applications.map(item =>
        columns.map(column => escapeCsv(item[column])).join(",")
      )
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reliance-finance-applications.csv"'
    );
    res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("CSV export error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not export applications."
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    databaseConfigured: Boolean(pool)
  });
});

async function startServer() {
  try {
    await setupDatabase();
  } catch (error) {
    console.error("DATABASE SETUP FAILED:", error.message);
    console.error(
      "Check DATABASE_URL, database credentials, and table schema."
    );
  }

  app.listen(PORT, () => {
    console.log(Reliance Finance server running on port ${PORT});
  });
}

startServer();
