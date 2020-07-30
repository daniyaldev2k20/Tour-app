const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');

//Router is a middleware
const router = express.Router();

//router.use means that current router should mount reviewRouter when route is given
//since router is a middleware, use method can be called on it
//reviewRouter gets access to tour params via mergeParams pattern implemented in review router
//otherwise reviewRouter could not get access to params from other route
router.use('/:tourId/reviews', reviewRouter);

//Two functions in get means that both of them are middlewares
//if first middleware is good to go then next() is called in that middleware and next
//middleware is called
router
  .route('/top-five-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  );

// could have been   /tours-within?distance=223&center=-40,45&unit=mi
// implemented(standard of specifying URLS)  /tours-within/223/center/40,45/unit/mi
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.createTour
  );

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

module.exports = router;

//Parameter middleware used for checking routes wrt ids whether the id is valid or not
// router.param('id', tourController.checkID);
