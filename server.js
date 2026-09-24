const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


// ==============================
// HOME
// ==============================

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});


// ==============================
// SAVE APPLICATION
// ==============================

app.post("/submit-application", function (req, res) {

    try {

        const file = path.join(__dirname, "applications.json");

        let applications = [];

        if (fs.existsSync(file)) {

            const data = fs.readFileSync(file, "utf8");

            if (data.trim() !== "") {
                applications = JSON.parse(data);
            }

        }

        applications.push(req.body);

        fs.writeFileSync(
            file,
            JSON.stringify(applications, null, 2)
        );

        res.json({
            success: true,
            message: "Application saved successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Application save nahi hui"
        });

    }

});


// ==============================
// GET APPLICATIONS
// ==============================

app.get("/applications", function (req, res) {

    try {

        const file = path.join(__dirname, "applications.json");

        if (!fs.existsSync(file)) {
            return res.json([]);
        }

        const data = fs.readFileSync(file, "utf8");

        if (data.trim() === "") {
            return res.json([]);
        }

        const applications = JSON.parse(data);

        res.json(applications);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Applications load nahi hui"
        });

    }

});


// ==============================
// CHECK APPLICATION
// ==============================

app.get("/check-application", function (req, res) {

    try {

        const mobile = req.query.mobile;

        const file = path.join(__dirname, "applications.json");

        if (!fs.existsSync(file)) {

            return res.json({
                success: false
            });

        }

        const data = fs.readFileSync(file, "utf8");

        if (data.trim() === "") {

            return res.json({
                success: false
            });

        }

        const applications = JSON.parse(data);

        const application = applications.find(function (app) {

            return app.mobile === mobile;

        });

        if (application) {

            res.json({
                success: true,
                application: application
            });

        } else {

            res.json({
                success: false
            });

        }

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false
        });

    }

});


// ==============================
// UPDATE APPLICATION STATUS
// ==============================

app.post("/update-status", function (req, res) {

    try {

        const mobile = req.body.mobile;
        const status = req.body.status;

        const file = path.join(__dirname, "applications.json");

        if (!fs.existsSync(file)) {

            return res.status(404).json({
                success: false,
                message: "Applications file nahi mili"
            });

        }

        const data = fs.readFileSync(file, "utf8");

        let applications = [];

        if (data.trim() !== "") {
            applications = JSON.parse(data);
        }

        const index = applications.findIndex(function (app) {

            return app.mobile === mobile;

        });

        if (index === -1) {

            return res.status(404).json({
                success: false,
                message: "Application nahi mili"
            });

        }

        applications[index].status = status;

        fs.writeFileSync(
            file,
            JSON.stringify(applications, null, 2)
        );

        res.json({
            success: true,
            message: "Status updated successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Status update nahi hua"
        });

    }

});


// ==============================
// UPDATE DEMO CHARGES
// ==============================

app.post("/update-charges", function (req, res) {

    try {

        const mobile = req.body.mobile;
        const charges = req.body.charges;

        const file = path.join(__dirname, "applications.json");

        if (!fs.existsSync(file)) {

            return res.status(404).json({
                success: false,
                message: "Applications file nahi mili"
            });

        }

        const data = fs.readFileSync(file, "utf8");

        let applications = [];

        if (data.trim() !== "") {
            applications = JSON.parse(data);
        }

        const index = applications.findIndex(function (app) {

            return app.mobile === mobile;

        });

        if (index === -1) {

            return res.status(404).json({
                success: false,
                message: "Application nahi mili"
            });

        }


        // DEMO CHARGES SAVE

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
            JSON.stringify(applications, null, 2)
        );


        res.json({
            success: true,
            message: "Charges updated successfully"
        });


    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Charges update nahi hua"
        });

    }

});
// ==============================
// DEMO ACCOUNT DETAILS
// ==============================

app.post("/save-account-details", function (req, res) {

    try {

        const file =
            path.join(__dirname, "demo-account.json");

        const accountDetails = {

            accountHolderName:
                req.body.accountHolderName || "",

            bankName:
                req.body.bankName || "",

            accountNumber:
                req.body.accountNumber || "",

            ifscCode:
                req.body.ifscCode || "",

            upiId:
                req.body.upiId || ""

        };

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
            message: "Demo account details saved successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Account details save nahi hui"
        });

    }

});


// ==============================
// GET DEMO ACCOUNT DETAILS
// ==============================

app.get("/account-details", function (req, res) {

    try {

        const file =
            path.join(__dirname, "demo-account.json");

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

});


// ==============================
// START SERVER
// ==============================

app.listen(3000, function () {

    console.log(
        "Server is running on http://localhost:3000"
    );

});