const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const stripeService = require('../services/stripe');
const PaymentLink = require('../models/PaymentLink');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Validation middleware
const validatePaymentLinkCreation = [
  param('user_id').isMongoId().withMessage('Invalid user ID'),
  body('amount').isFloat({ min: 0.5 }).withMessage('Amount must be at least $0.50'),
  body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency'),
  body('paymentType').isIn(['subscription', 'one_time', 'donation', 'membership', 'product', 'cart']).withMessage('Invalid payment type'),
  body('productId').optional().notEmpty().withMessage('Product ID is required for product payments'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
  body('relatedId').optional().isMongoId().withMessage('Invalid related ID'),
  body('relatedModel').optional().isIn(['Product', 'Subscription', 'Masterclass', 'Membership', 'Order']).withMessage('Invalid related model'),
  body('products').optional().isArray().withMessage('Products must be an array'),
  body('products.*.productId').optional().isMongoId().withMessage('Invalid product ID'),
  body('products.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('products.*.price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
];

const validatePaymentSuccess = [
  param('user_id').isMongoId().withMessage('Invalid user ID'),
  query('secureCode').isLength({ min: 32, max: 32 }).withMessage('Invalid secure code'),
  query('session_id').optional().notEmpty().withMessage('Session ID required'),
];

// POST /:user_id/create-payment - Create payment link
router.post('/:user_id/create-payment', auth, validatePaymentLinkCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    console.log(errors)

    const { user_id } = req.params;
    const { 
      amount, 
      currency = 'usd', 
      paymentType, 
      productId, 
      description,
      relatedId,
      relatedModel,
      products = [],
      metadata = {}
    } = req.body;

    // Verify user exists
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check if requesting user has permission (admin or the user themselves)
    if (req.user.role !== 'admin' && req.user._id.toString() !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Generate secure code
    const secureCode = crypto.randomBytes(16).toString('hex');

    // Create or get Stripe product
    let stripeProduct;
    if (productId) {
      // Use existing product
      stripeProduct = { id: productId };
    } else {
      // Create new product
      stripeProduct = await stripeService.createProduct(
        `Payment for ${user.name}`,
        description || `Payment of $${amount} for ${paymentType}`,
        { 
          userId: user_id,
          paymentType,
          secureCode,
          ...metadata
        }
      );
    }

    // Create Stripe price
    const stripePrice = await stripeService.createPrice(
      stripeProduct.id,
      amount,
      currency,
      paymentType === 'subscription' ? { interval: 'month' } : null
    );

    // Create Stripe payment link
    const paymentLinkData = {
      line_items: [{
        price: stripePrice.id,
        quantity: 1,
      }],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${'http://localhost:3001'}/api/payment-links/${user_id}/payment-success?secureCode=${secureCode}&session_id={CHECKOUT_SESSION_ID}`,
        },
      },
      metadata: {
        userId: user_id,
        secureCode,
        paymentType,
        relatedId: relatedId || '',
        relatedModel: relatedModel || '',
      },
    };

    // Add customer email if available
    if (user.email) {
      paymentLinkData.customer_creation = 'always';
      paymentLinkData.custom_fields = [{
        key: 'email',
        label: { type: 'custom', custom: 'Email' },
        type: 'text',
        optional: false,
      }];
    }

    const stripePaymentLink = await stripe.paymentLinks.create(paymentLinkData);

    // Save payment link to database
    const paymentLink = new PaymentLink({
      userId: user_id,
      stripePaymentLinkId: stripePaymentLink.id,
      stripePriceId: stripePrice.id,
      stripeProductId: stripeProduct.id,
      amount,
      currency: currency.toUpperCase(),
      secureCode,
      paymentType,
      relatedId,
      relatedModel,
      metadata: new Map(Object.entries(metadata)),
    });

    await paymentLink.save();

    // Create draft order with PENDING_PAYMENT status
    let order = null;
    console.log(paymentType, "Hello World",products);
    if (paymentType === 'product' && products.length > 0) {
      console.log("Saving Order");
      order = new Order({
        userId: user_id,
        products: products.map(product => ({
          productId: product.productId,
          quantity: product.quantity,
          price: product.price
        })),
        totalAmount: amount,
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentLinkId: paymentLink._id,
      });
      await order.save();

      // Add order reference to payment link
      paymentLink.relatedId = order._id;
      paymentLink.relatedModel = 'Order';
      await paymentLink.save();
    } else if (paymentType === 'cart') {
      console.log("Processing Cart Payment");
      
      // Find user's cart
      const cart = await Cart.findOne({ userId: user_id }).populate('products.productId');
      if (!cart || cart.products.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Cart is empty or not found' 
        });
      }

      // Create order from cart items
      order = new Order({
        userId: user_id,
        products: cart.products.map(cartItem => ({
          productId: cartItem.productId._id,
          quantity: cartItem.quantity,
          price: cartItem.productId.price
        })),
        totalAmount: amount,
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentLinkId: paymentLink._id,
      });
      await order.save();

      // Add order reference to payment link
      paymentLink.relatedId = order._id;
      paymentLink.relatedModel = 'Order';
      await paymentLink.save();
    }

    res.json({
      success: true,
      message: 'Payment link created successfully',
      data: {
        payment_link: stripePaymentLink.url,
        secureCode,
        expiresAt: paymentLink.expiresAt,
        paymentLinkId: paymentLink._id,
        orderId: order ? order._id : null,
        orderStatus: order ? order.status : null,
      },
    });

  } catch (error) {
    console.error('Payment link creation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create payment link', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /:user_id/payment-success - Handle payment success
router.get('/:user_id/payment-success', validatePaymentSuccess, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request parameters',
        errors: errors.array() 
      });
    }

    const { user_id } = req.params;
    const { secureCode, session_id } = req.query;

    console.log(`Processing Cart Payment - Secure Code: ${secureCode}, Session ID: ${session_id || 'NOT PROVIDED'}`);

    // Verify user exists
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Find payment link by secure code
    const paymentLink = await PaymentLink.findBySecureCode(secureCode);
    if (!paymentLink) {
      return res.status(404).json({ 
        success: false,
        message: 'Payment link not found or expired' 
      });
    }

    // Verify the payment link belongs to the user
    if (paymentLink.userId._id.toString() !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Payment link does not belong to this user' 
      });
    }

    // Check if payment link can be completed
    if (!paymentLink.canComplete()) {
      return res.status(400).json({ 
        success: false,
        message: paymentLink.isExpired() ? 'Payment link has expired' : 'Payment link already processed' 
      });
    }

    // If session_id is provided, verify the payment with Stripe
    if (session_id && session_id !== 'undefined') {
      try {
        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);
        
        if (session.payment_status === 'paid') {
          // Mark payment link as completed
          paymentLink.markCompleted(session_id, {
            email: session.customer_details?.email,
            name: session.customer_details?.name,
          });
          
          await paymentLink.save();

          // Create payment record
          const payment = new Payment({
            userId: user_id,
            stripePaymentIntentId: session.payment_intent,
            stripeCustomerId: session.customer,
            amount: paymentLink.amount,
            currency: paymentLink.currency,
            status: 'succeeded',
            paymentType: paymentLink.paymentType,
            relatedId: paymentLink.relatedId,
            relatedModel: paymentLink.relatedModel,
            description: `Payment via link for ${paymentLink.paymentType}`,
          });

          await payment.save();

          console.log(payment, "Payment");
          console.log(paymentLink, "Payment Link");

          // Update order status if exists
          if (paymentLink.relatedModel === 'Order' && paymentLink.relatedId) {
            const order = await Order.findById(paymentLink.relatedId);
            if (order) {
              order.status = 'confirmed';
              order.paymentStatus = 'succeeded';
              order.paymentId = payment._id;
              order.stripePaymentIntentId = session.payment_intent;
              await order.save();

              // Clear cart if this was a cart payment
              if (paymentLink.paymentType === 'cart') {
                const cart = await Cart.findOne({ userId: user_id });
                if (cart) {
                  cart.products = [];
                  await cart.save();
                  console.log(`Cart cleared for user ${user_id} after successful payment`);
                }
              }
            }
          }

          // Handle post-payment actions
          await handleSuccessfulPayment(payment, paymentLink);
        //   res.redirect("https://fornt_uyrl/succe")

          // Return redirect page with timer instead of JSON
          const redirectPageTemplate = `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Payment Successful - Redirecting...</title>
              <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f8ff; }
                  .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                  .countdown { color: #007bff; font-size: 18px; margin: 20px 0; }
                  button { padding: 10px 20px; margin: 10px; cursor: pointer; }
                  .cancel-btn { background-color: #dc3545; color: white; border: none; border-radius: 5px; }
              </style>
          </head>
          <body>
              <div>
                  <h1 class="success">✅ Payment Successful!</h1>
                  <p>Your payment of $${payment.amount} ${payment.currency} has been processed successfully.</p>
                  <p class="countdown">Redirecting to your account in <span id="countdown">5</span> seconds...</p>
                  <button class="cancel-btn" onclick="cancelRedirect()">Cancel Redirect</button>
              </div>
          
              <script>
                  let timeLeft = 5;
                  let redirectUrl = 'http://localhost:4028/checkout';
                  let countdownInterval;
                  let redirectCanceled = false; 
          
                  function updateCountdown() {
                      document.getElementById('countdown').textContent = timeLeft;
                      if (timeLeft <= 0 && !redirectCanceled) {
                          window.location.href = redirectUrl;
                      }
                      timeLeft--;
                  }
          
                  function cancelRedirect() {
                      redirectCanceled = true;
                      clearInterval(countdownInterval);
                      document.querySelector('.countdown').innerHTML = 'Redirect canceled. <a href="' + redirectUrl + '">Click here to continue</a>';
                  }
          
                  countdownInterval = setInterval(updateCountdown, 1000);
                  updateCountdown(); // Initial call
              </script>
          </body>
          </html>`;
          
          return res.send(redirectPageTemplate);
        } else {
          return res.status(400).json({ 
            success: false,
            message: 'Payment not completed' 
          });
        }
      } catch (stripeError) {
        console.error('Stripe session verification error:', stripeError);
        return res.status(400).json({ 
          success: false,
          message: 'Failed to verify payment with Stripe' 
        });
      }
    } else {
      // If no session_id, just mark as completed (less secure, for backward compatibility)
      console.warn(`WARNING: Processing payment without session_id verification for secureCode: ${secureCode}. This is less secure.`);
      paymentLink.markCompleted();
      await paymentLink.save();
      const redirectPageTemplate = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Processed - Redirecting...</title>
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #fff3cd; }
              .warning { color: #856404; font-size: 24px; margin-bottom: 20px; }
              .countdown { color: #007bff; font-size: 18px; margin: 20px 0; }
              button { padding: 10px 20px; margin: 10px; cursor: pointer; }
              .cancel-btn { background-color: #dc3545; color: white; border: none; border-radius: 5px; }
          </style>
      </head>
      <body>
          <div>
              <h1 class="warning">⚠️ Payment Processed</h1>
              <p>Your payment has been processed (without full verification).</p>
              <p class="countdown">Redirecting to your account in <span id="countdown">5</span> seconds...</p>
              <button class="cancel-btn" onclick="cancelRedirect()">Cancel Redirect</button>
          </div>
      
          <script>
              let timeLeft = 5;
              let redirectUrl = 'http://localhost:4028/checkout';
              let countdownInterval;
              let redirectCanceled = false; 
      
              function startCountdown() {
                  countdownInterval = setInterval(() => {
                      if (redirectCanceled) return;
                      
                      timeLeft--;
                      document.getElementById('countdown').textContent = timeLeft;
                      
                      if (timeLeft <= 0) {
                          clearInterval(countdownInterval);
                          window.location.href = redirectUrl;
                      }
                  }, 1000);
              }
      
              function cancelRedirect() {
                  redirectCanceled = true;
                  clearInterval(countdownInterval);
                  document.querySelector('.countdown').innerHTML = 'Redirect canceled. <a href="' + redirectUrl + '">Click here to continue</a>';
              }
      
              window.onload = startCountdown;
              
              window.addEventListener('beforeunload', () => {
                  clearInterval(countdownInterval);
              });
          </script>
      </body>
      </html>`;

    //   return res.redirect("http://localhost:4028/checkout")

      return res.send(redirectPageTemplate)

    //   return res.json({
    //     success: true,
    //     message: 'Payment link accessed successfully',
    //     data: {
    //       paymentLinkId: paymentLink._id,
    //       amount: paymentLink.amount,
    //       currency: paymentLink.currency,
    //       status: paymentLink.status,
    //       completedAt: paymentLink.completedAt,
    //     },
    //   });
    }

  } catch (error) {
    console.error('Payment success handling error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process payment success', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /:user_id/payment-links - Get user's payment links
router.get('/:user_id/payment-links', auth, [
  param('user_id').isMongoId().withMessage('Invalid user ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { user_id } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Check permissions
    if (req.user.role !== 'admin' && req.user._id.toString() !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    const filter = { userId: user_id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const paymentLinks = await PaymentLink.find(filter)
      .populate('userId', 'name email')
      .populate('relatedId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PaymentLink.countDocuments(filter);

    res.json({
      success: true,
      data: {
        paymentLinks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalLinks: total,
          limit: parseInt(limit),
        },
      },
    });

  } catch (error) {
    console.error('Get payment links error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve payment links', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// DELETE /:user_id/payment-links/:link_id - Cancel payment link
router.delete('/:user_id/payment-links/:link_id', auth, [
  param('user_id').isMongoId().withMessage('Invalid user ID'),
  param('link_id').isMongoId().withMessage('Invalid link ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { user_id, link_id } = req.params;

    // Check permissions
    if (req.user.role !== 'admin' && req.user._id.toString() !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    const paymentLink = await PaymentLink.findOne({ 
      _id: link_id, 
      userId: user_id 
    });

    if (!paymentLink) {
      return res.status(404).json({ 
        success: false,
        message: 'Payment link not found' 
      });
    }

    if (paymentLink.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot cancel completed or expired payment link' 
      });
    }

    // Mark as expired (soft delete)
    paymentLink.status = 'expired';
    await paymentLink.save();

    res.json({
      success: true,
      message: 'Payment link cancelled successfully',
    });

  } catch (error) {
    console.error('Cancel payment link error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to cancel payment link', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to handle successful payments
async function handleSuccessfulPayment(payment, paymentLink) {
  try {
    switch (payment.paymentType) {
      case 'membership':
        // Upgrade user membership
        await User.findByIdAndUpdate(
          payment.userId,
          { 
            userTier: 'premium',
            membershipUpgradeDate: new Date()
          }
        );
        console.log(`User ${payment.userId} upgraded to premium membership`);
        break;
        
      case 'donation':
        // Add to user's wallet or handle donation
        await User.findByIdAndUpdate(
          payment.userId,
          { $inc: { walletBalance: payment.amount } }
        );
        console.log(`Donation of $${payment.amount} added to user ${payment.userId} wallet`);
        break;
        
      case 'product':
        // Handle product purchase
        console.log(`Product purchase completed: ${payment.relatedId}`);
        break;
        
      case 'cart':
        // Handle cart purchase
        console.log(`Cart purchase completed: ${payment.relatedId}`);
        break;
        
      case 'subscription':
        // Handle subscription activation
        console.log(`Subscription activated: ${payment.relatedId}`);
        break;
        
      default:
        console.log(`Payment completed for type: ${payment.paymentType}`);
    }
  } catch (error) {
    console.error('Error in handleSuccessfulPayment:', error);
  }
}

module.exports = router;