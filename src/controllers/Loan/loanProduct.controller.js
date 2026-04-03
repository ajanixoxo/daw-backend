const LoanProduct = require("../../models/loanModel/loanProduct.model");
const asyncHandler = require("express-async-handler");

// @desc    Create a new loan product
// @route   POST /api/loans/products
// @access  Admin
const createLoanProduct = asyncHandler(async (req, res) => {
  const { name, amount, interestRate, repaymentTerm, tier, purpose, description } = req.body;

  // Simple interest calculation: (Amount * (1 + (Rate/100 * Months/12))) / Months
  const ratePerMonth = (interestRate / 100) / 12;
  const totalInterest = amount * ratePerMonth * repaymentTerm;
  const monthlyPayment = Math.round((amount + totalInterest) / repaymentTerm);

  const loanProduct = await LoanProduct.create({
    name,
    amount,
    interestRate,
    repaymentTerm,
    monthlyPayment,
    tier,
    purpose,
    description
  });

  res.status(201).json({
    success: true,
    data: loanProduct
  });
});

// @desc    Get all active loan products
// @route   GET /api/loans/products
// @access  Public/Member
const getAllLoanProducts = asyncHandler(async (req, res) => {
  const products = await LoanProduct.find({ isActive: true });
  res.status(200).json({
    success: true,
    data: products
  });
});

// @desc    Get loan product by ID
// @route   GET /api/loans/products/:id
// @access  Public/Member
const getLoanProductById = asyncHandler(async (req, res) => {
  const product = await LoanProduct.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Loan product not found");
  }
  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Update a loan product
// @route   PATCH /api/loans/products/:id
// @access  Admin
const updateLoanProduct = asyncHandler(async (req, res) => {
  const { name, amount, interestRate, repaymentTerm, tier, purpose, description, isActive } = req.body;
  
  const product = await LoanProduct.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Loan product not found");
  }

  // Recalculate monthly payment if amount, rate, or term changes
  if (amount !== undefined || interestRate !== undefined || repaymentTerm !== undefined) {
    const newAmount = amount ?? product.amount;
    const newRate = interestRate ?? product.interestRate;
    const newTerm = repaymentTerm ?? product.repaymentTerm;

    const ratePerMonth = (newRate / 100) / 12;
    const totalInterest = newAmount * ratePerMonth * newTerm;
    product.monthlyPayment = Math.round((newAmount + totalInterest) / newTerm);
  }

  if (name !== undefined) product.name = name;
  if (amount !== undefined) product.amount = amount;
  if (interestRate !== undefined) product.interestRate = interestRate;
  if (repaymentTerm !== undefined) product.repaymentTerm = repaymentTerm;
  if (tier !== undefined) product.tier = tier;
  if (purpose !== undefined) product.purpose = purpose;
  if (description !== undefined) product.description = description;
  if (isActive !== undefined) product.isActive = isActive;

  const updatedProduct = await product.save();
  res.status(200).json({
    success: true,
    data: updatedProduct
  });
});

// @desc    Delete a loan product (Soft delete by setting isActive to false recommended, or hard delete)
// @route   DELETE /api/loans/products/:id
// @access  Admin
const deleteLoanProduct = asyncHandler(async (req, res) => {
  const product = await LoanProduct.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Loan product not found");
  }
  await product.deleteOne();
  res.status(200).json({
    success: true,
    message: "Loan product removed"
  });
});

module.exports = {
  createLoanProduct,
  getAllLoanProducts,
  getLoanProductById,
  updateLoanProduct,
  deleteLoanProduct
};
