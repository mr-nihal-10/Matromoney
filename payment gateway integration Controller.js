const crypto = require("crypto");
const axios = require("axios");
const { log } = require("console");
const qs = require("qs");
const express = require("express");
const app = express();
const db = require("../../models");
const async = require("matched/lib/async");
const { json } = require("body-parser");
const pdf = require("html-pdf");
const payment = db.payment;
const regestration = db.registration;
const nodemailer = require("nodemailer");
const { cache } = require("ejs");
const MERCHANT_KEY = "wD1Ag2oM";
const salt = "cT7Wt6T3ls";
const PAYU_BASE_URL = "https://secure.payu.in";
const PAYU_API_ENDPOINT = "https://secure.payu.in/_payment";
const PAYU_API_GETAPI = "https://secure.payu.in/payment/op/getPaymentResponse?";
const paymentriciptapi = require("./PaymentReciptMail_contoller");
const Sequelize = db.Sequelize;
// const BaseIP = "http://192.168.29.114:8091/";
const BaseIP="https://registration.jainboardingsangli.com/"
const GetregdataRecallApi = BaseIP + "api/payment/processPayment/list";
const cron = require('node-cron');





exports.processPayment = async (req, res) => {
  try {
    const {
      amount,
      firstname,
      email,
      phone,
      productinfo,
      surl,
      furl,
      userid,
      member,
      gender,marital_status,disability
    } = req.body;
    console.log("In Process try");

    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    // Generate a random transaction ID
    const txnid = Math.random().toString(36).substring(2, 22);

    // Prepare the data for hash calculation
    // const hashString = `${MERCHANT_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${phone}|||||||||||${salt}`;
    const hashString =
      MERCHANT_KEY +
      "|" +
      txnid +
      "|" +
      amount +
      "|" +
      productinfo +
      "|" +
      firstname +
      "|" +
      email +
      "|||||||||||" +
      salt;
    // Calculate the hash
    console.log("paymentdata", hashString);
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");
    const payment_data = {
      fname: firstname,
      tnxid: txnid,
      emailid: email,
      amount: amount,
      reg_id: userid,
      member_id: member,
      mobileno: phone,
      gender:gender,
      marital_status:marital_status,
      disability:disability

    };
    // Prepare the payment request parameters
    const paymentData = {
      key: MERCHANT_KEY,
      txnid: txnid,
      amount: amount,
      productinfo: productinfo,
      firstname: firstname,
      email: email,
      phone: phone,
      hash: hash,
      surl: surl,
      furl: furl,
      service_provider: "payu_paisa",
    };
    // console.log("paymentdata", paymentData);

    const serializedData = qs.stringify(paymentData);
    // console.log("serial data",serializedData)

    try {
      // Make a POST request to PayU API for payment processing
      const response = await axios.post(
        PAYU_API_ENDPOINT,
        serializedData,
        config
      );
      console.log("PayU API Response:", response);
      if (
        response &&
        response.request &&
        response.request.res &&
        response.request.res.responseUrl
      ) {
        const responseUrl = response.request.res.responseUrl;

        console.log(
          "Response URL:==============================================================",
          responseUrl
        );

        if (responseUrl !== null) {
          const paymentstatus = await payment.findOne({
            where: { reg_id: payment_data.reg_id },
          });

          console.log("paymernt_data", payment_data);
          if (paymentstatus === null) {
            payment
              .create(payment_data)
              .then((data) => {
                res.send({
                  userdata: data,
                  message: "SAVED",
                  responseUrl: responseUrl,
                });
              })
              .catch((err) => {
                res.status(500).send("FAILED");
              });
          } else {
            payment
              .update(payment_data, { where: { reg_id: payment_data.reg_id } })
              .then((data) => {
                res.send({
                  userdata: data,
                  message: "SAVED",
                  responseUrl: responseUrl,
                });
              })
              .catch((err) => {
                console.log(err);
                res.status(500).send("FAILED");
              });
          }
        }
        // Perform the redirection
        // res.send(responseUrl);
      }
    } catch (error) {
      // Handle PayU API errors
      console.error("PayU API Error:", error);
      res
        .status(500)
        .send(
          "Payment processing during payment failed. Please try again later."
        );
    }
  } catch (error) {
    // Handle other errors
    console.error("Server Error:", error);
    res.status(500).send("Payment processing failed. Please try again later.");
  }
};

