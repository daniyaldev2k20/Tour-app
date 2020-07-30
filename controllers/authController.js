const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const timeFormula = 24 * 60 * 60 * 1000; //24 hours, 60 minutes, 60 seconds, 1000 milliseconds

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * timeFormula
    ),
    // secure: true, //cookie will be sent on encrypted connection; https
    httpOnly: true, //browser cannot modify cookie
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });

  //remove the password from output in response
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signUp = catchAsync(async (req, res, next) => {
  //Do not change this code; tutorial fixed this
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;

  await new Email(newUser, url).sendWelcome();

  //JWT SignIn function
  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) Check email and password exists
  if (!(email || password)) {
    return next(new AppError('Please provide email and password!', 400));
  }
  //2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');
  ///select + gets field not selected by default in mongoose schema select: false

  //since instance method defined in user model is available
  //on all documents, user has this method because user is the result of querying User documents
  //(await user.correctPassword(password, user.password) is passed to if statement below because
  //if user does not exist then this code should not run
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //3) If everything is okay, send token to client
  //_id is used for MongoDB ids, that is why user._id instead of user.id
  createSendToken(user, 200, req, res);
});

//since we cannot modify/delete cookie in our browser, this workaround creates a logout route
//which will send a new cookie with exact same name but with no token, this overrides the
//current cookie in the browser with same name w/o any token, effectively logging out current user
exports.logout = (req, res) => {
  res.cookie('jwt', 'logged out', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    status: 'success',
  });
};

//For giving access to tour routes only to logged in users
exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting token and if its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('You are not logged in!', 401));
  }
  //2) Verification of token (JWT)
  //decoded payload from this JSON Web Token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3) Check if user still exists
  //in decoded, user id via logging in is displayed, id is a property of decoded after JWT
  //verification process, currentUser checks whether the user id exists or not
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belong to this token no longer exists', 401)
    );
  }

  //4) Check if user changed password after token (JWT) was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please login again', 401)
    );
  }

  //Grant access to protected routes; this next() calls the next middleware; route handler
  req.user = currentUser; //this ensures that currentUser is able to access routes
  res.locals.user = currentUser; //each pug template has access to response.locals
  next();
});

//Middleware for rendered pages, no errors!
//different from protect middleware as it will run for each and every request on rendered pages
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      //1) Verifies the token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      //2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        //if user does not exist then move to next middleware
        return next();
      }

      //3) Check if user changed password after token (JWT) was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      //After all checks are passed, there is a logged in user
      //this makes any variable like user accessible to pug templates
      res.locals.user = currentUser; //each pug template has access to response.locals
      return next();
    } catch (err) {
      //go to next middleware because there is no logged in user
      return next();
    }
  }
  //if there is no cookie then call the next middleware
  return next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    //roles is an array ['admin', 'lead-guide']
    //other users like 'user' or 'guide' does not have permission
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address', 404));
  }

  //2) Generate random reset token
  const resetToken = user.createPasswordResetToken();
  //validateBeforeSave deactivates all the validators in User schema
  await user.save({ validateBeforeSave: false });

  //3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error, try again', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on token 'encrypt original token returned and
  // compare it with encrypted token in database', req.params.token is gathered from url params
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // passwordResetToken is user schema property which contains the hashed string saved in database
  // and passwordResetExpires checks if Date.now is greater than current value
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or expired', 400));
  }
  user.password = req.body.password; //as request body contains both password and confirm
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  //user.save is needed as above only modifies the document, it doesn't save it in DB
  await user.save();

  // 3) Update passwordChangedAt property for the current user
  // Implemented in userModel with the same comment as above

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { password, passwordConfirm, passwordCurrent } = req.body;
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(passwordCurrent, user.password))) {
    return next(new AppError('Current Password is not correct', 401));
  }

  // 3) If so, update the password
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();
  //User.findByIdAndUpdate will not work as intended!

  // 4) Log user in, send JWT with new password
  createSendToken(user, 201, req, res);
});

//My updatePassword Implementation
// exports.updatePassword = catchAsync(async (req, res, next) => {
//   const { password, passwordConfirm, passwordCurrent } = req.body;
//   // 1) Get user from collection
//   const user = await User.findById(req.user.id).select('+password');

//   // 2) Check if POSTed current password is correct
//   const checkPassword = await user.correctPassword(
//     passwordCurrent,
//     user.password
//   );

//   // 3) If so, update the password
//   console.log(checkPassword);
//   if (checkPassword) {
//     user.password = password;
//     user.passwordConfirm = passwordConfirm;
//     await user.save();
//   } else {
//     return next(new AppError('Password is not correct', 401));
//   }
//   //User.findByIdAndUpdate will not work as intended!

//   // 4) Log user in, send JWT with new password
//   createSendToken(user, 201, res);
// });
