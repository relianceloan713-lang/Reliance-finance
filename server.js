// ==================================================
// PART 1 START
// RELIANCE FINANCE SERVER
// ==================================================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));


// ==================================================
// ADMIN LOGIN SECURITY
// ==================================================

const ADMIN_USER_ID =
    process.env.ADMIN_USER_ID || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "admin123";

const ADMIN_SECRET_KEY =
    process.env.ADMIN_SECRET_KEY ||
    "change-this-secret-key";


// CREATE ADMIN TOKEN

function createAdminToken() {

    const time =
        Date.now().toString();

    const data =
        "admin:" + time;

    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET_KEY
            )
            .update(data)
            .digest("hex");

    return data + ":" + signature;
}


// VERIFY ADMIN TOKEN

function verifyAdminToken(token) {

    if (!token) {
        return false;
    }

    const parts =
        token.split(":");

    if (parts.length !== 3) {
        return false;
    }

    const user =
        parts[0];

    const time =
        parts[1];

    const signature =
        parts[2];

    if (user !== "admin") {
        return false;
    }

    const data =
        user + ":" + time;

    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET_KEY
            )
            .update(data)
            .digest("hex");

    if (signature !== expectedSignature) {
        return false;
    }

    const tokenAge =
        Date.now() -
        Number(time);

    if (
        !Number.isFinite(tokenAge) ||
        tokenAge < 0 ||
        tokenAge > 24 * 60 * 60 * 1000
    ) {
        return false;
    }

    return true;
}


// GET ADMIN TOKEN FROM COOKIE

function getAdminToken(req) {

    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader
            .split(";")
            .map(function (item) {
                return item.trim();
            });

    const adminCookie =
        cookies.find(function (cookie) {

            return cookie.startsWith(
                "admin_token="
            );

        });

    if (!adminCookie) {
        return "";
    }

    return decodeURIComponent(
        adminCookie.substring(
            "admin_token=".length
        )
    );
}


// ADMIN AUTHENTICATION

function requireAdmin(
    req,
    res,
    next
) {

    const token =
        getAdminToken(req);

    if (!verifyAdminToken(token)) {

        return res.status(401).json({

            success: false,

            message:
                "Admin login required."

        });

    }

    next();
}


// ==================================================
// POSTGRESQL DATABASE
// ==================================================

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:
        process.env.DATABASE_URL
            ? {
                rejectUnauthorized: false
            }
            : false

});


// ==================================================
// DATABASE SETUP
// ==================================================

async function setupDatabase() {

    if (!process.env.DATABASE_URL) {

        console.log(
            "DATABASE_URL nahi mila. Local JSON mode use hoga."
        );

        return;
    }

    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                mobile TEXT,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);


        await pool.query(`
            CREATE TABLE IF NOT EXISTS demo_account (
                id INTEGER PRIMARY KEY,
                account_details JSONB NOT NULL
            )
        `);


        await migrateOldApplications();

        await migrateOldAccount();


        console.log(
            "PostgreSQL database ready"
        );

    } catch (error) {

        console.log(
            "Database setup error:",
            error
        );

    }

}


// ==================================================
// OLD APPLICATIONS JSON -> DATABASE
// ==================================================

async function migrateOldApplications() {

    try {

        const file =
            path.join(
                __dirname,
                "applications.json"
            );


        if (!fs.existsSync(file)) {
            return;
        }


        const result =
            await pool.query(
                "SELECT COUNT(*) FROM applications"
            );


        const count =
            Number(
                result.rows[0].count
            );


        if (count > 0) {
            return;
        }


        const data =
            fs.readFileSync(
                file,
                "utf8"
            );


        if (data.trim() === "") {
            return;
        }


        const applications =
            JSON.parse(data);


        if (!Array.isArray(applications)) {
            return;
        }


        for (
            const application
            of applications
        ) {

            await pool.query(
                `
                INSERT INTO applications
                (mobile, data)
                VALUES ($1, $2)
                `,
                [
                    application.mobile || "",
                    application
                ]
            );

        }


        console.log(
            applications.length +
            " old applications migrated"
        );

    } catch (error) {

        console.log(
            "Application migration error:",
            error
        );

    }

}


// ==================================================
// OLD ACCOUNT JSON -> DATABASE
// ==================================================

async function migrateOldAccount() {

    try {

        const file =
            path.join(
                __dirname,
                "demo-account.json"
            );


        if (!fs.existsSync(file)) {
            return;
        }


        const result =
            await pool.query(
                "SELECT COUNT(*) FROM demo_account"
            );


        const count =
            Number(
                result.rows[0].count
            );


        if (count > 0) {
            return;
        }


        const data =
            fs.readFileSync(
                file,
                "utf8"
            );


        if (data.trim() === "") {
            return;
        }


        const accountDetails =
            JSON.parse(data);


        await pool.query(
            `
            INSERT INTO demo_account
            (id, account_details)
            VALUES (1, $1)
            `,
            [accountDetails]
        );


        console.log(
            "Old demo account migrated"
        );

    } catch (error) {

        console.log(
            "Account migration error:",
            error
        );

    }

}


