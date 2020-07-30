const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');

//Two options in Schema; one for schema definition and other for its options
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 characters'],
      minlength: [10, 'A tour name must have more or equal then 10 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: {
      type: String,
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either easy, medium or difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      max: [5, 'Rating must be below 5.0'],
      min: [1, 'Rating must be above 1.0'],
      set: (val) => Math.round(val * 10) / 10, //setter sets new value to rounded value
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          //this only points to current doc on NEW document creation
          return val < this.price; //100<200
        },
        message: 'Discount price ({VALUE}) should be below the regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON which specifies geospatial data, this object startLocation is not
      //for schema type options like above, this obj is an embedded obj
      //type and coordinates will get their own schema type options
      type: {
        type: String,
        default: 'Point', //geometry for geospatial
        enum: ['Point'], //as Point should be the only value for this application
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number, //the day on which people will go to this location on tour
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId, //type will be MongoDB id like user id
        ref: 'User', //establish reference to other model User, this creates relationship between two models
      },
    ],
  },
  {
    //Each time the data is outputted as JSON/Object then virtuals will be true
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//compound index, indexing of two fields for efficient searching
tourSchema.index({ price: 1, ratingsAverage: -1 }); //1 is ascending order while -1 is descending
//single field index for field price, mongoDB can search for this field faster, not search collection
tourSchema.index({ slug: 1 });
//For geospatial data, index is 2D sphere index if data describes real points on Earth sphere
tourSchema.index({ startLocation: '2dsphere' });

//virtual properties are not part of mongo Database so they cannot be queried
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

//Virtual Populate, will populate field array with ID, but will not save to database
//referencing foreign field in order to connect the current model with Review model
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', //name of the field in other model; Review, where ref to current model is stored
  localField: '_id', //where foreignField id is stored here in this current Tour model
});

//Mongoose PRE-DOCUMENT MIDDLEWARE: runs before .save command and .create()
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

//Mongoose QUERY MIDDLEWARE: a pre-find hook, a middleware that is gonna run before
//find query is run
tourSchema.pre(/^find/, function (next) {
  //this is a query object unlike in pre-document middleware
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

// populate field name 'guides' in Tour Schema to fill up its referenced ids,
// this happens in query not db
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt', //'-' minus removes __v and passwordChangedAt field from results
  });
  next();
});

//Mongoose QUERY MIDDLEWARE: a post-find hook, a middleware that is gonna run after
//pre-middleware and has access to document retrieved from database
// tourSchema.post(/^find/, function (doc, next) {
//   console.log(`Query took ${Date.now() - this.start} milliseconds`);
//   next();
// });

// //Mongoose Aggregation Middleware; a pre-middleware
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   console.log(this.pipeline());
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;

//This is an example of embedding documents within documents
// //this document middleware saves the guides array in tourSchema, creates new documents
// //not updates them
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
// });

//Mongoose POST-DOCUMENT MIDDLEWARE: runs after PRE-MIDDLEWARE and has access to document
//saved in Database
// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });
