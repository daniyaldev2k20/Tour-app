const multer = require('multer');
const AppError = require('./appError');

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     //cb stands for callback, works just like next() in express
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     //mimetype is received from req.file with multer, and splitting it gets jpeg
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

//storing image in buffers; memory instead of diskStorage like earlier, used for image processing
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

module.exports = upload;