// ==================================================
// HOME
// ==================================================

app.get(
    "/",
    function (req, res) {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


// ==================================================
// ADMIN LOGIN API
// ==================================================

app.post(
    "/admin-login",
    function (req, res) {

        const userId =
            String(
                req.body.userId || ""
            ).trim();

        const password =
            String(
                req.body.password || ""
            );


        if (
            userId !== ADMIN_USER_ID ||
            password !== ADMIN_PASSWORD
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Wrong User ID or Password."

            });

        }


        const token =
            createAdminToken();


        res.setHeader(
            "Set-Cookie",
            "admin_token=" +
            encodeURIComponent(token) +
            "; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400"
        );


        res.json({

            success: true,

            message:
                "Admin login successful."

        });

    }
);


// ==================================================
// ADMIN LOGOUT API
// ==================================================

app.post(
    "/admin-logout",
    function (req, res) {

        res.setHeader(
            "Set-Cookie",
            "admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
        );


        res.json({

            success: true,

            message:
                "Admin logout successful."

        });

    }
);


// ==================================================
// CHECK ADMIN LOGIN
// ==================================================

app.get(
    "/admin-session",
    function (req, res) {

        const token =
            getAdminToken(req);


        if (
            verifyAdminToken(token)
        ) {

            return res.json({

                success: true,
                loggedIn: true

            });

        }


        res.status(401).json({

            success: false,
            loggedIn: false

        });

    }
);


// ==================================================
// PART 1 END
// ==================================================
// ==================================================
// PART 2 START
// ADMIN + APPLICATION ROUTES
// ==================================================


// ==================================================
// SAVE APPLICATION
// PUBLIC
// ==================================================

app.post(
    "/submit-application",
    async function (req, res) {

        try {

            const application = req.body;

            if (process.env.DATABASE_URL) {

                await pool.query(
                    `
                    INSERT INTO applications
                    (mobile, data)
                    VALUES ($1, $2)
                    `,
                    [
                        application.mobile || "",
                        application
                    ]
                );

            } else {

                const file =
                    path.join(
                        __dirname,
                        "applications.json"
                    );

                let applications = [];

                if (fs.existsSync(file)) {

                    const data =
                        fs.readFileSync(
                            file,
                            "utf8"
                        );

                    if (data.trim() !== "") {
                        applications =
                            JSON.parse(data);
                    }
                }

                applications.push(application);

                fs.writeFileSync(
                    file,
                    JSON.stringify(
                        applications,
                        null,
                        2
                    )
                );
            }

            res.json({
                success: true,
                message:
                    "Application saved successfully"
            });

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false,
                message:
                    "Application save nahi hui"
            });

        }

    }
);


// ==================================================
// CHECK APPLICATION
// PUBLIC
// ==================================================

app.get(
    "/check-application",
    async function (req, res) {

        try {

            const mobile =
                req.query.mobile;

            if (process.env.DATABASE_URL) {

                const result =
                    await pool.query(
                        `
                        SELECT data
                        FROM applications
                        WHERE mobile = $1
                        ORDER BY id DESC
                        LIMIT 1
                        `,
                        [mobile]
                    );

                if (result.rows.length === 0) {

                    return res.json({
                        success: false
                    });

                }

                return res.json({
                    success: true,
                    application:
                        result.rows[0].data
                });
            }


            const file =
                path.join(
                    __dirname,
                    "applications.json"
                );

            if (!fs.existsSync(file)) {

                return res.json({
                    success: false
                });

            }

            const data =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            if (data.trim() === "") {

                return res.json({
                    success: false
                });

            }

            const applications =
                JSON.parse(data);

            const application =
                applications.find(
                    function (app) {
                        return app.mobile === mobile;
                    }
                );

            if (!application) {

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true,
                application: application
            });

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false
            });

        }

    }
);


// ==================================================
// GET APPLICATIONS
// ADMIN ONLY
// ==================================================

app.get(
    "/applications",
    requireAdmin,
    async function (req, res) {

        try {

            if (process.env.DATABASE_URL) {

                const result =
                    await pool.query(
                        `
                        SELECT data
                        FROM applications
                        ORDER BY id DESC
                        `
                    );

                return res.json(
                    result.rows.map(
                        function (row) {
                            return row.data;
                        }
                    )
                );
            }


            const file =
                path.join(
                    __dirname,
                    "applications.json"
                );

            if (!fs.existsSync(file)) {
                return res.json([]);
            }

            const data =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            if (data.trim() === "") {
                return res.json([]);
            }

            res.json(
                JSON.parse(data)
            );

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false,
                message:
                    "Applications load nahi hui"
            });

        }

    }
);


