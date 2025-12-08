const AppError = require("@utils/Error/AppError");

const globalErrorHandler = (err, req, res, next) => {


  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    status: "error",
    message: "Something went wrong",
  });
};

module.exports = globalErrorHandler;
