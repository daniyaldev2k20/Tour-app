const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const upload = require('../utils/multerSettings');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

//middleware for uploading images via Multer middleware
exports.uploadUserPhoto = upload.single('photo');

//middleware for image resizing
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  //if no upload image is in req.file, return next; meaning execution leaves the function instead of evaluating rest of function
  if (!req.file) {
    return next();
  }

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

//middleware sets req.params.id (used in handler function) to
//req.user.id coming from protect middleware implemented in authController
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

//used only for authenticated users who wish to update their profile
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password update. Please use /updateMyPassword',
        400
      )
    );
  }
  // 2) Update user document
  //filteredBody only contains the relevant data to be updated like name or email
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) {
    filteredBody.photo = req.file.filename;
  }
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    // new:true returns new ie; updated object instead of old one
    new: true,
    // runValidators:true catches invalid email and sends error
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  //this updates the user id and its active schema prop to false
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

//Don't update passwords with this controller function
//this function is accessed by admins only
exports.updateUser = factory.updateOne(User);

//Only the admin can delete the user from database
//Users can only set their account to inactive
exports.deleteUser = factory.deleteOne(User);
