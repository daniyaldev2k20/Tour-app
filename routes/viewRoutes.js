const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(viewsController.alerts);

//Rendering pug templates
router.get('/', authController.isLoggedIn, viewsController.getOverview);
//Tour page route based on its slug
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
//Natours login page route
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);

router.get('/my-tours', authController.protect, viewsController.getMyTours);

module.exports = router;
