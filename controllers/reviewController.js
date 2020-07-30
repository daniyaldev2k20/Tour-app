const Review = require('../models/reviewModel');
const Tour = require('../models/tourModel');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

//Middleware for setting IDs on the req.body
exports.setTourUserIds = async (req, res, next) => {
  //Allow nested routes

  //1) Check if tourId exists
  const paramTourID = await Tour.findById(req.params.tourId);
  if (!paramTourID) {
    return next(new AppError('Tour does not exist', 404));
  }
  //2) If tourId is not specified in the req.body then condition will run
  if (paramTourID && !req.body.tour) {
    req.body.tour = req.params.tourId; //name of parameter in URL is got via req.params.tourID
  }

  //3) If there is no req.body.user
  if (paramTourID && !req.body.user) {
    req.body.user = req.user.id; //req.user.id is received via protect middleware in authController
  }

  //Move to the next middleware (createReview) after setting ids on req.body
  next();
};

exports.createReview = factory.createOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.getReview = factory.getOne(Review);
exports.getAllReviews = factory.getAll(Review, true);
