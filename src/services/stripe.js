const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  // Create a payment intent for one-time payments
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new Error(`Stripe payment intent creation failed: ${error.message}`);
    }
  }

  // Create a customer
  async createCustomer(email, name, metadata = {}) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata,
      });

      return customer;
    } catch (error) {
      throw new Error(`Stripe customer creation failed: ${error.message}`);
    }
  }

  // Get or create customer
  async getOrCreateCustomer(email, name, metadata = {}) {
    try {
      // First, try to find existing customer
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer if not found
      return await this.createCustomer(email, name, metadata);
    } catch (error) {
      throw new Error(`Stripe customer retrieval/creation failed: ${error.message}`);
    }
  }

  // Create a subscription for recurring payments
  async createSubscription(customerId, priceId, metadata = {}) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata,
      });

      return {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      };
    } catch (error) {
      throw new Error(`Stripe subscription creation failed: ${error.message}`);
    }
  }

  // Create a product
  async createProduct(name, description, metadata = {}) {
    try {
      const product = await stripe.products.create({
        name,
        description,
        metadata,
      });

      return product;
    } catch (error) {
      throw new Error(`Stripe product creation failed: ${error.message}`);
    }
  }

  // Create a price for a product
  async createPrice(productId, unitAmount, currency = 'usd', recurring = null) {
    try {
      const priceData = {
        product: productId,
        unit_amount: Math.round(unitAmount * 100), // Convert to cents
        currency: currency.toLowerCase(),
      };

      if (recurring) {
        priceData.recurring = recurring; // e.g., { interval: 'month' }
      }

      const price = await stripe.prices.create(priceData);
      return price;
    } catch (error) {
      throw new Error(`Stripe price creation failed: ${error.message}`);
    }
  }

  // Retrieve payment intent
  async retrievePaymentIntent(paymentIntentId) {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw new Error(`Stripe payment intent retrieval failed: ${error.message}`);
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      return await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
    } catch (error) {
      throw new Error(`Stripe payment intent confirmation failed: ${error.message}`);
    }
  }

  // Cancel payment intent
  async cancelPaymentIntent(paymentIntentId) {
    try {
      return await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      throw new Error(`Stripe payment intent cancellation failed: ${error.message}`);
    }
  }

  // Create a refund
  async createRefund(paymentIntentId, amount = null, reason = null) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        refundData.reason = reason; // 'duplicate', 'fraudulent', or 'requested_by_customer'
      }

      return await stripe.refunds.create(refundData);
    } catch (error) {
      throw new Error(`Stripe refund creation failed: ${error.message}`);
    }
  }

  // Get customer payment methods
  async getCustomerPaymentMethods(customerId, type = 'card') {
    try {
      return await stripe.paymentMethods.list({
        customer: customerId,
        type,
      });
    } catch (error) {
      throw new Error(`Stripe payment methods retrieval failed: ${error.message}`);
    }
  }

  // Detach payment method from customer
  async detachPaymentMethod(paymentMethodId) {
    try {
      return await stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      throw new Error(`Stripe payment method detachment failed: ${error.message}`);
    }
  }

  // Construct webhook event
  constructWebhookEvent(payload, signature) {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      throw new Error(`Stripe webhook verification failed: ${error.message}`);
    }
  }

  // Get balance
  async getBalance() {
    try {
      return await stripe.balance.retrieve();
    } catch (error) {
      throw new Error(`Stripe balance retrieval failed: ${error.message}`);
    }
  }

  // List charges
  async listCharges(limit = 10, customerId = null) {
    try {
      const params = { limit };
      if (customerId) {
        params.customer = customerId;
      }
      return await stripe.charges.list(params);
    } catch (error) {
      throw new Error(`Stripe charges listing failed: ${error.message}`);
    }
  }
}

module.exports = new StripeService