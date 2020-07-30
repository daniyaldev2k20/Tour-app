const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty'],
    },
    rating: {
      type: Number,
      required: true,
      default: 4.5,
      max: [5, 'Rating must be below 5.0'],
      min: [1, 'Rating must be above 1.0'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      // select: false,
    },
    tour: {
      type: mongoose.Schema.ObjectId, //ObjectId should always be in lowercase
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    //Each time the data is outputted as JSON/Object then virtuals will be true, field that is not stored in database
    //but calculated using some other value, this also shows up when there is some output
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//this ensures that the user can write one not multiple review for each tour
//combination of tour and user is unique
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

//Query Middlewares
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

//static methods are called on Models themselves, instance methods on model instances
reviewSchema.statics.calAvgRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        numOfRating: { $sum: 1 }, //no of reviews for each tour; meaning 5 reviews will get 5 sum
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  console.log(stats);

  //if reviews for a tour exists then stats array will return length > 0 else not
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].numOfRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

//setting the stats of reviews on tour middleware
reviewSchema.post('save', function () {
  //this keyword points to current review document
  //constructor is the model which creates the Review Model
  this.constructor.calAvgRatings(this.tour);
});

//updating stats after review is updated/deleted via using query middleware on reviewSchema
//findByIdAndUpdate in Mongoose is shorthand for findOneAndUpdate in MongoDB
reviewSchema.pre(/^findOneAnd/, async function (next) {
  //this keyword points to current query being run
  //this.reviewDoc is property set on this keyword and then passed to next query post middleware
  this.reviewDoc = await this.findOne();
  console.log(this.reviewDoc);
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  //this.reviewDoc is document got from pre query middleware via next(); nice trick for accessing document in query middleware
  //await this.findOne(); does not work in post, query has already executed
  await this.reviewDoc.constructor.calAvgRatings(this.reviewDoc.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