exports.getPaymentdata = async (req, res) => {
  const reg_id = req.params.id;
  // const data= await payment.findOne({where:{reg_id:reg_id}})
  const data = await payment.findOne({ where: { member_id: reg_id } });
  // console.log("data",data)
  const merchantKey = "wD1Ag2oM";
  const merchantTransactionIds = data.tnxid;

  const hashString = `${merchantKey}|verify_payment|${merchantTransactionIds}|${salt}`;
  // Calculate the hash

  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  const encodedParams = new URLSearchParams();
  encodedParams.set("key", merchantKey);
  encodedParams.set("command", "verify_payment");
  encodedParams.set("var1", merchantTransactionIds);
  encodedParams.set("var2", "");
  encodedParams.set("var3", "");
  encodedParams.set("var4", "");
  encodedParams.set("var5", "");
  encodedParams.set("var6", "");
  encodedParams.set("var7", "");
  encodedParams.set("var8", "");
  encodedParams.set("var9", "");
  encodedParams.set("hash", hash);

  const url = "https://info.payu.in/merchant/postservice?form=2";

  axios
    .post(url, encodedParams, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .then((response) => {
      const transactionDetails = response.data.transaction_details;

      const dynamicKey = merchantTransactionIds; // Replace with your dynamic key
      if (transactionDetails && transactionDetails[dynamicKey]) {
        const transaction = transactionDetails[dynamicKey];
        const details = JSON.stringify(transaction);
        //  console.log("transaction,",details); // Example: Accessing 'mihpayid'
        const updatedata = {
          payumoneyid: transaction.mihpayid,
          status: transaction.status,
          mode: transaction.mode,
          paymentdate: transaction.addedon,
          respons: transaction.error_Message,
          respons_json: details,
        };

        if (updatedata !== null) {
          payment
            .update(updatedata, { where: { tnxid: dynamicKey } })
            .then(async (data) => {
              const payment_Data = await payment.findOne({
                where: { tnxid: dynamicKey },
              });
              // const value=await regestration.findOne({where:{member_id:reg_id}})

              if (payment_Data.status === "success") {
                console.log("in success block");
                paymentriciptapi.testemailfun(reg_id);
              }
              res.send(payment_Data);
            })
            .catch((err) => {
              console.log(err);
              res.status(500).send("FAILED");
            });
        }
      } else {
        console.error("Transaction not found for the dynamic key:", dynamicKey);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
};

exports.paymentaddnone = async (req, res) => {
  const tnxid = Math.random().toString(36).substring(2, 22);
  const registration = {
    reg_id: req.body.reg_id,
    member_id: req.body.member_id,
    payumoneyid: "None",
    tnxid: tnxid,
    fname: req.body.fname,
    emailid: req.body.emailid,
    mobileno: req.body.mobileno,
    amount: "00",
    status: "success",
    mode: "None",
    paymentdate: req.body.paymentdate,
    respons: "None",
    respons_json: "None",
    gender:req.body.gender,
    marital_status:req.body.marital_status,
    disability:req.body.disability
  };
  console.log("99999999999", registration);
  payment
    .create(registration)
    .then((data) => {
      paymentriciptapi.testemailfun(registration.member_id);
      res.send({
        userdata: data,
        message: "SAVED",
      });
    })
    .catch((err) => {
      res.status(500).send("FAILED");
    });
};



exports.paymentListRecall = async (req, res) => {

const tableList=await payment.findAll()
const currentDate = new Date();
const maxDate = currentDate.toISOString().split('T')[0];
const maxDateObj = new Date(maxDate);
const minDateObj = new Date(maxDateObj.getTime() - (7 * 24 * 60 * 60 * 1000));
const minDate = minDateObj.toISOString().split('T')[0];

const hashString = `${MERCHANT_KEY}|get_Transaction_Details|${minDate}|${salt}`;
// Calculate the hash
const hash = crypto.createHash("sha512").update(hashString).digest("hex");
const encodedParams = new URLSearchParams();
encodedParams.set("key", MERCHANT_KEY);
encodedParams.set("command", "get_Transaction_Details");
encodedParams.set("var1", minDate);
encodedParams.set("var2", maxDate);
encodedParams.set("var3", "");
encodedParams.set("var4", "");
encodedParams.set("var5", "");
encodedParams.set("var6", "");
encodedParams.set("var7", "");
encodedParams.set("var8", "");
encodedParams.set("var9", "");
encodedParams.set("hash", hash);

const url = "https://info.payu.in/merchant/postservice?form=2";

const detailList=await axios
  .post(url, encodedParams, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })
const transactions=detailList.data.Transaction_details
const filteredTransactions = transactions.filter(transaction => transaction.status === 'captured');
const emailForupdate=filteredTransactions.map(transaction => transaction.email);
try {
  for (const transaction of filteredTransactions) {
    const { email,id,status,mode,addedon,txnid} = transaction;
    const json=JSON.stringify(transaction);

    await payment.update(
      {
        payumoneyid:id,
        status:status,
        mode:mode,
        paymentdate:addedon,
        respons:"NO ERROR",
        respons_json:json,
        tnxid:txnid,
      },
      {
        where: {
          emailid: {
            [Sequelize.Op.eq]: email // Update the record where email matches
          }
        }
      }
    );
  
    await regestration.update(
      {
        payment:1,
        pay_amount:1235
      },
      {
        where: {
          emailid: {
            [Sequelize.Op.eq]: email // Update the record where email matches
          }
        }
      }
    );
  }
  res.json({
    message:"UPDATED",
    data:filteredTransactions
  })
} catch (error) {
  console.log("error",error);
}





};

cron.schedule('24 18 * * *', () => {
  axios
    .get(GetregdataRecallApi)
    .then((res) => {
      console.log("Done");
      // Handle the response data or perform any necessary actions
    })
    .catch((err) => {
      console.error(err);
      // Handle errors if the HTTP request fails
    });
}, {
  timezone: 'Asia/Kolkata' // Replace 'Your_Timezone_Here' with your timezone, like 'America/New_York'
});
