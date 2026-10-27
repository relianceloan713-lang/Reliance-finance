require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL;

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000
    })
  : null;

const APPLICATIONS_FILE = path.join(__dirname, "applications.json");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

if (!fs.existsSync(APPLICATIONS_FILE)) {
  fs.writeFileSync(APPLICATIONS_FILE, "[]", "utf8");
}

// -------------------- Helpers --------------------

function readApplications() {
  try {
    const result = JSON.parse(
      fs.readFileSync(APPLICATIONS_FILE, "utf8")
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("JSON read error:", error.message);
    return [];
  }
}

function writeApplications(items) {
  fs.writeFileSync(
    APPLICATIONS_FILE,
    JSON.stringify(items, null, 2),
    "utf8"
  );
}

function getApplication(body) {
  const source =
    body && body.application && typeof body.application === "object"
      ? body.application
      : body || {};

  return {
    ...source,
    name: String(source.name || "").trim(),
    mobile: String(source.mobile || "").trim(),
    email: String(source.email || source.gmail || "").trim(),
    state: String(source.state || "").trim(),
    loan_type: String(
      source.loan_type || source.loanType || source.loan_type_name || ""
    ).trim(),
    loan_amount: source.loan_amount ?? source.loanAmount ?? null,
    monthly_income: source.monthly_income ?? source.monthlyIncome ?? null
  };
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

function normalizeRow(row) {
  const data =
    row.data && typeof row.data === "object" ? row.data : {};

  return {
    ...data,
    id: row.id ?? data.id,
    name: row.name ?? data.name ?? "",
    mobile: row.mobile ?? data.mobile ?? "",
    email: row.email ?? data.email ?? data.gmail ?? "",
    state: row.state ?? data.state ?? "",
    loan_type: row.loan_type ?? data.loan_type ?? data.loanType ?? "",
    loan_amount: row.loan_amount ?? data.loan_amount ?? data.loanAmount ?? "",
    monthly_income:
      row.monthly_income ?? data.monthly_income ?? data.monthlyIncome ?? "",
    status: data.status || "Pending",
    created_at: row.created_at ?? data.created_at ?? null
  };
}

function makeAdminToken() {
  return crypto
    .createHmac("sha256", ADMIN_SECRET_KEY)
    .update("reliance-finance-admin")
    .digest("hex");
}

function requireAdmin(req, res, next) {
  if (!ADMIN_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: "ADMIN_SECRET_KEY is not configured."
    });
  }

  const cookieHeader = req.headers.cookie || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);

  let cookieToken = "";

  if (cookieMatch) {
    try {
      cookieToken = decodeURIComponent(cookieMatch[1]);
    } catch (_) {
      cookieToken = "";
    }
  }

  const suppliedToken =
    req.headers["x-admin-token"] || cookieToken;

  const expectedToken = makeAdminToken();

  if (
    typeof suppliedToken !== "string" ||
    suppliedToken.length !== expectedToken.length
  ) {
    return res.status(401).json({
      success: false,
      message: "Please login as admin."
    });
  }

  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);

  if (!crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin login."
    });
  }

  next();
}

// -------------------- Database setup --------------------

