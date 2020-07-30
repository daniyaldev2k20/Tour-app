const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

//mergeParams preserves the req.params value from parent router, if conflicting param
//names arise in parent anc child routes then child takes precedence
//by default each router has access to parameters of their specific routes, in route below
//in router '/' there is no tour id, to get access to params from other router, the following is done
const router = express.Router({ mergeParams: true });

//Protect all middlewares after this middleware
router.use(authController.protect);

router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview
  );

module.exports = router;

//NESTED ROUTES summary
//POST /tour/23151/reviews where for this tour id, a review will be written
//and user id will be received in req.body via JWT web token or something like that
//reviews is child of tour, this nested route means accessing reviews resource on tours resource

//GET /tour/23151/reviews also works the same way
//GET /tour/23151/reviews/id where a review is gathered based on its id
