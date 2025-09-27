const mongoose = require('mongoose');
const MembershipPlanTemplate = require('../src/models/MembershipPlanTemplate');
const Cooperative = require('../src/models/Cooperative');
const User = require('../src/models/User');

// Sample membership plan templates data
const sampleMembershipPlanTemplates = [
  {
    name: "BasicCommunity Access",
    description: "Basic membership with essential features for small businesses starting their journey",
    category: "basic",
    pricing: {
      monthlyFee: 29,
      setupFee: 0,
      currency: "USD"
    },
    loanAccess: {
      enabled: true,
      maxAmount: 5000,
      minAmount: 500,
      interestRate: 3,
      repaymentTerms: {
        minMonths: 6,
        maxMonths: 12
      }
    },
    features: [
      {
        name: "Up to $5,000 loan limit",
        description: "Maximum loan amount available for basic members",
        included: true
      },
      {
        name: "3% interest rate",
        description: "Competitive low interest rate",
        included: true
      },
      {
        name: "6-month repayment terms",
        description: "Flexible repayment options up to 12 months",
        included: true
      },
      {
        name: "Basic financial support",
        description: "Access to financial guidance and resources",
        included: true
      },
      {
        name: "Email support",
        description: "Customer support via email during business hours",
        included: true
      }
    ],
    eligibility: {
      minimumMembershipMonths: 0,
      minimumContribution: 0,
      requiresGuarantor: false,
      requiresCollateral: false
    },
    benefits: {
      supportLevel: "basic",
      financialAdvisory: true,
      personalFinancialAdvisor: false,
      businessMentorship: false,
      marketplaceBoost: false,
      networkingEvents: false,
      investmentOpportunities: false,
      customFinancialSolutions: false,
      exclusiveContent: true,
      prioritySupport: false
    },
    isActive: true,
    isPopular: true,
    displayOrder: 1
  },
  {
    name: "Premium ProCommunity Access",
    description: "Premium membership with enhanced features and higher loan limits",
    category: "premium",
    pricing: {
      monthlyFee: 149,
      setupFee: 25,
      currency: "USD"
    },
    loanAccess: {
      enabled: true,
      maxAmount: 50000,
      minAmount: 1000,
      interestRate: 1.5,
      repaymentTerms: {
        minMonths: 6,
        maxMonths: 24
      }
    },
    features: [
      {
        name: "Up to $50,000 loan limit",
        description: "Substantial loan amounts at preferential rates",
        included: true
      },
      {
        name: "1.5% interest rate",
        description: "Lowest interest rate for premium members",
        included: true
      },
      {
        name: "24-month repayment terms",
        description: "Extended repayment options up to 24 months",
        included: true
      },
      {
        name: "Personal financial advisor",
        description: "Dedicated financial advisor for personalized guidance",
        included: true
      },
      {
        name: "White-glove support",
        description: "Premium support with priority handling",
        included: true
      },
      {
        name: "Custom financial solutions",
        description: "Tailored financial products and services",
        included: true
      },
      {
        name: "Exclusive networking events",
        description: "Access to premium networking and business events",
        included: true
      },
      {
        name: "Investment opportunities",
        description: "Early access to exclusive investment opportunities",
        included: true
      }
    ],
    eligibility: {
      minimumMembershipMonths: 3,
      minimumContribution: 1000,
      requiresGuarantor: false,
      requiresCollateral: true
    },
    benefits: {
      supportLevel: "white-glove",
      financialAdvisory: true,
      personalFinancialAdvisor: true,
      businessMentorship: true,
      marketplaceBoost: true,
      networkingEvents: true,
      investmentOpportunities: true,
      customFinancialSolutions: true,
      exclusiveContent: true,
      prioritySupport: true
    },
    isActive: true,
    isPopular: false,
    displayOrder: 2
  },
  {
    name: "Enterprise Scale",
    description: "Enterprise-level membership for established businesses requiring substantial capital",
    category: "enterprise",
    pricing: {
      monthlyFee: 299,
      setupFee: 100,
      currency: "USD"
    },
    loanAccess: {
      enabled: true,
      maxAmount: 100000,
      minAmount: 10000,
      interestRate: 1,
      repaymentTerms: {
        minMonths: 12,
        maxMonths: 36
      }
    },
    features: [
      {
        name: "Up to $100,000 loan limit",
        description: "Maximum loan amounts for major business investments",
        included: true
      },
      {
        name: "1% interest rate",
        description: "Lowest possible interest rate",
        included: true
      },
      {
        name: "36-month repayment terms",
        description: "Maximum flexibility with extended terms",
        included: true
      },
      {
        name: "Dedicated account manager",
        description: "Personal account manager for all your needs",
        included: true
      },
      {
        name: "Custom financial solutions",
        description: "Bespoke financial products tailored to your business",
        included: true
      },
      {
        name: "VIP networking events",
        description: "Exclusive access to high-level business events",
        included: true
      },
      {
        name: "Priority investment opportunities",
        description: "First access to premium investment deals",
        included: true
      },
      {
        name: "24/7 white-glove support",
        description: "Round-the-clock premium support",
        included: true
      }
    ],
    eligibility: {
      minimumMembershipMonths: 12,
      minimumContribution: 5000,
      requiresGuarantor: true,
      requiresCollateral: true
    },
    benefits: {
      supportLevel: "white-glove",
      financialAdvisory: true,
      personalFinancialAdvisor: true,
      businessMentorship: true,
      marketplaceBoost: true,
      networkingEvents: true,
      investmentOpportunities: true,
      customFinancialSolutions: true,
      exclusiveContent: true,
      prioritySupport: true
    },
    isActive: true,
    isPopular: false,
    displayOrder: 3
  }
];