// ==================================================
// UPDATE STATUS
// ADMIN ONLY
// ==================================================

app.post(
    "/update-status",
    requireAdmin,
    async function (req, res) {

        try {

            const mobile =
                req.body.mobile;

            const status =
                req.body.status;


            if (process.env.DATABASE_URL) {

                const result =
                    await pool.query(
                        `
                        SELECT id, data
                        FROM applications
                        WHERE mobile = $1
                        ORDER BY id DESC
                        LIMIT 1
                        `,
                        [mobile]
                    );

                if (result.rows.length === 0) {

                    return res.status(404).json({
                        success: false,
                        message:
                            "Application nahi mili"
                    });

                }

                const application =
                    result.rows[0].data;

                application.status =
                    status;

                await pool.query(
                    `
                    UPDATE applications
                    SET data = $1
                    WHERE id = $2
                    `,
                    [
                        application,
                        result.rows[0].id
                    ]
                );

                return res.json({
                    success: true,
                    message:
                        "Status updated successfully"
                });
            }


            const file =
                path.join(
                    __dirname,
                    "applications.json"
                );

            if (!fs.existsSync(file)) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Applications file nahi mili"
                });

            }

            const data =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            let applications = [];

            if (data.trim() !== "") {
                applications =
                    JSON.parse(data);
            }

            const index =
                applications.findIndex(
                    function (app) {
                        return app.mobile === mobile;
                    }
                );

            if (index === -1) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Application nahi mili"
                });

            }

            applications[index].status =
                status;

            fs.writeFileSync(
                file,
                JSON.stringify(
                    applications,
                    null,
                    2
                )
            );

            res.json({
                success: true,
                message:
                    "Status updated successfully"
            });

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false,
                message:
                    "Status update nahi hua"
            });

        }

    }
);


// ==================================================
// UPDATE DEMO CHARGES
// ADMIN ONLY
// ==================================================

app.post(
    "/update-charges",
    requireAdmin,
    async function (req, res) {

        try {

            const mobile =
                req.body.mobile;

            const charges =
                req.body.charges ||
                req.body;


            if (process.env.DATABASE_URL) {

                const result =
                    await pool.query(
                        `
                        SELECT id, data
                        FROM applications
                        WHERE mobile = $1
                        ORDER BY id DESC
                        LIMIT 1
                        `,
                        [mobile]
                    );

                if (result.rows.length === 0) {

                    return res.status(404).json({
                        success: false,
                        message:
                            "Application nahi mili"
                    });

                }

                const application =
                    result.rows[0].data;


                application.processingFee =
                    charges.processingFee || "";

                application.tds =
                    charges.tds || "";

                application.rbiCharge =
                    charges.rbiCharge || "";

                application.gst =
                    charges.gst || "";

                application.nocCharge =
                    charges.nocCharge || "";

                application.verificationCharge =
                    charges.verificationCharge || "";

                application.documentationCharge =
                    charges.documentationCharge || "";

                application.insuranceCharge =
                    charges.insuranceCharge || "";

                application.accountHoldCharge =
                    charges.accountHoldCharge || "";

                application.otherCharge =
                    charges.otherCharge || "";


                await pool.query(
                    `
                    UPDATE applications
                    SET data = $1
                    WHERE id = $2
                    `,
                    [
                        application,
                        result.rows[0].id
                    ]
                );


                return res.json({
                    success: true,
                    message:
                        "Charges updated successfully"
                });

            }


            const file =
                path.join(
                    __dirname,
                    "applications.json"
                );

            if (!fs.existsSync(file)) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Applications file nahi mili"
                });

            }

            const data =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            let applications = [];

            if (data.trim() !== "") {
                applications =
                    JSON.parse(data);
            }

            const index =
                applications.findIndex(
                    function (app) {
                        return app.mobile === mobile;
                    }
                );

            if (index === -1) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Application nahi mili"
                });

            }


            applications[index].processingFee =
                charges.processingFee || "";

            applications[index].tds =
                charges.tds || "";

            applications[index].rbiCharge =
                charges.rbiCharge || "";

            applications[index].gst =
                charges.gst || "";

            applications[index].nocCharge =
                charges.nocCharge || "";

            applications[index].verificationCharge =
                charges.verificationCharge || "";

            applications[index].documentationCharge =
                charges.documentationCharge || "";

            applications[index].insuranceCharge =
                charges.insuranceCharge || "";

            applications[index].accountHoldCharge =
                charges.accountHoldCharge || "";

            applications[index].otherCharge =
                charges.otherCharge || "";


            fs.writeFileSync(
                file,
                JSON.stringify(
                    applications,
                    null,
                    2
                )
            );


            res.json({
                success: true,
                message:
                    "Charges updated successfully"
            });

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false,
                message:
                    "Charges update nahi hua"
            });

        }

    }
);


