const express = require('express');
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

//for limiting user login attempts
const loginLimit = rateLimit({
  max: 3, //max number of requests
  windowMs: 60 * 60 * 1000, //window period for requests
  message: 'Too many login attempts, please try again in an hour',
});

router.post('/signup', authController.signUp);
router.post('/login', loginLimit, authController.login);
router.get('/logout', authController.logout);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

//Middleware will protect all the routes that come after this; router is a mini application and hence can use middlewares,
//since middlewares run in sequence; other following middlewares will implement this middleware automatically
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
//multer middleware 'upload.single' which uploads single doc via field in form called photo
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);
router.delete('/deleteMe', userController.deleteMe);

//All routes following this middleware are restricted to admins and also protected due to above
//authController.protect middleware
router.use(authController.restrictTo('admin'));

router.route('/').get(userController.getAllUsers);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
