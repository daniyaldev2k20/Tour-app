const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'You must enter your name'],
      trim: true,
      maxlength: [20, 'A name must have less or equal then 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'A user must have an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Provide a valid email'],
    },
    photo: {
      type: String,
      default: 'default.jpg',
    },
    role: {
      type: String,
      default: 'user',
      enum: ['user', 'guide', 'lead-guide', 'admin'],
    },
    password: {
      type: String,
      required: [true, 'A user must have a password'],
      unique: true,
      trim: true,
      maxlength: [15, 'A password must have less or equal then 15 characters'],
      minlength: [8, 'A password must have more or equal then 8 characters'],
      select: false, //select set to false to hide password in output
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Confirm your password'],
      validate: {
        //This only works on Create and SAVE
        validator: function (el) {
          return el === this.password;
        },
        message: 'Password is not the same',
      },
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    //any new user created will have an active account by default
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  }
  // {
  //   //Each time the data is outputted as JSON/Object then virtuals will be true
  //   toJSON: { virtuals: true },
  //   toObject: { virtuals: true },
  // }
);

userSchema.pre('save', async function (next) {
  //isModified is built in method of Mongoose; and this is run if password is modified
  if (!this.isModified('password')) {
    return next();
  }
  //in hash function; 2nd parameter refers to cost ala how CPU intensive this process will be
  this.password = await bcrypt.hash(this.password, 12);

  //passwordConfirm is used only for user validation,
  //hence it is set to undefined; not persisted in MongoDB in order to delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

// Update passwordChangedAt property for the current user
userSchema.pre('save', function (next) {
  //this.isNew refers to boolean which shows whether use document is new or not
  if (!this.isModified('password') || this.isNew) {
    return next();
  }

  //saves 1 second in past, to ensure that token is always created after password has been changed
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  //this points to the current query
  //query middleware finds the document with active set to true, before queries like find is used
  this.find({ active: { $ne: false } });
  next();
});

//instance method is a method that is available on all documents of a certain schema
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

//JWTTimestamp means the time when JWT token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimeStamp; //meaning password changed after token was issued
    //100 < 200 for example
  }

  //FALSE means not changed, meaning user password has not been changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  //this token is created to grant user a temp token so that user can use to create real password
  //only this use will have access to this password
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  //here 10 is minutes, 60 is seconds, and 1000 is for milliseconds
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
