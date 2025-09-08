const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const stripeService = require('../services/stripe');
const PaymentLink = require('../models/PaymentLink');
const Payment = require('../models/Payment');
const User = require('../models/User');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Validation middleware
const validatePaymentLinkCreation = [
  param('user_id').isMongoId().withMessage('Invalid user ID'),
  body('amount').isFloat({ min: 0.5 }).withMessage('Amount must be at least $0.50'),
  body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency'),
  body('paymentType').isIn(['subscription', 'one_time', 'donation', 'membership', 'product']).withMessage('Invalid payment type'),
  body('productId').optional().notEmpty().withMessage('Product ID is required for product payments'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
  body('relatedId').optional().isMongoId().withMessage('Invalid related ID'),
  body('relatedModel').optional().isIn(['Product', 'Subscription', 'Masterclass', 'Membership']).withMessage('Invalid related model'),
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
          url: `${'http://localhost:3001'}/api/payment-links/${user_id}/payment-success?secureCode=${secureCode}`,
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

    res.json({
      success: true,
      message: 'Payment link created successfully',
      data: {
        payment_link: stripePaymentLink.url,
        secureCode,
        expiresAt: paymentLink.expiresAt,
        paymentLinkId: paymentLink._id,
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
    if (session_id) {
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

          // Handle post-payment actions
          await handleSuccessfulPayment(payment, paymentLink);
        //   res.redirect("https://fornt_uyrl/succe")

          return res.json({
            success: true,
            message: 'Payment completed successfully',
            data: {
              paymentId: payment._id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              completedAt: paymentLink.completedAt,
            },
          });
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
      paymentLink.markCompleted();
      await paymentLink.save();
      const redirectPageTemplate = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redirecting...</title>
      </head>
      <body>
          <div>
              <h1>You will be redirected in <span id="countdown">5</span> seconds</h1>
              <p>Please wait while we redirect you to your destination.</p>
              <button onclick="cancelRedirect()">Cancel</button>
          </div>
      
          <script>
              let timeLeft = 1;
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
                  document.body.innerHTML = '<h1>Redirect Canceled</h1><p>The automatic redirect has been canceled.</p>';
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