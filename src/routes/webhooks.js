const express = require('express');
const stripeService = require('../services/stripe');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Order = require('../models/Order');

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    // Verify webhook signature
    const event = stripeService.constructWebhookEvent(req.body, signature);

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });

    if (!payment) {
      console.error(`Payment record not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    payment.status = 'succeeded';
    payment.receiptUrl = paymentIntent.charges.data[0]?.receipt_url;

    // Extract payment method details
    if (paymentIntent.charges.data.length > 0) {
      const charge = paymentIntent.charges.data[0];
      if (charge.payment_method_details) {
        payment.paymentMethod = {
          type: charge.payment_method_details.type,
          last4: charge.payment_method_details.card?.last4,
          brand: charge.payment_method_details.card?.brand,
          country: charge.payment_method_details.card?.country,
        };
      }
    }

    await payment.save();

    // Handle post-payment actions
    await handleSuccessfulPayment(payment);

    console.log(`Payment succeeded: ${payment._id}`);
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });

    if (!payment) {
      console.error(`Payment record not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    payment.status = 'failed';
    
    // Extract failure reason
    if (paymentIntent.last_payment_error) {
      payment.failureReason = {
        code: paymentIntent.last_payment_error.code,
        message: paymentIntent.last_payment_error.message,
      };
    }

    await payment.save();

    console.log(`Payment failed: ${payment._id}`);
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}

// Handle canceled payment intent
async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });

    if (!payment) {
      console.error(`Payment record not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    payment.status = 'canceled';
    await payment.save();

    console.log(`Payment canceled: ${payment._id}`);
  } catch (error) {
    console.error('Error handling payment intent canceled:', error);
  }
}

// Handle charge dispute created
async function handleChargeDisputeCreated(dispute) {
  try {
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: dispute.payment_intent 
    });

    if (!payment) {
      console.error(`Payment record not found for dispute: ${dispute.id}`);
      return;
    }

    // Add dispute information to payment metadata
    payment.metadata.set('dispute_id', dispute.id);
    payment.metadata.set('dispute_reason', dispute.reason);
    payment.metadata.set('dispute_status', dispute.status);
    
    await payment.save();

    // TODO: Send notification to admin about dispute
    console.log(`Dispute created for payment: ${payment._id}`);
  } catch (error) {
    console.error('Error handling charge dispute created:', error);
  }
}

// Handle successful invoice payment (for subscriptions)
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    // Handle subscription payment success
    console.log(`Invoice payment succeeded: ${invoice.id}`);
    
    // TODO: Update subscription status, extend service period, etc.
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

// Handle failed invoice payment (for subscriptions)
async function handleInvoicePaymentFailed(invoice) {
  try {
    // Handle subscription payment failure
    console.log(`Invoice payment failed: ${invoice.id}`);
    
    // TODO: Send notification, suspend service, etc.
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  try {
    console.log(`Subscription created: ${subscription.id}`);
    
    // TODO: Create subscription record in database
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log(`Subscription updated: ${subscription.id}`);
    
    // TODO: Update subscription record in database
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log(`Subscription deleted: ${subscription.id}`);
    
    // TODO: Update subscription record, suspend service
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Helper function to handle successful payments
async function handleSuccessfulPayment(payment) {
  try {
    switch (payment.paymentType) {
      case 'wallet_topup':
        // Add amount to user's wallet
        await User.findByIdAndUpdate(
          payment.userId,
          { $inc: { walletBalance: payment.amount } }
        );
        console.log(`Wallet topped up: User ${payment.userId}, Amount: ${payment.amount}`);
        break;
        
      case 'order':
        // Update order status to processing
        if (payment.relatedId) {
          await Order.findByIdAndUpdate(
            payment.relatedId,
            { 
              status: 'processing',
              updatedAt: new Date()
            }
          );
          console.log(`Order updated to processing: ${payment.relatedId}`);
        }
        break;
        
      case 'masterclass':
        // Handle masterclass purchase
        console.log(`Masterclass purchased: ${payment.relatedId}`);
        // TODO: Grant access to masterclass
        break;
        
      case 'subscription':
        // Handle subscription payment
        console.log(`Subscription payment processed: ${payment.relatedId}`);
        // TODO: Extend subscription period
        break;
        
      default:
        console.log(`No specific handler for payment type: ${payment.paymentType}`);
    }
  } catch (error) {
    console.error('Error in handleSuccessfulPayment:', error);
  }
}

module.exports = router;