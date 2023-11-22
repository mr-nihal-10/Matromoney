module.exports = (app) => {
   const payment = require("../../controllers/paymentController/Pay_U_Payment_Controller");

  var router = require("express").Router();
 //make payment api 
    //regular
        router.post('/processPayment',payment.processPayment);
   //Nonpayment
         router.post('/processPayment/none',payment.paymentaddnone);

  
 //get payment api 

  router.get('/processPayment/status:id',payment.getPaymentdata);

 // router.get('/processPayment/email:id',payment.testemail);

 //get Recall Api
 router.get('/processPayment/list',payment.paymentListRecall);

 
  
  app.use("/api/payment", router);
};