async function seedMembershipPlanTemplates() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daw_backend';
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get the first cooperative and user for seeding
    const cooperative = await Cooperative.findOne({ status: 'active' });
    const user = await User.findOne({ role: 'cooperative_admin' });

    if (!cooperative) {
      console.error('No active cooperative found. Please create a cooperative first.');
      process.exit(1);
    }

    if (!user) {
      console.error('No cooperative admin user found. Please create a cooperative admin user first.');
      process.exit(1);
    }

    console.log(`Using cooperative: ${cooperative.name} (${cooperative._id})`);
    console.log(`Using admin user: ${user.name} (${user._id})`);

    // Clear existing membership plan templates for this cooperative
    await MembershipPlanTemplate.deleteMany({ cooperativeId: cooperative._id });
    console.log('Cleared existing membership plan templates');

    // Create new membership plan templates
    const membershipPlanTemplates = [];
    for (const planData of sampleMembershipPlanTemplates) {
      const membershipPlanTemplate = new MembershipPlanTemplate({
        ...planData,
        cooperativeId: cooperative._id,
        createdBy: user._id
      });

      await membershipPlanTemplate.save();
      membershipPlanTemplates.push(membershipPlanTemplate);
      console.log(`Created membership plan template: ${membershipPlanTemplate.name} (${membershipPlanTemplate.category})`);
    }

    console.log(`\n✅ Successfully created ${membershipPlanTemplates.length} membership plan templates!`);
    
    // Display summary
    console.log('\n📋 Membership Plan Templates Summary:');
    membershipPlanTemplates.forEach(plan => {
      const loanInfo = plan.loanAccess.enabled 
        ? `up to $${plan.loanAccess.maxAmount} loans at ${plan.loanAccess.interestRate}%`
        : 'no loan access';
      console.log(`  • ${plan.name}: $${plan.pricing.monthlyFee}/month, ${loanInfo}`);
    });

    console.log('\n🚀 You can now:');
    console.log('1. View plans: GET /api/membership-plan-templates/cooperative/' + cooperative._id);
    console.log('2. Have sellers join cooperatives by selecting membership plans');
    console.log('3. Process loan applications with plan-based terms (if loan access enabled)');

  } catch (error) {
    console.error('Error seeding membership plan templates:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seeding script
if (require.main === module) {
  seedMembershipPlanTemplates();
}

module.exports = seedMembershipPlanTemplates;