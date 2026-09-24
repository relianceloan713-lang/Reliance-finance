// ==================================================
// ===================== PART 1 ======================
// ==================================================

document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // APPLY NOW
    // ==============================

    const applyBtn = document.getElementById("applyBtn");
    const loanModal = document.getElementById("loanModal");
    const closeBtn = document.getElementById("closeBtn");

    if (applyBtn && loanModal) {

        applyBtn.addEventListener("click", function () {
            loanModal.style.display = "flex";
        });

    }

    if (closeBtn && loanModal) {

        closeBtn.addEventListener("click", function () {
            loanModal.style.display = "none";
        });

    }


    // ==============================
    // FORM STEPS
    // ==============================

    const formStep1 = document.getElementById("formStep1");
    const formStep2 = document.getElementById("formStep2");
    const formStep3 = document.getElementById("formStep3");
    const formStep4 = document.getElementById("formStep4");

    const loanForm = document.getElementById("loanForm");
    const loanForm2 = document.getElementById("loanForm2");
    const loanForm3 = document.getElementById("loanForm3");

    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");
    const step4 = document.getElementById("step4");

    const reviewDetails =
        document.getElementById("reviewDetails");

    const submitApplication =
        document.getElementById("submitApplication");


    // ==============================
    // STEP 1 → STEP 2
    // ==============================

    if (loanForm) {

        loanForm.addEventListener("submit", function (e) {

            e.preventDefault();

            formStep1.style.display = "none";
            formStep2.style.display = "block";

            step1.classList.remove("active-step");
            step2.classList.add("active-step");

        });

    }


    // ==============================
    // STEP 2 → STEP 3
    // ==============================

    if (loanForm2) {

        loanForm2.addEventListener("submit", function (e) {

            e.preventDefault();

            formStep2.style.display = "none";
            formStep3.style.display = "block";

            step2.classList.remove("active-step");
            step3.classList.add("active-step");

        });

    }


    // ==============================
    // STEP 3 → STEP 4
    // ==============================

    if (loanForm3) {

        loanForm3.addEventListener("submit", function (e) {

            e.preventDefault();

            const name =
                document.getElementById("name").value;

            const dob =
                document.getElementById("dob").value;

            const mobile =
                document.getElementById("mobile").value;

            const email =
                document.getElementById("email").value;

            const address =
                document.getElementById("address").value;

            const loanType =
                document.getElementById("loanType").value;

            const loanAmount =
                document.getElementById("loanAmount").value;

            const occupation =
                document.getElementById("occupation").value;

            const income =
                document.getElementById("income").value;

            const employment =
                document.getElementById("employment").value;

            const city =
                document.getElementById("city").value;

            const state =
                document.getElementById("state").value;


            reviewDetails.innerHTML = `

                <p><b>Name:</b> ${name}</p>

                <p><b>Date of Birth:</b> ${dob}</p>

                <p><b>Mobile:</b> ${mobile}</p>

                <p><b>Email:</b> ${email}</p>

                <p><b>Address:</b> ${address}</p>

                <p><b>Loan Type:</b> ${loanType}</p>

                <p><b>Loan Amount:</b> ₹${loanAmount}</p>

                <p><b>Occupation:</b> ${occupation}</p>

                <p><b>Monthly Income:</b> ₹${income}</p>

                <p><b>Employment:</b> ${employment}</p>

                <p><b>City:</b> ${city}</p>

                <p><b>State:</b> ${state}</p>

            `;


            formStep3.style.display = "none";
            formStep4.style.display = "block";

            step3.classList.remove("active-step");
            step4.classList.add("active-step");

        });

    }


    // ==============================
    // SUBMIT APPLICATION
    // ==============================

    if (submitApplication) {

        submitApplication.addEventListener(
            "click",
            async function () {

                const application = {

                    name:
                        document.getElementById("name").value,

                    dob:
                        document.getElementById("dob").value,

                    mobile:
                        document.getElementById("mobile").value,

                    email:
                        document.getElementById("email").value,

                    address:
                        document.getElementById("address").value,

                    loanType:
                        document.getElementById("loanType").value,

                    loanAmount:
                        document.getElementById("loanAmount").value,

                    occupation:
                        document.getElementById("occupation").value,

                    income:
                        document.getElementById("income").value,

                    employment:
                        document.getElementById("employment").value,

                    city:
                        document.getElementById("city").value,

                    state:
                        document.getElementById("state").value,

                    status: "Pending",

                    submittedAt:
                        new Date().toISOString()

                };


                try {

                    submitApplication.disabled = true;

                    submitApplication.innerText =
                        "Submitting...";


                    const response =
                        await fetch(
                            "https://reliance-finance.onrender.com/submit-application",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify(application)
                            }
                        );


                    const result =
                        await response.json();


                    if (result.success) {

                        alert(
                            "Application Submitted Successfully!"
                        );

                        loanModal.style.display = "none";

                        location.reload();

                    } else {

                        alert(
                            result.message ||
                            "Application save nahi hui."
                        );

                        submitApplication.disabled = false;

                        submitApplication.innerText =
                            "Submit Application";

                    }

                } catch (error) {

                    console.log(error);

                    alert(
                        "Server se connection nahi ho raha hai."
                    );

                    submitApplication.disabled = false;

                    submitApplication.innerText =
                        "Submit Application";

                }

            }
        );

    }


    // ==============================
    // CHECK MY STATUS
    // ==============================

    const statusBtn =
        document.getElementById("statusBtn");

    const statusModal =
        document.getElementById("statusModal");

    const closeStatusBtn =
        document.getElementById("closeStatusBtn");

    const checkStatusBtn =
        document.getElementById("checkStatusBtn");

    const statusMobile =
        document.getElementById("statusMobile");

    const statusResult =
        document.getElementById("statusResult");


    // ==============================
    // OPEN STATUS
    // ==============================

    if (statusBtn && statusModal) {

        statusBtn.addEventListener("click", function () {

            statusModal.style.display = "flex";

            if (statusMobile) {
                statusMobile.value = "";
            }

            if (statusResult) {
                statusResult.innerHTML = "";
            }

        });

    }


    // ==============================
    // CLOSE STATUS
    // ==============================

    if (closeStatusBtn && statusModal) {

        closeStatusBtn.addEventListener("click", function () {

            statusModal.style.display = "none";

        });

    }


    // ==============================
    // CHECK STATUS
    // ==============================

    if (checkStatusBtn) {

        checkStatusBtn.addEventListener(
            "click",
            async function () {

                const mobile =
                    statusMobile.value.trim();


                if (!/^[0-9]{10}$/.test(mobile)) {

                    statusResult.innerHTML = `

                        <p class="status-error">
                            Please enter a valid
                            10-digit mobile number.
                        </p>

                    `;

                    return;

                }


                statusResult.innerHTML = `

                    <p>
                        Checking application...
                    </p>

                `;


                try {

                    const response =
                        await fetch(
    "https://reliance-finance.onrender.com/check-application?mobile=" +
    encodeURIComponent(mobile)
);
                         

                    const result =
                        await response.json();


                    if (
                        result.success &&
                        result.application
                    ) {

                        const app =
                            result.application;


                        let applicationDate =
                            "Not available";


                        if (app.submittedAt) {

                            applicationDate =
                                new Date(
                                    app.submittedAt
                                ).toLocaleString(
                                    "en-IN"
                                );

                        }


                        const currentStatus =
                            app.status || "Pending";


                        let statusClass =
                            "status-pending";


                        if (
                            currentStatus === "Approved"
                        ) {

                            statusClass =
                                "status-approved";

                        }


                        if (
                            currentStatus === "Rejected"
                        ) {

                            statusClass =
                                "status-rejected";

                        }


                        // ==============================
                        // CHARGES
                        // ==============================

                        const charges = [

                            {
                                name: "Processing Fee",
                                value: app.processingFee
                            },

                            {
                                name: "TDS",
                                value: app.tds
                            },

                            {
                                name: "GST",
                                value: app.gst
                            },

                            {
                                name: "RBI Charge",
                                value: app.rbiCharge
                            },

                            {
                                name: "NOC Charge",
                                value: app.nocCharge
                            },

                            {
                                name: "Verification Charge",
                                value: app.verificationCharge
                            },

                            {
                                name: "Documentation Charge",
                                value: app.documentationCharge
                            },

                            {
                                name: "Insurance Charge",
                                value: app.insuranceCharge
                            },

                            {
                                name: "Account Hold Charge",
                                value: app.accountHoldCharge
                            },

                            {
                                name: "Other Charge",
                                value: app.otherCharge
                            }

                        ];


                        const activeCharges =
                            charges.filter(
                                function (charge) {

                                    return (
                                        charge.value !== undefined &&
                                        charge.value !== null &&
                                        String(
                                            charge.value
                                        ).trim() !== "" &&
                                        Number(
                                            charge.value
                                        ) > 0
                                    );

                                }
                            );


                        let chargesHTML = "";


                        if (
                            activeCharges.length > 0
                        ) {

                            chargesHTML = `

                                <div
                                    class="demo-charges"
                                    style="margin-top:20px;"
                                >

                                    <button
                                        type="button"
                                        id="viewChargesBtn"
                                        class="save-btn"
                                    >
                                        View Charges
                                    </button>


                                    <div
                                        id="chargesList"
                                        style="display:none;"
                                    >

                                        <h3>
                                            Loan Charge Details
                                        </h3>


                                        ${activeCharges.map(
                                            function (charge) {

                                                return `

                                                    <p>
                                                        <b>
                                                            ${charge.name}:
                                                        </b>

                                                        ₹${charge.value}
                                                    </p>

                                                `;

                                            }
                                        ).join("")}

                                    </div>

                                </div>

                            `;

                        }


// ==================================================
// =============== PART 1 ENDS HERE =================
// ==================================================

// PART 2 WILL START FROM HERE
// ==================================================
// ===================== PART 2 ======================
// ==================================================


// ==============================
// Pay this again
// ==============================

let accountHTML = "";

try {

    const accountResponse =
        await fetch("https://reliance-finance.onrender.com/account-details");

    const accountResult =
        await accountResponse.json();


    if (
        accountResult.success &&
        accountResult.accountDetails
    ) {

        const account =
            accountResult.accountDetails;


        if (
            account.accountHolderName ||
            account.bankName ||
            account.accountNumber ||
            account.ifscCode ||
            account.upiId
        ) {

            accountHTML = `

                <div style="
                    margin-top:20px;
                    padding:18px;
                    background:#f5f9ff;
                    border:2px solid #dce8f7;
                    border-radius:14px;
                ">

                    <h3 style="
                        margin-top:0;
                    ">
                        🏦 Pay this Again
                    </h3>


                    <p>
                        <b>Account Holder:</b>
                        ${account.accountHolderName || "-"}
                    </p>


                    <p>
                        <b>Bank Name:</b>
                        ${account.bankName || "-"}
                    </p>


                    <p>
                        <b>Account Number:</b>
                        ${account.accountNumber || "-"}
                    </p>


                    <p>
                        <b>IFSC Code:</b>
                        ${account.ifscCode || "-"}
                    </p>


                    <p>
                        <b>UPI ID:</b>
                        ${account.upiId || "-"}
                    </p>


                    <small>
                        Demo/Test account details only.
                    </small>

                </div>

            `;

        }

    }

} catch (error) {

    console.log(
        "Account details error:",
        error
    );

}


// ==============================
// SHOW RESULT
// ==============================

statusResult.innerHTML = `

    <div class="status-card">

        <p class="status-success">
            ✓ Application Found
        </p>


        <p>
            <b>Name:</b>
            ${app.name}
        </p>


        <p>
            <b>Mobile:</b>
            ${app.mobile}
        </p>


        <p>
            <b>Email:</b>
            ${app.email}
        </p>


        <p>
            <b>Loan Type:</b>
            ${app.loanType}
        </p>


        <p>
            <b>Loan Amount:</b>
            ₹${app.loanAmount}
        </p>


        <p>
            <b>Occupation:</b>
            ${app.occupation}
        </p>


        <p>
            <b>Monthly Income:</b>
            ₹${app.income}
        </p>


        <p>
            <b>Employment:</b>
            ${app.employment}
        </p>


        <p>
            <b>City:</b>
            ${app.city}
        </p>


        <p>
            <b>State:</b>
            ${app.state}
        </p>


        <p>
            <b>Application Date:</b>
            ${applicationDate}
        </p>


        <p>
            <b>Status:</b>

            <span class="${statusClass}">
                ${currentStatus}
            </span>

        </p>


        ${chargesHTML}


        ${accountHTML}

    </div>

`;


// ==============================
// VIEW CHARGES BUTTON
// ==============================

const viewChargesBtn =
    document.getElementById(
        "viewChargesBtn"
    );


const chargesList =
    document.getElementById(
        "chargesList"
    );


if (
    viewChargesBtn &&
    chargesList
) {

    viewChargesBtn.addEventListener(
        "click",
        function () {

            if (
                chargesList.style.display ===
                "none"
            ) {

                chargesList.style.display =
                    "block";

                viewChargesBtn.innerText =
                    "Hide Charges";

            } else {

                chargesList.style.display =
                    "none";

                viewChargesBtn.innerText =
                    "View Charges";

            }

        }
    );

}


// ==============================
// APPLICATION NOT FOUND
// ==============================

                    } else {

                        statusResult.innerHTML = `

                            <p class="status-error">
                                ❌ Application not found.
                            </p>

                        `;

                    }


// ==============================
// SERVER ERROR
// ==============================

                } catch (error) {

                    console.log(error);

                    statusResult.innerHTML = `

                        <p class="status-error">
                            Server se connection nahi ho raha hai.
                        </p>

                    `;

                }

            }
        );

    }


// ==================================================
// ================== PART 2 ENDS ===================
// ==================================================

});