async function setupDatabase() {
  if (!pool) {
    console.log("DATABASE_URL missing. Using local JSON storage.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.applications (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      state TEXT,
      loan_type TEXT,
      loan_amount NUMERIC,
      monthly_income NUMERIC,
      data JSONB
    )
  `);

  // Add missing columns without deleting existing records.
  await pool.query(`
    ALTER TABLE public.applications
      ADD COLUMN IF NOT EXISTS data JSONB,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT,
      ADD COLUMN IF NOT EXISTS loan_type TEXT,
      ADD COLUMN IF NOT EXISTS loan_amount NUMERIC,
      ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
        DEFAULT CURRENT_TIMESTAMP
  `);

  // Existing records may already have their details inside JSON.
  // Fill empty structured columns from JSON when possible.
  await pool.query(`
    UPDATE public.applications
    SET
      mobile = COALESCE(NULLIF(mobile, ''), data->>'mobile'),
      email = COALESCE(NULLIF(email, ''), data->>'email', data->>'gmail'),
      state = COALESCE(NULLIF(state, ''), data->>'state'),
      loan_type = COALESCE(
        NULLIF(loan_type, ''),
        data->>'loan_type',
        data->>'loanType'
      ),
      loan_amount = COALESCE(
        loan_amount,
        CASE
          WHEN NULLIF(data->>'loan_amount', '') ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN (data->>'loan_amount')::numeric
          WHEN NULLIF(data->>'loanAmount', '') ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN (data->>'loanAmount')::numeric
          ELSE NULL
        END
      ),
      monthly_income = COALESCE(
        monthly_income,
        CASE
          WHEN NULLIF(data->>'monthly_income', '') ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN (data->>'monthly_income')::numeric
          WHEN NULLIF(data->>'monthlyIncome', '') ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN (data->>'monthlyIncome')::numeric
          ELSE NULL
        END
      )
  `);

  // Some old rows may have their name only inside the JSON.
  await pool.query(`
    UPDATE public.applications
    SET name = COALESCE(NULLIF(name, ''), data->>'name', 'Unknown')
    WHERE name IS NULL OR name = ''
  `);

  // The table may have a NOT NULL name constraint from an older version.
  // New submissions below always provide a name.

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.demo_account (
      id BIGSERIAL PRIMARY KEY,
      mobile TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("PostgreSQL database ready");
  await pool.query("SELECT 1");
}

// -------------------- Website --------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", async (req, res) => {
  try {
    if (pool) {
      await pool.query("SELECT 1");
    }

    res.json({
      success: true,
      databaseConfigured: Boolean(pool)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
});

// -------------------- Admin login --------------------

app.post("/admin-login", (req, res) => {
  if (!ADMIN_PASSWORD || !ADMIN_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: "Set ADMIN_PASSWORD and ADMIN_SECRET_KEY in environment variables."
    });
  }

  const body = req.body || {};
  const username =
    body.username || body.adminUsername || body.userId || "";
  const password =
    body.password || body.adminPassword || "";

  if (
    username !== ADMIN_USER_ID ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Wrong username or password."
    });
  }

  const token = makeAdminToken();
res.setHeader(
  "Set-Cookie",
  admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=28800
);

  res.json({
    success: true,
    token,
    message: "Admin login successful."
  });
});

// -------------------- Submit application --------------------

app.post("/submit-application", async (req, res) => {
  try {
    const application = getApplication(req.body);

    if (!application.name || !application.mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required."
      });
    }

    const record = {
      ...application,
      status: application.status || "Pending",
      created_at: new Date().toISOString()
    };

    const loanAmount = numericValue(application.loan_amount);
    const monthlyIncome = numericValue(application.monthly_income);

    if (pool) {
      const result = await pool.query(
        `
        INSERT INTO public.applications
        (
          name,
          mobile,
          email,
          state,
          loan_type,
          loan_amount,
          monthly_income,
          data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id, created_at
        `,
        [
          record.name,
          record.mobile,
          record.email,
          record.state,
          record.loan_type,
          loanAmount,
          monthlyIncome,
          JSON.stringify(record)
        ]
      );

      return res.json({
        success: true,
        message: "Application submitted successfully.",
        id: result.rows[0].id
      });
    }

    const applications = readApplications();
    record.id = Date.now();
    applications.push(record);
    writeApplications(applications);

    return res.json({
      success: true,
      message: "Application submitted successfully.",
      id: record.id
    });
  } catch (error) {
    console.error("Application save error:", error.message);

    res.status(500).json({
      success: false,
      message: "Application could not be saved."
    });
  }
});

// -------------------- Get all applications (Admin) --------------------

app.get("/applications", requireAdmin, async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query(`
        SELECT *
        FROM public.applications
        ORDER BY created_at DESC NULLS LAST, id DESC
      `);

      return res.json(result.rows.map(normalizeRow));
    }

    return res.json(
      readApplications().sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )
    );
  } catch (error) {
    console.error("Applications fetch error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load applications."
    });
  }
});

// -------------------- Check application --------------------

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
        `
        SELECT *
        FROM public.applications
        WHERE mobile = $1
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1
        `,
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
        application: normalizeRow(result.rows[0])
      });
    }

    const found = readApplications()
      .filter(item => String(item.mobile) === mobile)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )[0];

    if (!found) {
      return res.status(404).json({
        success: false,
        message: "Application not found."
      });
    }

    return res.json({ success: true, application: found });
  } catch (error) {
    console.error("Application status error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not check application."
    });
  }
});

// -------------------- Update status (Admin) --------------------

app.post("/update-status", requireAdmin, async (req, res) => {
  try {
    const { id, mobile, status } = req.body || {};

    if ((!id && !mobile) || !status) {
      return res.status(400).json({
        success: false,
        message: "Application id/mobile and status are required."
      });
    }

    if (pool) {
      const result = await pool.query(
        `
        UPDATE public.applications
        SET data = COALESCE(data, '{}'::jsonb)
                   || jsonb_build_object('status', $1::text)
        WHERE
          ($2::bigint IS NOT NULL AND id = $2::bigint)
          OR
          ($2::bigint IS NULL AND mobile = $3)
        RETURNING id
        `,
        [String(status), id || null, mobile || null]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }
    } else {
      const items = readApplications();
      const index = items.findIndex(item =>
        id
          ? String(item.id) === String(id)
          : String(item.mobile) === String(mobile)
      );

      if (index < 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }

      items[index].status = String(status);
      writeApplications(items);
    }

    res.json({ success: true, message: "Status updated." });
  } catch (error) {
    console.error("Status update error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update status."
    });
  }
});

// -------------------- Update charges (Admin) --------------------

app.post("/update-charges", requireAdmin, async (req, res) => {
  try {
    const { id, mobile, charges } = req.body || {};

    if ((!id && !mobile) || charges === undefined || charges === null) {
      return res.status(400).json({
        success: false,
        message: "Application id/mobile and charges are required."
      });
    }

    if (pool) {
      const result = await pool.query(
        `
        UPDATE public.applications
        SET data = COALESCE(data, '{}'::jsonb)
                   || jsonb_build_object('charges', $1::text)
        WHERE
          ($2::bigint IS NOT NULL AND id = $2::bigint)
          OR
          ($2::bigint IS NULL AND mobile = $3)
        RETURNING id
        `,
        [String(charges), id || null, mobile || null]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }
    } else {
      const items = readApplications();
      const index = items.findIndex(item =>
        id
          ? String(item.id) === String(id)
          : String(item.mobile) === String(mobile)
      );

      if (index < 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found."
        });
      }

      items[index].charges = String(charges);
      writeApplications(items);
    }

    res.json({ success: true, message: "Charges updated." });
  } catch (error) {
    console.error("Charges update error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update charges."
    });
  }
});

// -------------------- Save account details --------------------

app.post("/save-account-details", async (req, res) => {
  try {
    const body = req.body || {};
    const mobile = String(body.mobile || "").trim();

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required."
      });
    }

    const accountData = { ...body, mobile };

    if (pool) {
      await pool.query(
        `
        INSERT INTO public.demo_account (mobile, data, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (mobile)
        DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = CURRENT_TIMESTAMP
        `,
        [mobile, JSON.stringify(accountData)]
      );
    } else {
      const file = path.join(__dirname, "account-details.json");
      let accounts = [];

      if (fs.existsSync(file)) {
        try {
          accounts = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (_) {
          accounts = [];
        }
      }

      const index = accounts.findIndex(
        item => String(item.mobile) === mobile
      );

      if (index >= 0) {
        accounts[index] = accountData;
      } else {
        accounts.push(accountData);
      }

      fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
    }

    res.json({
      success: true,
      message: "Account details saved."
    });
  } catch (error) {
    console.error("Account save error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not save account details."
    });
  }
});

// -------------------- Get account details --------------------

app.get("/account-details", async (req, res) => {
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
        "SELECT data FROM public.demo_account WHERE mobile = $1 LIMIT 1",
        [mobile]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Account details not found."
        });
      }

      return res.json({
        success: true,
        account: result.rows[0].data
      });
    }

    const file = path.join(__dirname, "account-details.json");
    const accounts = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];

    const account = accounts.find(
      item => String(item.mobile) === mobile
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account details not found."
      });
    }

    res.json({ success: true, account });
  } catch (error) {
    console.error("Account fetch error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load account details."
    });
  }
});

// -------------------- Download CSV (Admin) --------------------

app.get("/download-csv", requireAdmin, async (req, res) => {
  try {
    let applications;

    if (pool) {
      const result = await pool.query(`
        SELECT *
        FROM public.applications
        ORDER BY created_at DESC NULLS LAST, id DESC
      `);

      applications = result.rows.map(normalizeRow);
    } else {
      applications = readApplications();
    }

    const columns = [
      "id",
      "name",
      "mobile",
      "email",
      "state",
      "loan_type",
      "loan_amount",
      "monthly_income",
      "status",
      "charges",
      "created_at"
    ];

    function csvCell(value) {
      let text = String(value ?? "");

      // Prevent spreadsheet formula injection.
      if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
      }

      return '"' + text.replace(/"/g, '""') + '"';
    }

    const csv = [
      columns.join(","),
      ...applications.map(item =>
        columns.map(column => csvCell(item[column])).join(",")
      )
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reliance-finance-applications.csv"'
    );

    res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("CSV download error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not download CSV."
    });
  }
});

// -------------------- Start server --------------------

async function startServer() {
  if (pool) {
    try {
      await setupDatabase();
    } catch (error) {
      console.error("DATABASE SETUP ERROR:", error.message);
      process.exitCode = 1;
      await pool.end().catch(() => {});
      process.exit(1);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
  console.log(Reliance Finance server running on port ${PORT});
  });
}

startServer();