// ==================================================
// SAVE ACCOUNT + CONTACT DETAILS
// ADMIN ONLY
// ==================================================

app.post(
    "/save-account-details",
    requireAdmin,
    async function (req, res) {

        try {

            let accountDetails = {};


            if (process.env.DATABASE_URL) {

                const oldResult =
                    await pool.query(
                        `
                        SELECT account_details
                        FROM demo_account
                        WHERE id = 1
                        LIMIT 1
                        `
                    );

                if (oldResult.rows.length > 0) {

                    accountDetails =
                        oldResult.rows[0]
                            .account_details || {};

                }

            } else {

                const file =
                    path.join(
                        __dirname,
                        "demo-account.json"
                    );

                if (fs.existsSync(file)) {

                    const data =
                        fs.readFileSync(
                            file,
                            "utf8"
                        );

                    if (data.trim() !== "") {

                        accountDetails =
                            JSON.parse(data);

                    }

                }

            }


            if (
                req.body.accountHolderName !==
                undefined
            ) {

                accountDetails.accountHolderName =
                    req.body.accountHolderName || "";

            }

            if (
                req.body.bankName !==
                undefined
            ) {

                accountDetails.bankName =
                    req.body.bankName || "";

            }

            if (
                req.body.accountNumber !==
                undefined
            ) {

                accountDetails.accountNumber =
                    req.body.accountNumber || "";

            }

            if (
                req.body.ifscCode !==
                undefined
            ) {

                accountDetails.ifscCode =
                    req.body.ifscCode || "";

            }

            if (
                req.body.upiId !==
                undefined
            ) {

                accountDetails.upiId =
                    req.body.upiId || "";

            }

            if (
                req.body.whatsappNumber !==
                undefined
            ) {

                accountDetails.whatsappNumber =
                    req.body.whatsappNumber || "";

            }

            if (
                req.body.helplineNumber !==
                undefined
            ) {

                accountDetails.helplineNumber =
                    req.body.helplineNumber || "";

            }

            if (
                req.body.contactEmail !==
                undefined
            ) {

                accountDetails.contactEmail =
                    req.body.contactEmail || "";

            }


            if (process.env.DATABASE_URL) {

                await pool.query(
                    `
                    INSERT INTO demo_account
                    (id, account_details)
                    VALUES (1, $1)
                    ON CONFLICT (id)
                    DO UPDATE SET
                    account_details =
                    EXCLUDED.account_details
                    `,
                    [accountDetails]
                );

                return res.json({
                    success: true,
                    message:
                        "Details saved successfully"
                });

            }


            const file =
                path.join(
                    __dirname,
                    "demo-account.json"
                );

            fs.writeFileSync(
                file,
                JSON.stringify(
                    accountDetails,
                    null,
                    2
                )
            );

            res.json({
                success: true,
                message:
                    "Details saved successfully"
            });

        } catch (error) {

            console.log(
                "Save details error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Details save nahi hui"
            });

        }

    }
);


// ==================================================
// GET ACCOUNT + CONTACT DETAILS
// PUBLIC
// ==================================================

app.get(
    "/account-details",
    async function (req, res) {

        try {

            if (process.env.DATABASE_URL) {

                const result =
                    await pool.query(
                        `
                        SELECT account_details
                        FROM demo_account
                        WHERE id = 1
                        LIMIT 1
                        `
                    );

                if (result.rows.length === 0) {

                    return res.json({
                        success: true,
                        accountDetails: {}
                    });

                }

                return res.json({
                    success: true,
                    accountDetails:
                        result.rows[0]
                            .account_details
                });

            }


            const file =
                path.join(
                    __dirname,
                    "demo-account.json"
                );

            if (!fs.existsSync(file)) {

                return res.json({
                    success: true,
                    accountDetails: {}
                });

            }

            const data =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            const accountDetails =
                data.trim() === ""
                    ? {}
                    : JSON.parse(data);

            res.json({
                success: true,
                accountDetails:
                    accountDetails
            });

        } catch (error) {

            console.log(error);

            res.status(500).json({
                success: false,
                message:
                    "Account details load nahi hui"
            });

        }

    }
);


// ==================================================
// START SERVER
// ==================================================

const PORT =
    process.env.PORT || 3000;


setupDatabase()
    .then(function () {

        app.listen(
            PORT,
            "0.0.0.0",
            function () {

                console.log(
                    "Server is running on port " +
                    PORT
                );

            }
        );

    })
    .catch(function (error) {

        console.log(
            "Server startup error:",
            error
        );

    });


// ==================================================
// PART 2 END
// ==================================================